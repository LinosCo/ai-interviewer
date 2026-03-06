import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { BrandReportEngine } from '@/lib/visibility/brand-report-engine';

/**
 * POST /api/visibility/brand-report
 * Trigger a new brand report generation for a VisibilityConfig.
 *
 * Body: {
 *   configId: string;
 *   websiteUrl?: string;
 *   sitemapUrl?: string;
 *   additionalUrls?: Array<{ url: string; label?: string }>;
 * }
 *
 * Returns the reportId immediately (report runs async in the same request,
 * Next.js streaming is not needed here since generation takes ~20-40s).
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { configId, websiteUrl, sitemapUrl, additionalUrls } = body as {
            configId?: string;
            websiteUrl?: string;
            sitemapUrl?: string;
            additionalUrls?: Array<{ url: string; label?: string }>;
        };
        const hasWebsiteUrlOverride = Object.prototype.hasOwnProperty.call(body, 'websiteUrl');
        const hasSitemapUrlOverride = Object.prototype.hasOwnProperty.call(body, 'sitemapUrl');
        const hasAdditionalUrlsOverride = Object.prototype.hasOwnProperty.call(body, 'additionalUrls');

        if (!configId) {
            return NextResponse.json({ error: 'configId is required' }, { status: 400 });
        }

        const normalizeOptionalUrl = (value?: string) => {
            if (!value?.trim()) return undefined;
            const parsed = new URL(value.trim());
            return parsed.toString();
        };

        let websiteUrlOverride: string | undefined;
        let sitemapUrlOverride: string | undefined;
        try {
            websiteUrlOverride = normalizeOptionalUrl(websiteUrl);
            sitemapUrlOverride = normalizeOptionalUrl(sitemapUrl);
        } catch {
            return NextResponse.json({ error: 'Invalid URL payload' }, { status: 400 });
        }

        const normalizedAdditionalUrls = Array.isArray(additionalUrls)
            ? additionalUrls
                .map((item, index) => {
                    try {
                        const normalized = new URL(String(item?.url || '').trim()).toString();
                        return {
                            url: normalized,
                            label: String(item?.label || `URL ${index + 1}`).trim() || `URL ${index + 1}`,
                        };
                    } catch {
                        return null;
                    }
                })
                .filter((item): item is { url: string; label: string } => !!item)
            : [];

        // Verify access
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: { id: true, organizationId: true, websiteUrl: true },
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId,
                },
            },
            select: { status: true },
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Persist latest crawl sources on config so UI keeps them across reloads and reruns.
        if (hasWebsiteUrlOverride || hasSitemapUrlOverride || hasAdditionalUrlsOverride) {
            await prisma.visibilityConfig.update({
                where: { id: config.id },
                data: {
                    ...(hasWebsiteUrlOverride && { websiteUrl: websiteUrlOverride ?? null }),
                    ...(hasSitemapUrlOverride && { sitemapUrl: sitemapUrlOverride ?? null }),
                    ...(hasAdditionalUrlsOverride && { additionalUrls: normalizedAdditionalUrls }),
                },
            });
        }

        const effectiveWebsiteUrl = websiteUrlOverride || config.websiteUrl;

        if (!effectiveWebsiteUrl) {
            return NextResponse.json(
                { error: 'No website URL configured for this brand' },
                { status: 400 }
            );
        }

        // If already running, return existing
        const running = await BrandReportEngine.getRunning(configId);
        if (running) {
            return NextResponse.json({
                success: true,
                reportId: running.id,
                status: 'already_running',
            });
        }

        // Generate (blocking — completes before response)
        const reportId = await BrandReportEngine.generate(configId, {
            websiteUrl: effectiveWebsiteUrl,
            sitemapUrl: sitemapUrlOverride,
            additionalUrls: normalizedAdditionalUrls,
        });

        return NextResponse.json({
            success: true,
            reportId,
            status: 'completed',
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to generate report';
        console.error('[POST /api/visibility/brand-report]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * GET /api/visibility/brand-report?configId=xxx
 * Fetch the latest completed report and running status.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('configId');

        if (!configId) {
            return NextResponse.json({ error: 'configId is required' }, { status: 400 });
        }

        // Verify access
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: { id: true, organizationId: true },
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId,
                },
            },
            select: { status: true },
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const [report, running] = await Promise.all([
            BrandReportEngine.getLatest(configId),
            BrandReportEngine.getRunning(configId),
        ]);

        return NextResponse.json({
            report,
            isRunning: !!running,
            runningReportId: running?.id ?? null,
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch report';
        console.error('[GET /api/visibility/brand-report]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

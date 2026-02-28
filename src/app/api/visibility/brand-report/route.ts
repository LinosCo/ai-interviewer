import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { BrandReportEngine } from '@/lib/visibility/brand-report-engine';

/**
 * POST /api/visibility/brand-report
 * Trigger a new brand report generation for a VisibilityConfig.
 *
 * Body: { configId: string }
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
        const { configId } = body;

        if (!configId) {
            return NextResponse.json({ error: 'configId is required' }, { status: 400 });
        }

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

        if (!config.websiteUrl) {
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
        const reportId = await BrandReportEngine.generate(configId);

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

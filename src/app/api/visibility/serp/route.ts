import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { PLANS, PlanType, subscriptionTierToPlanType } from '@/config/plans';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';
import { SubscriptionStatus } from '@prisma/client';

/**
 * GET - Fetch recent SERP monitoring results
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = await resolveActiveOrganizationIdForUser(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Get URL params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const projectId = searchParams.get('projectId');

        const data = await SerpMonitoringEngine.getRecentResults(organizationId, limit, { projectId });

        return NextResponse.json(data);

    } catch (error) {
        console.error('Error fetching SERP results:', error);
        return NextResponse.json(
            { error: 'Failed to fetch SERP results' },
            { status: 500 }
        );
    }
}

/**
 * POST - Run a new SERP monitoring scan
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                role: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const dateRange = body.dateRange || 'last_week';
        const resultType = body.resultType || 'news';
        const projectId = body.projectId;
        const configId = body.configId;

        let config: { id: string; organizationId: string } | null = null;
        if (configId) {
            config = await prisma.visibilityConfig.findUnique({
                where: { id: configId },
                select: { id: true, organizationId: true }
            });
        } else {
            const organizationId = await resolveActiveOrganizationIdForUser(session.user.id);
            if (!organizationId) {
                return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
            }
            try {
                config = await prisma.visibilityConfig.findFirst({
                    where: {
                        organizationId,
                        ...(projectId ? {
                            OR: [
                                { projectId: projectId },
                                { projectShares: { some: { projectId: projectId } } }
                            ]
                        } : {})
                    },
                    select: { id: true, organizationId: true }
                });
            } catch (err: any) {
                if (err?.code !== 'P2021') throw err;
                config = await prisma.visibilityConfig.findFirst({
                    where: {
                        organizationId,
                        ...(projectId ? { projectId } : {})
                    },
                    select: { id: true, organizationId: true }
                });
            }
        }

        if (!config) {
            return NextResponse.json(
                { error: 'Visibility configuration not found. Please set up your visibility tracking first.' },
                { status: 404 }
            );
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId
                }
            },
            select: { status: true }
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: config.organizationId },
            select: {
                plan: true,
                subscription: {
                    select: {
                        status: true,
                        tier: true
                    }
                }
            }
        });

        // Use organization effective plan (admin bypasses)
        const isAdmin = user.role === 'ADMIN' || organization?.plan === PlanType.ADMIN;
        const effectivePlanType =
            organization?.subscription?.status === SubscriptionStatus.TRIALING
                ? PlanType.TRIAL
                : (organization?.subscription?.tier
                    ? subscriptionTierToPlanType(organization.subscription.tier)
                    : ((organization?.plan as PlanType) || PlanType.FREE));
        const plan = PLANS[effectivePlanType] || PLANS[PlanType.FREE];

        // SERP monitoring requires visibility feature (admin bypasses)
        if (!isAdmin && !plan.features.visibilityTracker) {
            return NextResponse.json(
                { error: 'SERP monitoring requires a PRO or higher plan' },
                { status: 403 }
            );
        }

        // Run scan
        const result = await SerpMonitoringEngine.runScan(config.id, dateRange, resultType);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error running SERP scan:', error);
        const message = error instanceof Error ? error.message : 'Failed to run SERP scan';
        const isQuotaExceeded = message.includes('SERP_API_QUOTA_EXCEEDED');
        return NextResponse.json(
            {
                error: isQuotaExceeded
                    ? 'Credito SERP API esaurito. Ricarica/upgrade su SerpAPI per continuare le scansioni.'
                    : message
            },
            { status: isQuotaExceeded ? 429 : 500 }
        );
    }
}

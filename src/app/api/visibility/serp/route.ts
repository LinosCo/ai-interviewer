import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { getOrCreateSubscription } from '@/lib/usage';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';

/**
 * GET - Fetch recent SERP monitoring results
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    take: 1,
                    include: { organization: true }
                }
            }
        });

        if (!user || !user.memberships[0]) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0].organizationId;

        // Get URL params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const data = await SerpMonitoringEngine.getRecentResults(organizationId, limit);

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
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    take: 1,
                    include: { organization: true }
                }
            }
        });

        if (!user || !user.memberships[0]) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0].organizationId;

        // Check subscription tier for SERP monitoring access
        const subscription = await getOrCreateSubscription(organizationId);
        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }

        const planType = subscriptionTierToPlanType(subscription.tier);
        const plan = PLANS[planType];

        // SERP monitoring requires at least PRO plan
        if (plan.limits.visibilityScansPerWeek === 0) {
            return NextResponse.json(
                { error: 'SERP monitoring requires a PRO or higher plan' },
                { status: 403 }
            );
        }

        // Get config
        const config = await prisma.visibilityConfig.findFirst({
            where: { organizationId }
        });

        if (!config) {
            return NextResponse.json(
                { error: 'Visibility configuration not found. Please set up your visibility tracking first.' },
                { status: 404 }
            );
        }

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const dateRange = body.dateRange || 'last_week';

        // Run scan
        const result = await SerpMonitoringEngine.runScan(config.id, dateRange);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error running SERP scan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to run SERP scan' },
            { status: 500 }
        );
    }
}

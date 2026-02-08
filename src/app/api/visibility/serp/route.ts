import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { PLANS, PlanType } from '@/config/plans';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

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
                plan: true,
                role: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = await resolveActiveOrganizationIdForUser(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Use user's plan (admin has unlimited access)
        const isAdmin = user.role === 'ADMIN' || user.plan === 'ADMIN';
        const plan = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];

        // SERP monitoring requires visibility feature (admin bypasses)
        if (!isAdmin && !plan.features.visibilityTracker) {
            return NextResponse.json(
                { error: 'SERP monitoring requires a PRO or higher plan' },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const dateRange = body.dateRange || 'last_week';
        const resultType = body.resultType || 'news';
        const projectId = body.projectId;
        const configId = body.configId;

        // Get config - prioritized by configId, then projectId, then organizationId (fallback)
        const config = await prisma.visibilityConfig.findFirst({
            where: {
                organizationId,
                ...(configId ? { id: configId } : {}),
                ...(projectId ? {
                    OR: [
                        { projectId: projectId },
                        { projectShares: { some: { projectId: projectId } } }
                    ]
                } : {})
            }
        });

        if (!config) {
            return NextResponse.json(
                { error: 'Visibility configuration not found. Please set up your visibility tracking first.' },
                { status: 404 }
            );
        }

        // Run scan
        const result = await SerpMonitoringEngine.runScan(config.id, dateRange, resultType);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error running SERP scan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to run SERP scan' },
            { status: 500 }
        );
    }
}

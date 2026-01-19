import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { VisibilityEngine } from '@/lib/visibility/visibility-engine';
import { getOrCreateSubscription } from '@/lib/usage';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';

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

        // Check plan limits (max scans per month)
        const subscription = await getOrCreateSubscription(organizationId);
        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }
        const planType = subscriptionTierToPlanType(subscription.tier);
        const plan = PLANS[planType];

        const config = await prisma.visibilityConfig.findUnique({
            where: { organizationId },
            include: { organization: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Check weekly scan limit
        // Note: For now we allow scans if visibilityScansPerWeek > 0
        // A more robust implementation would track scans per week in the database
        if (plan.limits.visibilityScansPerWeek === 0) {
            return NextResponse.json(
                { error: 'Visibility scans not available in your plan' },
                { status: 403 }
            );
        }

        // Run the scan
        const result = await VisibilityEngine.runScan(config.id);

        return NextResponse.json({
            success: true,
            scanId: result.scanId,
            partial: result.partial,
            message: result.partial
                ? 'Scan completed with some providers skipped (check API keys).'
                : 'Scan completed successfully.'
        });

    } catch (error) {
        console.error('Error running scan:', error);
        return NextResponse.json(
            { error: 'Failed to run scan' },
            { status: 500 }
        );
    }
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { TokenTrackingService } from '@/services/tokenTrackingService';

/**
 * GET /api/admin/organizations/[orgId]/limits
 * Get organization's usage and limits details
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { orgId } = await params;

        // Get detailed usage stats
        const usageStats = await TokenTrackingService.getUsageStats(orgId);

        // Get organization with subscription
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                subscription: true,
                tokenUsage: true
            }
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        return NextResponse.json({
            organization: {
                id: org.id,
                name: org.name,
                plan: org.plan
            },
            subscription: org.subscription ? {
                tier: org.subscription.tier,
                status: org.subscription.status,
                isPartner: org.subscription.isPartner,
                customLimits: org.subscription.customLimits,
                currentPeriodStart: org.subscription.currentPeriodStart,
                currentPeriodEnd: org.subscription.currentPeriodEnd
            } : null,
            usage: usageStats
        });

    } catch (error) {
        console.error('Error fetching organization limits:', error);
        return NextResponse.json(
            { error: 'Failed to fetch limits' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/organizations/[orgId]/limits
 * Update organization's limits, plan, or grant extras
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { orgId } = await params;
        const body = await request.json();
        const {
            // Plan changes
            plan,
            tier,
            isPartner,

            // Custom limits (override plan defaults)
            customLimits,
            maxInterviews,
            maxChatbots,
            maxProjects,

            // Extra resources (add to plan limits)
            extraTokens,
            extraInterviews,
            extraChatbotSessions,
            extraVisibilityQueries,
            extraUsers,

            // Reset counters
            resetUsage
        } = body;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: { subscription: true }
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Update organization plan if changed
        if (plan && plan !== org.plan) {
            await prisma.organization.update({
                where: { id: orgId },
                data: { plan }
            });
        }

        // Update subscription if exists
        if (org.subscription) {
            const subscriptionUpdate: any = {};

            // Tier change (accept both 'tier' and 'plan' as input)
            if (tier || plan) {
                subscriptionUpdate.tier = tier || plan;
            }

            // Partner flag
            if (typeof isPartner === 'boolean') {
                subscriptionUpdate.isPartner = isPartner;
            }

            // Custom limits (merge with existing)
            if (customLimits !== undefined) {
                subscriptionUpdate.customLimits = customLimits;
            } else if (maxInterviews !== undefined || maxChatbots !== undefined || maxProjects !== undefined) {
                // Build custom limits from individual fields
                const existingLimits = (org.subscription.customLimits as any) || {};
                subscriptionUpdate.customLimits = {
                    ...existingLimits,
                    ...(maxInterviews !== undefined && { maxInterviews }),
                    ...(maxChatbots !== undefined && { maxChatbots }),
                    ...(maxProjects !== undefined && { maxProjects })
                };
            }

            // Extra resources
            if (typeof extraTokens === 'number') {
                subscriptionUpdate.extraTokens = extraTokens;
            }
            if (typeof extraInterviews === 'number') {
                subscriptionUpdate.extraInterviews = extraInterviews;
            }
            if (typeof extraChatbotSessions === 'number') {
                subscriptionUpdate.extraChatbotSessions = extraChatbotSessions;
            }
            if (typeof extraVisibilityQueries === 'number') {
                subscriptionUpdate.extraVisibilityQueries = extraVisibilityQueries;
            }
            if (typeof extraUsers === 'number') {
                subscriptionUpdate.extraUsers = extraUsers;
            }

            if (Object.keys(subscriptionUpdate).length > 0) {
                await prisma.subscription.update({
                    where: { id: org.subscription.id },
                    data: subscriptionUpdate
                });
            }
        }

        // Reset usage counters if requested
        if (resetUsage) {
            await TokenTrackingService.resetMonthlyCounters(orgId);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error updating organization limits:', error);
        return NextResponse.json(
            { error: 'Failed to update limits' },
            { status: 500 }
        );
    }
}

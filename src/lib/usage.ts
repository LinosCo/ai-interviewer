import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@prisma/client';
import { PRICING_PLANS, PlanKey } from './stripe';

// Get or create subscription for an organization
export async function getOrCreateSubscription(organizationId: string) {
    let subscription = await prisma.subscription.findUnique({
        where: { organizationId }
    });

    if (!subscription) {
        // Create default free subscription
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        subscription = await prisma.subscription.create({
            data: {
                organizationId,
                tier: 'FREE',
                status: 'ACTIVE',
                maxActiveBots: PRICING_PLANS.FREE.features.maxActiveBots,
                maxInterviewsPerMonth: PRICING_PLANS.FREE.features.maxInterviewsPerMonth,
                maxUsers: PRICING_PLANS.FREE.features.maxUsers,
                currentPeriodStart: now,
                currentPeriodEnd: endOfMonth,
            }
        });
    }

    return subscription;
}

// Check if user can create/publish a new bot
export async function canPublishBot(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);

    // Unlimited bots for Business/Enterprise
    if (subscription.maxActiveBots === -1) {
        return { allowed: true };
    }

    const activeBotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            status: 'PUBLISHED'
        }
    });

    if (activeBotsCount >= subscription.maxActiveBots) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${subscription.maxActiveBots} interviste attive per il piano ${subscription.tier}. Effettua l'upgrade per pubblicarne altre.`
        };
    }

    return { allowed: true };
}

// Check if an interview can be completed (usage limit)
export async function canCompleteInterview(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);

    // Unlimited for Enterprise
    if (subscription.maxInterviewsPerMonth === -1) {
        return { allowed: true };
    }

    if (subscription.interviewsUsedThisMonth >= subscription.maxInterviewsPerMonth) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${subscription.maxInterviewsPerMonth} risposte per questo mese. Effettua l'upgrade per continuare.`
        };
    }

    return { allowed: true };
}

// Record an interview completion
export async function recordInterviewCompleted(organizationId: string, conversationId: string) {
    await prisma.$transaction([
        prisma.subscription.update({
            where: { organizationId },
            data: { interviewsUsedThisMonth: { increment: 1 } }
        }),
        prisma.usageEvent.create({
            data: {
                organizationId,
                eventType: 'INTERVIEW_COMPLETED',
                resourceId: conversationId
            }
        })
    ]);
}

// Record bot publish event
export async function recordBotPublished(organizationId: string, botId: string) {
    await prisma.usageEvent.create({
        data: {
            organizationId,
            eventType: 'BOT_PUBLISHED',
            resourceId: botId
        }
    });
}

// Get current usage stats
export async function getUsageStats(organizationId: string) {
    const subscription = await getOrCreateSubscription(organizationId);

    const activeBotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            status: 'PUBLISHED'
        }
    });

    const usersCount = await prisma.membership.count({
        where: { organizationId }
    });

    return {
        tier: subscription.tier,
        activeBots: {
            used: activeBotsCount,
            limit: subscription.maxActiveBots,
            percentage: subscription.maxActiveBots > 0
                ? Math.round((activeBotsCount / subscription.maxActiveBots) * 100)
                : 0
        },
        interviews: {
            used: subscription.interviewsUsedThisMonth,
            limit: subscription.maxInterviewsPerMonth,
            percentage: subscription.maxInterviewsPerMonth > 0
                ? Math.round((subscription.interviewsUsedThisMonth / subscription.maxInterviewsPerMonth) * 100)
                : 0
        },
        users: {
            used: usersCount,
            limit: subscription.maxUsers,
            percentage: subscription.maxUsers > 0
                ? Math.round((usersCount / subscription.maxUsers) * 100)
                : 0
        },
        currentPeriodEnd: subscription.currentPeriodEnd
    };
}

// Reset monthly usage (called by cron job)
export async function resetMonthlyUsage() {
    const now = new Date();
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await prisma.subscription.updateMany({
        where: {
            currentPeriodEnd: { lte: now }
        },
        data: {
            interviewsUsedThisMonth: 0,
            currentPeriodStart: now,
            currentPeriodEnd: endOfNextMonth
        }
    });
}

// Upgrade subscription tier
export async function upgradeSubscription(
    organizationId: string,
    newTier: PlanKey,
    stripeData?: { customerId: string; subscriptionId: string; priceId: string }
) {
    const limits = PRICING_PLANS[newTier].features;

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            tier: newTier as SubscriptionTier,
            maxActiveBots: limits.maxActiveBots,
            maxInterviewsPerMonth: limits.maxInterviewsPerMonth,
            maxUsers: limits.maxUsers,
            ...(stripeData && {
                stripeCustomerId: stripeData.customerId,
                stripeSubscriptionId: stripeData.subscriptionId,
                stripePriceId: stripeData.priceId
            })
        }
    });
}

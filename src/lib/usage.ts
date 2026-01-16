import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@prisma/client';
import { getPricingPlans, PlanKey } from './stripe';
import { generateConversationInsightAction } from '@/lib/analytics-actions';

// Get or create subscription for an organization
export async function getOrCreateSubscription(organizationId: string) {
    if (!organizationId) return null;
    let subscription = await prisma.subscription.findUnique({
        where: { organizationId }
    });

    if (!subscription) {
        // Create default free subscription
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const plans = await getPricingPlans();

        subscription = await prisma.subscription.create({
            data: {
                organizationId,
                tier: 'FREE',
                status: 'ACTIVE',
                maxActiveBots: plans.FREE.features.maxActiveBots,
                maxInterviewsPerMonth: plans.FREE.features.maxInterviewsPerMonth,
                maxUsers: plans.FREE.features.maxUsers,
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
    if (!subscription) return { allowed: true }; // Fallback if no org/subscription found

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

export async function canCreateChatbot(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) return { allowed: true };

    const plans = await getPricingPlans();
    // @ts-ignore - access hidden limits
    const limit = plans[subscription.tier]?.limits?.maxActiveChatbots;

    // undefined means unlimited (legacy/fallback), -1 means unlimited
    if (limit === undefined || limit === -1) {
        return { allowed: true };
    }

    if (limit === 0) {
        return {
            allowed: false,
            reason: `Il tuo piano ${subscription.tier} non include la creazione di Chatbot AI. Passa a PRO per sbloccarla.`
        };
    }

    const activeChatbotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            botType: 'chatbot',
            status: { not: 'ARCHIVED' } // Consider all non-archived bots as taking a "slot" or just PUBLISHED? User said "created", implies existing. Safe to assume non-archived.
        }
    });

    if (activeChatbotsCount >= limit) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${limit} Chatbot per il piano ${subscription.tier}. Effettua l'upgrade per crearne altri.`
        };
    }

    return { allowed: true };
}

// Check if an interview can be completed (usage limit)
export async function canStartInterview(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) return { allowed: true };

    // Unlimited for Enterprise
    if (subscription.maxInterviewsPerMonth === -1) {
        return { allowed: true };
    }

    if (subscription.interviewsUsedThisMonth >= subscription.maxInterviewsPerMonth) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${subscription.maxInterviewsPerMonth} interviste per questo mese. Effettua l'upgrade per continuare.`
        };
    }

    return { allowed: true };
}

// Record an interview completion
export async function recordInterviewCompleted(organizationId: string, conversationId: string) {
    // Check if already completed to avoid double counting
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { status: true }
    });

    if (conversation?.status === 'COMPLETED') return;

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
        }),
        prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date()
            }
        })
    ]);
}

// Robust completion helper
export async function markInterviewAsCompleted(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { bot: { include: { project: true } } }
    });

    if (!conversation || conversation.status === 'COMPLETED') return;

    const organizationId = conversation.bot.project.organizationId;
    if (organizationId) {
        await recordInterviewCompleted(organizationId, conversationId);

        // Trigger Analysis if not already done
        try {
            // Use imported action
            await generateConversationInsightAction(conversationId);
        } catch (e) {
            console.error("Auto-analysis failed during completion", e);
        }
    }
}

// Check if an interview should be concluded based on limits
export async function checkInterviewStatus(conversationId: string): Promise<{ shouldConclude: boolean; reason?: 'TIME' | 'TURNS' }> {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            bot: true,
            messages: { where: { role: 'assistant' } }
        }
    });

    if (!conversation) return { shouldConclude: false };
    if (conversation.status === 'COMPLETED') return { shouldConclude: true };

    const { bot, effectiveDuration, messages } = conversation;

    // 1. Time Limit (Effective Duration)
    const maxDurationSeconds = (bot.maxDurationMins || 10) * 60;
    if (effectiveDuration && effectiveDuration >= maxDurationSeconds) {
        return { shouldConclude: true, reason: 'TIME' };
    }

    // 2. Turn Limit (Fair Usage)
    const maxTurns = bot.maxTurns || 40;
    if (messages.length >= maxTurns) {
        return { shouldConclude: true, reason: 'TURNS' };
    }

    return { shouldConclude: false };
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
    if (!subscription) throw new Error("Subscription not found");

    const activeBotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            status: 'PUBLISHED'
        }
    });

    const usersCount = await prisma.membership.count({
        where: { organizationId }
    });

    const tokenUsage = await (prisma as any).tokenUsage.findUnique({
        where: { organizationId }
    });

    // Get limits for plan
    const plans = await getPricingPlans();
    // @ts-ignore
    const planLimits = plans[subscription.tier]?.limits || plans.FREE.limits;
    const monthlyTokenBudget = planLimits.monthlyTokenBudget || 50000;

    const usedTokens = tokenUsage?.usedTokens || 0;
    const purchasedTokens = tokenUsage?.purchasedTokens || 0;
    const totalLimit = monthlyTokenBudget + purchasedTokens;

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
        tokens: {
            used: usedTokens,
            limit: totalLimit,
            purchased: purchasedTokens,
            monthlyBudget: monthlyTokenBudget,
            percentage: totalLimit > 0
                ? Math.round((usedTokens / totalLimit) * 100)
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
    const plans = await getPricingPlans();
    const limits = plans[newTier].features;

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
// Check if a specific feature is enabled for an organization
export async function isFeatureEnabled(organizationId: string, featureKey: string): Promise<boolean> {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) return false;

    // Enterprise/Business has everything
    if (subscription.tier === 'BUSINESS' || subscription.tier === 'ENTERPRISE') return true;

    const plans = await getPricingPlans();
    const planFeatures = (plans[subscription.tier as PlanKey] as any)?.features || {};

    return !!planFeatures[featureKey];
}

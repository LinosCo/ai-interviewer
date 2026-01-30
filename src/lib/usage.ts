import { prisma } from '@/lib/prisma';
import { SubscriptionTier } from '@prisma/client';
import { getPricingPlans, PlanKey } from './stripe';
import { generateConversationInsightAction } from '@/lib/analytics-actions';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';

// Get or create subscription for an organization
export async function getOrCreateSubscription(organizationId: string) {
    if (!organizationId) return null;
    let subscription = await prisma.subscription.findUnique({
        where: { organizationId }
    });

    if (!subscription) {
        // Create default TRIAL
        const now = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);

        subscription = await prisma.subscription.create({
            data: {
                organizationId,
                tier: 'TRIAL',
                status: 'TRIALING',
                currentPeriodStart: now,
                currentPeriodEnd: trialEnd,
                trialEndsAt: trialEnd,
            }
        });
    }

    return subscription;
}

// Get limits for a subscription from plan config
export async function getSubscriptionLimits(subscription: { tier: SubscriptionTier; customLimits?: any }) {
    const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
    const limits = plan.limits;

    return {
        maxActiveBots: limits.maxChatbots,
        maxInterviewsPerMonth: limits.maxInterviewsPerMonth,
        maxVisibilityQueriesPerMonth: limits.maxVisibilityQueriesPerMonth,
        maxAiSuggestionsPerMonth: limits.maxAiSuggestionsPerMonth,
        monthlyTokenBudget: limits.monthlyTokenBudget,
        maxProjects: plan.features.maxProjects,
        visibilityEnabled: plan.features.visibilityTracker,
        cmsEnabled: plan.features.cmsIntegrations,
        chatbotEnabled: plan.features.chatbot,
        aiTipsEnabled: plan.features.aiTips,
        whiteLabelingEnabled: plan.features.whiteLabel === true || plan.features.whiteLabel === 'conditional'
    };
}

// Subscription status check helper
export function checkSubscriptionValid(subscription: any): { allowed: boolean; reason?: string } {
    if (subscription.status === 'PAST_DUE') {
        return { allowed: false, reason: 'Il tuo abbonamento è scaduto o il pagamento è fallito. Aggiorna i dati di fatturazione.' };
    }
    if (subscription.status === 'TRIALING' && subscription.currentPeriodEnd < new Date()) {
        return { allowed: false, reason: 'La tua prova gratuita è terminata. Attiva un piano per continuare.' };
    }
    if (subscription.status === 'CANCELED') {
        return { allowed: false, reason: 'Il tuo abbonamento è stato annullato.' };
    }
    return { allowed: true };
}

// Check if user can create/publish a new bot
export async function canPublishBot(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) return { allowed: true };

    const statusCheck = checkSubscriptionValid(subscription);
    if (!statusCheck.allowed) return statusCheck;

    const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
    const limit = plan.limits.maxChatbots;

    if (isUnlimited(limit)) {
        return { allowed: true };
    }

    const activeBotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            status: 'PUBLISHED'
        }
    });

    if (activeBotsCount >= limit) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${limit} bot attivi per il piano ${subscription.tier}. Effettua l'upgrade per pubblicarne altri.`
        };
    }

    return { allowed: true };
}

export async function canCreateChatbot(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    return canPublishBot(organizationId); // Simplification for now, using the same logic as publish
}

// Check if an interview can be completed (usage limit)
export async function canStartInterview(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) return { allowed: true };

    const statusCheck = checkSubscriptionValid(subscription);
    if (!statusCheck.allowed) return statusCheck;

    const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
    const limit = plan.limits.maxInterviewsPerMonth;
    const extra = subscription.extraInterviews || 0;
    const totalAllowed = isUnlimited(limit) ? -1 : limit + extra;

    if (!isUnlimited(totalAllowed) && subscription.interviewsUsedThisMonth >= totalAllowed) {
        return {
            allowed: false,
            reason: `Hai raggiunto il limite di ${totalAllowed} interviste per questo mese. Effettua l'upgrade o acquista pacchetti extra per continuare.`
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

    const maxDurationSeconds = (bot.maxDurationMins || 10) * 60;
    if (effectiveDuration && effectiveDuration >= maxDurationSeconds) {
        return { shouldConclude: true, reason: 'TIME' };
    }

    const maxTurns = bot.maxTurns || 40;
    if (messages.length >= maxTurns) {
        return { shouldConclude: true, reason: 'TURNS' };
    }

    return { shouldConclude: false };
}

// Get current usage stats
export async function getUsageStats(organizationId: string) {
    const subscription = await getOrCreateSubscription(organizationId);
    if (!subscription) throw new Error("Subscription not found");

    const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
    const limits = plan.limits;

    const activeBotsCount = await prisma.bot.count({
        where: {
            project: { organizationId },
            status: 'PUBLISHED'
        }
    });

    const usersCount = await prisma.membership.count({
        where: { organizationId }
    });

    const usedTokens = subscription.tokensUsedThisMonth;
    const limitTokens = limits.monthlyTokenBudget;
    const extraTokens = subscription.extraTokens || 0;
    const totalTokenLimit = isUnlimited(limitTokens) ? -1 : limitTokens + extraTokens;

    const interviewLimit = limits.maxInterviewsPerMonth;
    const extraInterviews = subscription.extraInterviews || 0;
    const totalInterviewLimit = isUnlimited(interviewLimit) ? -1 : interviewLimit + extraInterviews;

    return {
        tier: subscription.tier,
        activeBots: {
            used: activeBotsCount,
            limit: limits.maxChatbots,
            percentage: !isUnlimited(limits.maxChatbots) && limits.maxChatbots > 0
                ? Math.round((activeBotsCount / limits.maxChatbots) * 100)
                : 0
        },
        interviews: {
            used: subscription.interviewsUsedThisMonth,
            limit: totalInterviewLimit,
            percentage: !isUnlimited(totalInterviewLimit) && totalInterviewLimit > 0
                ? Math.round((subscription.interviewsUsedThisMonth / totalInterviewLimit) * 100)
                : 0
        },
        tokens: {
            used: usedTokens,
            limit: totalTokenLimit,
            percentage: !isUnlimited(totalTokenLimit) && totalTokenLimit > 0
                ? Math.round((usedTokens / totalTokenLimit) * 100)
                : 0
        },
        currentPeriodEnd: subscription.currentPeriodEnd
    };
}

// Reset monthly usage (called by cron job or invoice paid)
export async function resetMonthlyUsage(organizationId?: string) {
    const now = new Date();
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const updateData = {
        // Main usage counters
        interviewsUsedThisMonth: 0,
        tokensUsedThisMonth: 0,
        chatbotSessionsUsedThisMonth: 0,
        visibilityQueriesUsedThisMonth: 0,
        aiSuggestionsUsedThisMonth: 0,
        // Token breakdown by category
        interviewTokensUsed: 0,
        chatbotTokensUsed: 0,
        visibilityTokensUsed: 0,
        suggestionTokensUsed: 0,
        systemTokensUsed: 0,
        // Period dates
        currentPeriodStart: now,
        currentPeriodEnd: endOfNextMonth
    };

    if (organizationId) {
        await prisma.subscription.update({
            where: { organizationId },
            data: updateData
        });
    } else {
        await prisma.subscription.updateMany({
            where: {
                currentPeriodEnd: { lte: now }
            },
            data: updateData
        });
    }
}

// Upgrade subscription tier
export async function upgradeSubscription(
    organizationId: string,
    newTier: PlanKey,
    stripeData?: { customerId: string; subscriptionId: string; priceId: string }
) {
    await prisma.subscription.update({
        where: { organizationId },
        data: {
            tier: newTier as SubscriptionTier,
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

    const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];

    // Check in features first
    // @ts-ignore
    if (plan.features[featureKey] !== undefined) {
        // @ts-ignore
        const value = plan.features[featureKey];
        if (typeof value === 'boolean') return value;
        if (value === 'base' || value === 'full' || value === 'conditional') return true;
    }

    // Then check in limits (legacy/derived)
    // @ts-ignore
    return !!plan.limits[featureKey];
}

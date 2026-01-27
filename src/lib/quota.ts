import { prisma } from "@/lib/prisma";
import { PLANS, isUnlimited, PlanType } from "@/config/plans";

export async function checkQuota(
    orgId: string,
    resource: 'interviews' | 'chatbot' | 'visibility' | 'suggestions'
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {

    const sub = await prisma.subscription.findUnique({
        where: { organizationId: orgId }
    });

    if (!sub) throw new Error("Subscription not found");

    const plan = PLANS[sub.tier as PlanType] || PLANS[PlanType.FREE];

    let used = 0;
    let limit = 0;
    let extra = 0;

    switch (resource) {
        case 'interviews':
            used = sub.interviewsUsedThisMonth;
            limit = plan.limits.maxInterviewsPerMonth;
            extra = sub.extraInterviews || 0;
            break;
        case 'chatbot':
            used = sub.chatbotSessionsUsedThisMonth;
            limit = plan.limits.maxChatbotSessionsPerMonth;
            extra = sub.extraChatbotSessions || 0;
            break;
        case 'visibility':
            used = sub.visibilityQueriesUsedThisMonth;
            limit = plan.limits.maxVisibilityQueriesPerMonth;
            extra = sub.extraVisibilityQueries || 0;
            break;
        case 'suggestions':
            used = sub.aiSuggestionsUsedThisMonth;
            limit = plan.limits.maxAiSuggestionsPerMonth;
            extra = sub.extraAiSuggestions || 0;
            break;
    }

    const totalLimit = isUnlimited(limit) ? -1 : limit + extra;
    const remaining = isUnlimited(totalLimit) ? Infinity : Math.max(0, totalLimit - used);
    const allowed = isUnlimited(totalLimit) ? true : used < totalLimit;

    return {
        allowed,
        remaining,
        limit: isUnlimited(totalLimit) ? -1 : totalLimit,
        used
    };
}

export async function checkStaticLimit(
    orgId: string,
    limitType: 'maxActiveBots'
): Promise<{ allowed: boolean; limit: number; current: number }> {
    const sub = await prisma.subscription.findUnique({
        where: { organizationId: orgId }
    });

    if (!sub) throw new Error("Subscription not found");

    const plan = PLANS[sub.tier as PlanType] || PLANS[PlanType.FREE];

    let limit = 0;
    let current = 0;

    if (limitType === 'maxActiveBots') {
        limit = plan.limits.maxChatbots;
        current = await prisma.bot.count({
            where: {
                project: { organizationId: orgId },
                status: 'PUBLISHED'
            }
        });
    }

    const totalLimit = isUnlimited(limit) ? -1 : limit;

    return {
        allowed: isUnlimited(totalLimit) ? true : current < totalLimit,
        limit: totalLimit,
        current
    };
}

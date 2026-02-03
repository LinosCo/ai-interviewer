import { PlanConfig, PlanLimits, PLANS } from '@/config/plans';
import { HIDDEN_LIMITS } from '@/config/limits';
import { prisma as db } from '@/lib/prisma';

export class PlanService {

    async getOrganizationPlan(orgId: string): Promise<PlanConfig> {
        const org = await db.organization.findUnique({
            where: { id: orgId }
        });

        if (!org) throw new Error('Organization not found');

        const planKey = org.plan.toLowerCase() as keyof typeof PLANS;
        const basePlan = PLANS[planKey];

        // Merge con custom limits se presenti (enterprise)
        if (org.customLimits) {
            return {
                ...basePlan,
                limits: { ...basePlan.limits, ...(org.customLimits as any) }
            };
        }

        return basePlan;
    }

    async checkFeatureAccess(
        orgId: string,
        feature: keyof PlanLimits
    ): Promise<boolean> {
        const plan = await this.getOrganizationPlan(orgId);
        const value = plan.limits[feature];
        // Boolean features should return true/false, numeric features check if > 0
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        return false;
    }

    async checkResponseLimit(orgId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        remaining: number;
    }> {
        const subscription = await db.subscription.findUnique({
            where: { organizationId: orgId }
        });

        if (!subscription) throw new Error('Subscription not found');

        const planKey = subscription.tier as keyof typeof PLANS;
        const plan = PLANS[planKey] || PLANS.FREE;
        const used = subscription.interviewsUsedThisMonth;
        const limit = plan.limits.maxInterviewsPerMonth;

        // -1 means unlimited
        if (limit === -1) {
            return { allowed: true, used, limit: -1, remaining: Infinity };
        }

        return {
            allowed: used < limit,
            used,
            limit,
            remaining: Math.max(0, limit - used)
        };
    }

    async checkActiveInterviewsLimit(orgId: string): Promise<{
        allowed: boolean;
        current: number;
        limit: number;
    }> {
        const plan = await this.getOrganizationPlan(orgId);

        const activeCount = await db.bot.count({
            where: {
                project: {
                    organizationId: orgId
                },
                status: 'PUBLISHED'
            }
        });

        const limit = plan.limits.maxChatbots;

        // -1 = illimitate
        if (limit === -1) {
            return { allowed: true, current: activeCount, limit: -1 };
        }

        return {
            allowed: activeCount < limit,
            current: activeCount,
            limit
        };
    }

    async getHiddenLimits(orgId: string) {
        const org = await db.organization.findUnique({
            where: { id: orgId }
        });

        if (!org) throw new Error('Organization not found');

        const planKey = org.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.conversation;
        return HIDDEN_LIMITS.conversation[planKey];
    }

    async incrementResponseCount(orgId: string): Promise<void> {
        await db.subscription.update({
            where: { organizationId: orgId },
            data: {
                interviewsUsedThisMonth: { increment: 1 }
            }
        });
    }

    async resetMonthlyCounters(): Promise<void> {
        // Chiamato da cron job mensile
        await db.subscription.updateMany({
            data: {
                interviewsUsedThisMonth: 0,
                chatbotSessionsUsedThisMonth: 0,
                visibilityQueriesUsedThisMonth: 0,
                aiSuggestionsUsedThisMonth: 0
            }
        });
    }
}

export const planService = new PlanService();

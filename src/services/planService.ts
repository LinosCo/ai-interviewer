import { PlanType, PlanConfig, PlanFeatures } from '@/config/plans';
import { PLANS } from '@/config/plans';
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
        feature: keyof PlanFeatures
    ): Promise<boolean> {
        const plan = await this.getOrganizationPlan(orgId);
        return plan.features[feature] === true;
    }

    async checkResponseLimit(orgId: string): Promise<{
        allowed: boolean;
        used: number;
        limit: number;
        remaining: number;
    }> {
        const org = await db.organization.findUnique({
            where: { id: orgId }
        });

        if (!org) throw new Error('Organization not found');

        const planKey = org.plan.toLowerCase() as keyof typeof PLANS;
        const plan = PLANS[planKey];
        const used = org.responsesUsedThisMonth;
        const limit = plan.responsesPerMonth;

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

        const limit = plan.activeInterviews;

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
        await db.organization.update({
            where: { id: orgId },
            data: {
                responsesUsedThisMonth: { increment: 1 }
            }
        });
    }

    async resetMonthlyCounters(): Promise<void> {
        // Chiamato da cron job mensile
        await db.organization.updateMany({
            data: {
                responsesUsedThisMonth: 0,
                monthlyResetDate: new Date()
            }
        });
    }
}

export const planService = new PlanService();

import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type TrialResourceType = 'interview' | 'chatbot' | 'brand';

const TRIAL_RESOURCE_LIMITS: Record<TrialResourceType, number> = {
    interview: 1,
    chatbot: 1,
    brand: 1
};

const TRIAL_RESOURCE_LABELS: Record<TrialResourceType, string> = {
    interview: 'intervista',
    chatbot: 'chatbot',
    brand: 'brand'
};

export function normalizeBotTypeForTrialLimit(botType?: string | null): 'interview' | 'chatbot' {
    const normalized = (botType || '').trim().toLowerCase();
    return normalized === 'chatbot' ? 'chatbot' : 'interview';
}

export async function isTrialOrganization(organizationId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        select: { status: true, tier: true }
    });

    if (!subscription) return false;
    return subscription.status === SubscriptionStatus.TRIALING || subscription.tier === SubscriptionTier.TRIAL;
}

async function getTrialResourceUsage(organizationId: string, resource: TrialResourceType): Promise<number> {
    switch (resource) {
        case 'chatbot':
            return prisma.bot.count({
                where: {
                    project: { organizationId },
                    botType: 'chatbot'
                }
            });
        case 'interview':
            return prisma.bot.count({
                where: {
                    project: { organizationId },
                    OR: [
                        { botType: 'interview' },
                        { botType: 'interviewer' }
                    ]
                }
            });
        case 'brand':
            return prisma.visibilityConfig.count({
                where: { organizationId }
            });
        default:
            return 0;
    }
}

export async function checkTrialResourceLimit(params: {
    organizationId: string;
    resource: TrialResourceType;
}): Promise<{ allowed: boolean; reason?: string; limit: number; current: number; isTrial: boolean }> {
    const { organizationId, resource } = params;
    const limit = TRIAL_RESOURCE_LIMITS[resource];
    const isTrial = await isTrialOrganization(organizationId);

    if (!isTrial) {
        return { allowed: true, limit, current: 0, isTrial: false };
    }

    const current = await getTrialResourceUsage(organizationId, resource);
    if (current >= limit) {
        return {
            allowed: false,
            reason: `Nel piano di prova puoi creare al massimo ${limit} ${TRIAL_RESOURCE_LABELS[resource]}.`,
            limit,
            current,
            isTrial: true
        };
    }

    return { allowed: true, limit, current, isTrial: true };
}

export async function checkIntegrationCreationAllowed(organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    const isTrial = await isTrialOrganization(organizationId);
    if (isTrial) {
        return {
            allowed: false,
            reason: 'Le integrazioni non sono disponibili durante il periodo di prova.'
        };
    }

    return { allowed: true };
}

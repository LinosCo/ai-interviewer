import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';
import { TokenCategory } from '@prisma/client';

export class TokenTrackingService {
    /**
     * Registra il consumo di token e aggiorna i contatori della subscription
     */
    static async logTokenUsage(params: {
        organizationId: string;
        userId?: string;
        tokens: number;
        category: TokenCategory;
        model: string;
        description: string;
        metadata?: any;
    }) {
        const { organizationId, userId, tokens, category, model, description, metadata } = params;

        return await prisma.$transaction(async (tx) => {
            // 1. Crea il log dettagliato
            await tx.tokenLog.create({
                data: {
                    organizationId,
                    userId,
                    tokens,
                    category,
                    model,
                    description,
                    metadata: metadata || {}
                }
            });

            // 2. Aggiorna i contatori nella subscription
            const subscription = await tx.subscription.findUnique({
                where: { organizationId }
            });

            if (!subscription) return;

            const updateData: any = {
                tokensUsedThisMonth: { increment: tokens }
            };

            // Aggiorna contatore di categoria specifico
            const categoryFieldMap: Record<string, string> = {
                INTERVIEW: 'interviewTokensUsed',
                CHATBOT: 'chatbotTokensUsed',
                VISIBILITY: 'visibilityTokensUsed',
                SUGGESTION: 'suggestionTokensUsed',
                SYSTEM: 'systemTokensUsed'
            };

            const categoryField = categoryFieldMap[category];
            if (categoryField) {
                updateData[categoryField] = { increment: tokens };
            }

            await tx.subscription.update({
                where: { id: subscription.id },
                data: updateData
            });
        });
    }

    /**
     * Registra l'uso di una risorsa (intervista, sessione, ecc.)
     */
    static async logResourceUsage(params: {
        organizationId: string;
        type: 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION';
    }) {
        const { organizationId, type } = params;

        const fieldMap: Record<string, string> = {
            INTERVIEW: 'interviewsUsedThisMonth',
            CHATBOT_SESSION: 'chatbotSessionsUsedThisMonth',
            VISIBILITY_QUERY: 'visibilityQueriesUsedThisMonth',
            AI_SUGGESTION: 'aiSuggestionsUsedThisMonth'
        };

        const field = fieldMap[type];
        if (!field) return;

        return await prisma.subscription.update({
            where: { organizationId },
            data: {
                [field]: { increment: 1 }
            }
        });
    }

    /**
     * Verifica se l'organizzazione ha risorse disponibili
     */
    static async checkCanUseResource(params: {
        organizationId: string;
        resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION';
        tokensNeeded?: number;
    }): Promise<{ allowed: boolean; reason?: string }> {
        const { organizationId, resourceType, tokensNeeded = 0 } = params;

        const subscription = await prisma.subscription.findUnique({
            where: { organizationId }
        });

        if (!subscription) {
            return { allowed: false, reason: 'Nessun abbonamento trovato.' };
        }

        if (subscription.status === 'PAST_DUE') {
            return { allowed: false, reason: 'Pagamento scaduto. Controlla il tuo abbonamento.' };
        }

        const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
        const limits = plan.limits;

        // Verifica token
        if (resourceType === 'TOKENS') {
            const limit = limits.monthlyTokenBudget;
            const extra = subscription.extraTokens;
            const totalAvailable = isUnlimited(limit) ? -1 : limit + extra;

            if (!isUnlimited(totalAvailable) && subscription.tokensUsedThisMonth + tokensNeeded > totalAvailable) {
                return { allowed: false, reason: 'Budget token esaurito.' };
            }
        }

        // Verifica altre risorse
        const mapping: Record<string, { used: number; limit: number; extra: number }> = {
            INTERVIEW: {
                used: subscription.interviewsUsedThisMonth,
                limit: limits.maxInterviewsPerMonth,
                extra: subscription.extraInterviews
            },
            CHATBOT_SESSION: {
                used: subscription.chatbotSessionsUsedThisMonth,
                limit: limits.maxChatbotSessionsPerMonth,
                extra: subscription.extraChatbotSessions
            },
            VISIBILITY_QUERY: {
                used: subscription.visibilityQueriesUsedThisMonth,
                limit: limits.maxVisibilityQueriesPerMonth,
                extra: subscription.extraVisibilityQueries
            },
            AI_SUGGESTION: {
                used: subscription.aiSuggestionsUsedThisMonth,
                limit: limits.maxAiSuggestionsPerMonth,
                extra: subscription.extraAiSuggestions
            }
        };

        const res = mapping[resourceType];
        if (res) {
            const totalAllowed = isUnlimited(res.limit) ? -1 : res.limit + res.extra;
            if (!isUnlimited(totalAllowed) && res.used >= totalAllowed) {
                return { allowed: false, reason: `Limite ${resourceType.toLowerCase()} raggiunto.` };
            }
        }

        return { allowed: true };

    /**
     * Ottiene statistiche globali della piattaforma (per admin)
     */
    static async getGlobalStats() {
        const [
            totalOrganizations,
            totalTokensUsed,
            totalInterviews,
            totalChatbotSessions,
            recentLogs
        ] = await Promise.all([
            prisma.organization.count(),
            prisma.subscription.aggregate({ _sum: { tokensUsedThisMonth: true } }),
            prisma.subscription.aggregate({ _sum: { interviewsUsedThisMonth: true } }),
            prisma.subscription.aggregate({ _sum: { chatbotSessionsUsedThisMonth: true } }),
            prisma.tokenLog.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: { organization: { select: { name: true } } }
            })
        ]);

        const organizations = await prisma.organization.findMany({
            include: { subscription: true }
        });

        const byTier: Record<string, number> = {};
        organizations.forEach(org => {
            const tier = org.subscription?.tier || 'FREE';
            byTier[tier] = (byTier[tier] || 0) + 1;
        });

        return {
            totalOrganizations,
            totalTokensUsed: totalTokensUsed._sum.tokensUsedThisMonth || 0,
            totalInterviews: totalInterviews._sum.interviewsUsedThisMonth || 0,
            totalChatbotSessions: totalChatbotSessions._sum.chatbotSessionsUsedThisMonth || 0,
            byTier,
            recentLogs
        };
    }

    /**
     * Ottiene statistiche di utilizzo per una specifica organizzazione
     */
    static async getUsageStats(organizationId: string) {
        const sub = await prisma.subscription.findUnique({
            where: { organizationId }
        });

        if (!sub) return null;

        const plan = PLANS[sub.tier as PlanType] || PLANS[PlanType.FREE];

        return {
            tokens: {
                used: sub.tokensUsedThisMonth,
                limit: plan.limits.monthlyTokenBudget,
                extra: sub.extraTokens
            },
            interviews: {
                used: sub.interviewsUsedThisMonth,
                limit: plan.limits.maxInterviewsPerMonth,
                extra: sub.extraInterviews
            },
            chatbot: {
                used: sub.chatbotSessionsUsedThisMonth,
                limit: plan.limits.maxChatbotSessionsPerMonth,
                extra: sub.extraChatbotSessions
            }
        };
    }

    /**
     * Resetta i contatori mensili (per admin o webhook)
     */
    static async resetMonthlyCounters(organizationId: string) {
        return await prisma.subscription.update({
            where: { organizationId },
            data: {
                tokensUsedThisMonth: 0,
                interviewsUsedThisMonth: 0,
                chatbotSessionsUsedThisMonth: 0,
                visibilityQueriesUsedThisMonth: 0,
                aiSuggestionsUsedThisMonth: 0,
                interviewTokensUsed: 0,
                chatbotTokensUsed: 0,
                visibilityTokensUsed: 0,
                suggestionTokensUsed: 0,
                systemTokensUsed: 0
            }
        });
    }
}

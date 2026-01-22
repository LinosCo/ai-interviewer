import { prisma } from '@/lib/prisma';
import { PLANS, subscriptionTierToPlanType, isUnlimited, PlanType } from '@/config/plans';
import { TokenCategory, AddOnType, SubscriptionTier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type OperationType =
    | 'interview_message'
    | 'chatbot_reply'
    | 'visibility_scan'
    | 'visibility_query'
    | 'ai_suggestion'
    | 'ai_tips'
    | 'system';

export type ResourceType =
    | 'interviews'
    | 'chatbotSessions'
    | 'visibilityQueries'
    | 'aiSuggestions';

export interface TrackTokenParams {
    organizationId: string;
    userId?: string;
    category: TokenCategory;
    operation: OperationType;
    inputTokens: number;
    outputTokens: number;
    resourceType?: string;
    resourceId?: string;
    model?: string;
}

export interface CanPerformResult {
    allowed: boolean;
    reason?: string;
    remaining: number;
    percentage: number;
    hasAddOn: boolean;
    limit: number;
    used: number;
}

export interface UsageStats {
    organization: {
        id: string;
        name: string;
        tier: string;
        plan: string;
    };
    tokens: {
        budget: number;
        used: number;
        purchased: number;
        remaining: number;
        percentage: number;
        breakdown: {
            interview: number;
            chatbot: number;
            visibility: number;
            suggestion: number;
            system: number;
        };
    };
    resources: {
        interviews: { limit: number; used: number; extra: number; remaining: number };
        chatbotSessions: { limit: number; used: number; extra: number; remaining: number };
        visibilityQueries: { limit: number; used: number; extra: number; remaining: number };
        aiSuggestions: { limit: number; used: number; extra: number; remaining: number };
    };
    addOns: {
        active: Array<{
            id: string;
            type: AddOnType;
            addOnId: string;
            quantity: number;
            remaining: number;
            expiresAt: Date | null;
        }>;
        totalValue: number;
    };
    period: {
        start: Date;
        end: Date;
        daysRemaining: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class TokenTrackingService {

    // ═══════════════════════════════════════════════════════════════════════
    // TRACK TOKEN USAGE
    // ═══════════════════════════════════════════════════════════════════════

    async trackTokenUsage(params: TrackTokenParams): Promise<void> {
        const {
            organizationId,
            userId,
            category,
            operation,
            inputTokens,
            outputTokens,
            resourceType,
            resourceId,
            model = 'gpt-4o-mini'
        } = params;

        const totalTokens = inputTokens + outputTokens;

        // Check if we should use an add-on
        const addOnResult = await this.tryConsumeAddOnTokens(organizationId, totalTokens);

        // Create detailed log
        await prisma.tokenLog.create({
            data: {
                organizationId,
                userId,
                category,
                operation,
                inputTokens,
                outputTokens,
                totalTokens,
                resourceType,
                resourceId,
                model,
                fromAddOn: addOnResult.used,
                addOnId: addOnResult.addOnId
            }
        });

        // Update TokenUsage aggregate
        const updateData: Record<string, { increment: number }> = {
            usedTokens: { increment: totalTokens }
        };

        // Update category-specific counter
        const categoryFieldMap: Record<TokenCategory, string> = {
            INTERVIEW: 'interviewTokens',
            CHATBOT: 'chatbotTokens',
            VISIBILITY: 'visibilityTokens',
            SUGGESTION: 'suggestionTokens',
            SYSTEM: 'systemTokens'
        };

        const categoryField = categoryFieldMap[category];
        if (categoryField) {
            updateData[categoryField] = { increment: totalTokens };
        }

        await prisma.tokenUsage.upsert({
            where: { organizationId },
            create: {
                organizationId,
                periodStart: this.getPeriodStart(),
                periodEnd: this.getPeriodEnd(),
                usedTokens: totalTokens,
                [categoryField]: totalTokens
            },
            update: updateData
        });

        // Update subscription counter
        await prisma.subscription.updateMany({
            where: { organizationId },
            data: {
                tokensUsedThisMonth: { increment: totalTokens }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INCREMENT RESOURCE USAGE
    // ═══════════════════════════════════════════════════════════════════════

    async incrementResourceUsage(
        organizationId: string,
        resource: ResourceType
    ): Promise<{ usedAddOn: boolean; addOnId?: string }> {

        // Map resource type to AddOnType
        const addOnTypeMap: Record<ResourceType, AddOnType> = {
            interviews: 'INTERVIEWS',
            chatbotSessions: 'CHATBOT',
            visibilityQueries: 'VISIBILITY',
            aiSuggestions: 'VISIBILITY' // AI suggestions don't have add-ons, use visibility
        };

        // Map to subscription field
        const subscriptionFieldMap: Record<ResourceType, string> = {
            interviews: 'interviewsUsedThisMonth',
            chatbotSessions: 'chatbotSessionsUsedThisMonth',
            visibilityQueries: 'visibilityQueriesUsedThisMonth',
            aiSuggestions: 'aiSuggestionsUsedThisMonth'
        };

        // Map to TokenUsage field
        const tokenUsageFieldMap: Record<ResourceType, string> = {
            interviews: 'interviewsUsed',
            chatbotSessions: 'chatbotSessionsUsed',
            visibilityQueries: 'visibilityQueriesUsed',
            aiSuggestions: 'aiSuggestionsUsed'
        };

        // Try to consume from add-on first
        const addOnType = addOnTypeMap[resource];
        const addOnResult = await this.tryConsumeAddOnResource(organizationId, addOnType);

        if (!addOnResult.used) {
            // No add-on available, increment subscription counter
            const subField = subscriptionFieldMap[resource];
            await prisma.subscription.updateMany({
                where: { organizationId },
                data: {
                    [subField]: { increment: 1 }
                }
            });
        }

        // Always update TokenUsage for analytics
        const usageField = tokenUsageFieldMap[resource];
        await prisma.tokenUsage.upsert({
            where: { organizationId },
            create: {
                organizationId,
                periodStart: this.getPeriodStart(),
                periodEnd: this.getPeriodEnd(),
                [usageField]: 1
            },
            update: {
                [usageField]: { increment: 1 }
            }
        });

        return { usedAddOn: addOnResult.used, addOnId: addOnResult.addOnId };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CAN PERFORM OPERATION
    // ═══════════════════════════════════════════════════════════════════════

    async canPerformOperation(
        organizationId: string,
        userId: string | undefined,
        operation: ResourceType | 'tokens'
    ): Promise<CanPerformResult> {

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { subscription: true }
        });

        if (!org) {
            return {
                allowed: false,
                reason: 'organization_not_found',
                remaining: 0,
                percentage: 100,
                hasAddOn: false,
                limit: 0,
                used: 0
            };
        }

        // Get plan configuration
        const tier = org.subscription?.tier || 'FREE';
        const planType = subscriptionTierToPlanType(tier);
        const plan = PLANS[planType];

        if (!plan) {
            return {
                allowed: false,
                reason: 'invalid_plan',
                remaining: 0,
                percentage: 100,
                hasAddOn: false,
                limit: 0,
                used: 0
            };
        }

        // Check based on operation type
        if (operation === 'tokens') {
            return this.checkTokenLimit(organizationId, plan, org.subscription);
        }

        return this.checkResourceLimit(organizationId, operation, plan, org.subscription);
    }

    private async checkTokenLimit(
        organizationId: string,
        plan: typeof PLANS[PlanType],
        subscription: any
    ): Promise<CanPerformResult> {

        const limit = plan.limits.monthlyTokenBudget;
        const used = subscription?.tokensUsedThisMonth || 0;
        const purchased = subscription?.purchasedTokens || 0;

        // Check for add-on tokens
        const addOnTokens = await this.getAvailableAddOnTokens(organizationId);
        const totalAvailable = (isUnlimited(limit) ? Infinity : limit) + purchased + addOnTokens;
        const remaining = Math.max(0, totalAvailable - used);
        const percentage = isUnlimited(limit) ? 0 : Math.min(100, (used / totalAvailable) * 100);

        return {
            allowed: isUnlimited(limit) || remaining > 0,
            reason: remaining <= 0 ? 'token_limit_reached' : undefined,
            remaining: isUnlimited(limit) ? -1 : remaining,
            percentage,
            hasAddOn: addOnTokens > 0,
            limit: isUnlimited(limit) ? -1 : limit,
            used
        };
    }

    private async checkResourceLimit(
        organizationId: string,
        resource: ResourceType,
        plan: typeof PLANS[PlanType],
        subscription: any
    ): Promise<CanPerformResult> {

        // Map resource to limit field
        const limitFieldMap: Record<ResourceType, keyof typeof plan.limits> = {
            interviews: 'maxInterviewsPerMonth',
            chatbotSessions: 'maxChatbotSessionsPerMonth',
            visibilityQueries: 'maxVisibilityQueriesPerMonth',
            aiSuggestions: 'maxAiSuggestionsPerMonth'
        };

        // Map resource to subscription usage field
        const usageFieldMap: Record<ResourceType, string> = {
            interviews: 'interviewsUsedThisMonth',
            chatbotSessions: 'chatbotSessionsUsedThisMonth',
            visibilityQueries: 'visibilityQueriesUsedThisMonth',
            aiSuggestions: 'aiSuggestionsUsedThisMonth'
        };

        // Map resource to subscription extra field
        const extraFieldMap: Record<ResourceType, string> = {
            interviews: 'extraInterviews',
            chatbotSessions: 'extraChatbotSessions',
            visibilityQueries: 'extraVisibilityQueries',
            aiSuggestions: 'extraVisibilityQueries' // AI suggestions share with visibility
        };

        const limitField = limitFieldMap[resource];
        const limit = plan.limits[limitField] as number;
        const used = subscription?.[usageFieldMap[resource]] || 0;
        const extra = subscription?.[extraFieldMap[resource]] || 0;

        // Check for add-on resources
        const addOnTypeMap: Record<ResourceType, AddOnType> = {
            interviews: 'INTERVIEWS',
            chatbotSessions: 'CHATBOT',
            visibilityQueries: 'VISIBILITY',
            aiSuggestions: 'VISIBILITY'
        };
        const addOnResources = await this.getAvailableAddOnResources(organizationId, addOnTypeMap[resource]);

        const totalAvailable = (isUnlimited(limit) ? Infinity : limit) + extra + addOnResources;
        const remaining = Math.max(0, totalAvailable - used);
        const percentage = isUnlimited(limit) ? 0 : Math.min(100, (used / totalAvailable) * 100);

        return {
            allowed: isUnlimited(limit) || remaining > 0,
            reason: remaining <= 0 ? `${resource}_limit_reached` : undefined,
            remaining: isUnlimited(limit) ? -1 : remaining,
            percentage,
            hasAddOn: addOnResources > 0,
            limit: isUnlimited(limit) ? -1 : limit,
            used
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET USAGE STATS
    // ═══════════════════════════════════════════════════════════════════════

    async getUsageStats(organizationId: string, userId?: string): Promise<UsageStats> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: true,
                tokenUsage: true
            }
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        const tier = org.subscription?.tier || 'FREE';
        const planType = subscriptionTierToPlanType(tier);
        const plan = PLANS[planType];

        // Get active add-ons
        const activeAddOns = await prisma.purchasedAddOn.findMany({
            where: {
                organizationId,
                remaining: { gt: 0 },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            }
        });

        const totalAddOnValue = activeAddOns.reduce((sum, addon) => sum + addon.price, 0);

        // Calculate period dates
        const periodStart = org.subscription?.currentPeriodStart || this.getPeriodStart();
        const periodEnd = org.subscription?.currentPeriodEnd || this.getPeriodEnd();
        const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        // Token stats
        const tokenBudget = plan.limits.monthlyTokenBudget;
        const tokensUsed = org.subscription?.tokensUsedThisMonth || 0;
        const purchasedTokens = org.subscription?.purchasedTokens || 0;
        const addOnTokens = await this.getAvailableAddOnTokens(organizationId);
        const totalTokens = (isUnlimited(tokenBudget) ? Infinity : tokenBudget) + purchasedTokens + addOnTokens;
        const tokensRemaining = isUnlimited(tokenBudget) ? -1 : Math.max(0, totalTokens - tokensUsed);

        return {
            organization: {
                id: org.id,
                name: org.name,
                tier: tier,
                plan: plan.name
            },
            tokens: {
                budget: tokenBudget,
                used: tokensUsed,
                purchased: purchasedTokens + addOnTokens,
                remaining: tokensRemaining,
                percentage: isUnlimited(tokenBudget) ? 0 : Math.min(100, (tokensUsed / totalTokens) * 100),
                breakdown: {
                    interview: org.tokenUsage?.interviewTokens || 0,
                    chatbot: org.tokenUsage?.chatbotTokens || 0,
                    visibility: org.tokenUsage?.visibilityTokens || 0,
                    suggestion: org.tokenUsage?.suggestionTokens || 0,
                    system: org.tokenUsage?.systemTokens || 0
                }
            },
            resources: {
                interviews: {
                    limit: plan.limits.maxInterviewsPerMonth,
                    used: org.subscription?.interviewsUsedThisMonth || 0,
                    extra: (org.subscription?.extraInterviews || 0) + await this.getAvailableAddOnResources(organizationId, 'INTERVIEWS'),
                    remaining: this.calculateRemaining(
                        plan.limits.maxInterviewsPerMonth,
                        org.subscription?.interviewsUsedThisMonth || 0,
                        org.subscription?.extraInterviews || 0,
                        await this.getAvailableAddOnResources(organizationId, 'INTERVIEWS')
                    )
                },
                chatbotSessions: {
                    limit: plan.limits.maxChatbotSessionsPerMonth,
                    used: org.subscription?.chatbotSessionsUsedThisMonth || 0,
                    extra: (org.subscription?.extraChatbotSessions || 0) + await this.getAvailableAddOnResources(organizationId, 'CHATBOT'),
                    remaining: this.calculateRemaining(
                        plan.limits.maxChatbotSessionsPerMonth,
                        org.subscription?.chatbotSessionsUsedThisMonth || 0,
                        org.subscription?.extraChatbotSessions || 0,
                        await this.getAvailableAddOnResources(organizationId, 'CHATBOT')
                    )
                },
                visibilityQueries: {
                    limit: plan.limits.maxVisibilityQueriesPerMonth,
                    used: org.subscription?.visibilityQueriesUsedThisMonth || 0,
                    extra: (org.subscription?.extraVisibilityQueries || 0) + await this.getAvailableAddOnResources(organizationId, 'VISIBILITY'),
                    remaining: this.calculateRemaining(
                        plan.limits.maxVisibilityQueriesPerMonth,
                        org.subscription?.visibilityQueriesUsedThisMonth || 0,
                        org.subscription?.extraVisibilityQueries || 0,
                        await this.getAvailableAddOnResources(organizationId, 'VISIBILITY')
                    )
                },
                aiSuggestions: {
                    limit: plan.limits.maxAiSuggestionsPerMonth,
                    used: org.subscription?.aiSuggestionsUsedThisMonth || 0,
                    extra: 0,
                    remaining: this.calculateRemaining(
                        plan.limits.maxAiSuggestionsPerMonth,
                        org.subscription?.aiSuggestionsUsedThisMonth || 0,
                        0,
                        0
                    )
                }
            },
            addOns: {
                active: activeAddOns.map(a => ({
                    id: a.id,
                    type: a.type,
                    addOnId: a.addOnId,
                    quantity: a.quantity,
                    remaining: a.remaining,
                    expiresAt: a.expiresAt
                })),
                totalValue: totalAddOnValue
            },
            period: {
                start: periodStart,
                end: periodEnd,
                daysRemaining
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════════════

    private calculateRemaining(limit: number, used: number, extra: number, addOn: number): number {
        if (isUnlimited(limit)) return -1;
        return Math.max(0, limit + extra + addOn - used);
    }

    private async tryConsumeAddOnTokens(
        organizationId: string,
        tokens: number
    ): Promise<{ used: boolean; addOnId?: string }> {
        // Find an add-on with enough tokens
        const addOn = await prisma.purchasedAddOn.findFirst({
            where: {
                organizationId,
                type: 'TOKENS',
                remaining: { gte: tokens },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { purchasedAt: 'asc' } // Use oldest first
        });

        if (!addOn) {
            return { used: false };
        }

        // Consume from add-on
        await prisma.purchasedAddOn.update({
            where: { id: addOn.id },
            data: { remaining: { decrement: tokens } }
        });

        return { used: true, addOnId: addOn.id };
    }

    private async tryConsumeAddOnResource(
        organizationId: string,
        type: AddOnType
    ): Promise<{ used: boolean; addOnId?: string }> {
        // Find an add-on with remaining resources
        const addOn = await prisma.purchasedAddOn.findFirst({
            where: {
                organizationId,
                type,
                remaining: { gt: 0 },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { purchasedAt: 'asc' } // Use oldest first
        });

        if (!addOn) {
            return { used: false };
        }

        // Consume from add-on
        await prisma.purchasedAddOn.update({
            where: { id: addOn.id },
            data: { remaining: { decrement: 1 } }
        });

        return { used: true, addOnId: addOn.id };
    }

    private async getAvailableAddOnTokens(organizationId: string): Promise<number> {
        const result = await prisma.purchasedAddOn.aggregate({
            where: {
                organizationId,
                type: 'TOKENS',
                remaining: { gt: 0 },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            _sum: { remaining: true }
        });

        return result._sum.remaining || 0;
    }

    private async getAvailableAddOnResources(organizationId: string, type: AddOnType): Promise<number> {
        const result = await prisma.purchasedAddOn.aggregate({
            where: {
                organizationId,
                type,
                remaining: { gt: 0 },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            _sum: { remaining: true }
        });

        return result._sum.remaining || 0;
    }

    private getPeriodStart(): Date {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    private getPeriodEnd(): Date {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESET MONTHLY COUNTERS
    // ═══════════════════════════════════════════════════════════════════════

    async resetMonthlyCounters(organizationId?: string): Promise<void> {
        const where = organizationId ? { organizationId } : {};

        // Reset subscription counters
        await prisma.subscription.updateMany({
            where,
            data: {
                interviewsUsedThisMonth: 0,
                chatbotSessionsUsedThisMonth: 0,
                visibilityQueriesUsedThisMonth: 0,
                aiSuggestionsUsedThisMonth: 0,
                tokensUsedThisMonth: 0,
                currentPeriodStart: new Date(),
                currentPeriodEnd: this.getPeriodEnd()
            }
        });

        // Reset TokenUsage
        await prisma.tokenUsage.updateMany({
            where,
            data: {
                usedTokens: 0,
                interviewTokens: 0,
                chatbotTokens: 0,
                visibilityTokens: 0,
                suggestionTokens: 0,
                systemTokens: 0,
                interviewsUsed: 0,
                chatbotSessionsUsed: 0,
                visibilityQueriesUsed: 0,
                aiSuggestionsUsed: 0,
                periodStart: this.getPeriodStart(),
                periodEnd: this.getPeriodEnd()
            }
        });

        // Expire add-ons that have ended
        await prisma.purchasedAddOn.deleteMany({
            where: {
                ...where,
                expiresAt: { lt: new Date() }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN: GET GLOBAL STATS
    // ═══════════════════════════════════════════════════════════════════════

    async getGlobalStats(): Promise<{
        totalOrganizations: number;
        totalTokensUsed: number;
        totalInterviews: number;
        totalChatbotSessions: number;
        byTier: Record<string, { count: number; tokensUsed: number }>;
        recentLogs: any[];
    }> {
        const [
            totalOrgs,
            tokenAggregates,
            tierStats,
            recentLogs
        ] = await Promise.all([
            prisma.organization.count(),
            prisma.tokenUsage.aggregate({
                _sum: {
                    usedTokens: true,
                    interviewsUsed: true,
                    chatbotSessionsUsed: true
                }
            }),
            prisma.subscription.groupBy({
                by: ['tier'],
                _count: { id: true },
                _sum: { tokensUsedThisMonth: true }
            }),
            prisma.tokenLog.findMany({
                take: 100,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    organizationId: true,
                    category: true,
                    operation: true,
                    totalTokens: true,
                    createdAt: true
                }
            })
        ]);

        const byTier: Record<string, { count: number; tokensUsed: number }> = {};
        for (const stat of tierStats) {
            byTier[stat.tier] = {
                count: stat._count.id,
                tokensUsed: stat._sum.tokensUsedThisMonth || 0
            };
        }

        return {
            totalOrganizations: totalOrgs,
            totalTokensUsed: tokenAggregates._sum.usedTokens || 0,
            totalInterviews: tokenAggregates._sum.interviewsUsed || 0,
            totalChatbotSessions: tokenAggregates._sum.chatbotSessionsUsed || 0,
            byTier,
            recentLogs
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const tokenTrackingService = new TokenTrackingService();

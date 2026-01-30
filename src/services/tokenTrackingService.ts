import { prisma } from '@/lib/prisma';
import { PLANS, isUnlimited, PlanType } from '@/config/plans';
import { TokenCategory } from '@prisma/client';
import { CreditService } from './creditService';
import { CreditAction, getCreditCost } from '@/config/creditCosts';

/**
 * TokenTrackingService
 *
 * Gestisce il tracking dei token AI e integra con il nuovo sistema crediti.
 *
 * Nel nuovo sistema:
 * - I crediti sono l'unico limite (non più limiti separati per interviste, chatbot, etc.)
 * - I crediti sono per organizzazione, non per utente
 * - I token consumati vengono mappati a crediti
 * - Il TokenLog viene mantenuto per analytics dettagliate
 */
export class TokenTrackingService {
    /**
     * Mappa categorie token a azioni crediti
     */
    private static categoryToAction: Record<string, CreditAction> = {
        INTERVIEW: 'interview_question',
        CHATBOT: 'chatbot_session_message',
        VISIBILITY: 'visibility_query',
        SUGGESTION: 'ai_tip_generation',
        COPILOT: 'copilot_message',
        SYSTEM: 'interview_question' // Default
    };

    /**
     * Registra il consumo di token e scala i crediti dall'organizzazione
     *
     * @param params - Parametri del consumo
     * @returns Risultato con stato crediti
     */
    static async logTokenUsage(params: {
        organizationId: string;      // Organization that owns the credits
        userId?: string;             // User associated with the action (owner/legacy)
        projectId?: string;          // Project associated
        executedById?: string;       // Who executed 
        inputTokens: number;
        outputTokens: number;
        category: TokenCategory;
        model: string;
        operation: string;
        resourceType?: string;
        resourceId?: string;
    }) {
        let {
            organizationId,
            userId,
            projectId,
            executedById,
            inputTokens,
            outputTokens,
            category,
            model,
            operation,
            resourceType,
            resourceId
        } = params;

        // Fallback: if organizationId is missing, try to find it from the user
        if (!organizationId && (userId || executedById)) {
            const userWithOrg = await prisma.user.findUnique({
                where: { id: userId || executedById },
                include: { memberships: { take: 1 } }
            });
            if (userWithOrg?.memberships?.[0]) {
                organizationId = userWithOrg.memberships[0].organizationId;
            }
        }

        if (!organizationId) {
            console.warn(`[TokenTracking] Missing organizationId for usage: ${operation}`);
            // Still create tokenLog but skip credit consumption
            await prisma.tokenLog.create({
                data: {
                    organizationId: 'unknown',
                    userId: userId || executedById || 'system',
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    category,
                    model,
                    operation,
                    resourceType,
                    resourceId
                }
            }).catch(err => console.error('Failed to create tokenLog fallback:', err));

            return { success: false, error: 'Organization ID missing' };
        }

        const totalTokens = inputTokens + outputTokens;

        // 1. Determina l'azione crediti dalla categoria
        const action = this.categoryToAction[category] || 'interview_question';

        // 2. Calcola crediti da consumare
        const baseCost = getCreditCost(action);
        const tokenBasedCost = Math.ceil(totalTokens * 0.5); // 0.5 crediti per token
        const creditsToConsume = Math.max(baseCost, tokenBasedCost);

        // 3. Consuma i crediti dall'organizzazione
        const creditResult = await CreditService.consumeCredits(organizationId, action, {
            projectId,
            executedById: executedById || userId,
            description: `${operation} - ${model}`,
            customAmount: creditsToConsume,
            metadata: {
                inputTokens,
                outputTokens,
                totalTokens,
                model,
                category,
                resourceType,
                resourceId
            }
        });

        // 4. Log dettagliato per analytics
        await prisma.tokenLog.create({
            data: {
                organizationId,
                userId: userId || executedById || 'system',
                inputTokens,
                outputTokens,
                totalTokens,
                category,
                model,
                operation,
                resourceType,
                resourceId
            }
        }).catch(err => console.error('Failed to create tokenLog:', err));

        return {
            success: creditResult.success,
            creditsUsed: creditResult.creditsUsed,
            creditsRemaining: creditResult.creditsRemaining,
            warningLevel: creditResult.warningLevel,
            error: creditResult.error
        };
    }

    /**
     * Registra l'uso di una risorsa (azione completa come intervista, sessione, etc.)
     * Questa funzione consuma i crediti per l'intera azione
     */
    static async logResourceUsage(params: {
        organizationId: string;
        userId?: string;
        projectId?: string;
        type: 'INTERVIEW_COMPLETE' | 'INTERVIEW_ANALYSIS' | 'CHATBOT_SESSION_COMPLETE' | 'VISIBILITY_REPORT' | 'AI_TIP' | 'COPILOT_ANALYSIS' | 'EXPORT_PDF' | 'EXPORT_CSV';
    }) {
        const { organizationId, userId, projectId, type } = params;

        // Mappa tipo a azione crediti
        const actionMap: Record<string, CreditAction> = {
            INTERVIEW_COMPLETE: 'interview_complete',
            INTERVIEW_ANALYSIS: 'interview_analysis',
            CHATBOT_SESSION_COMPLETE: 'chatbot_session_complete',
            VISIBILITY_REPORT: 'visibility_report',
            AI_TIP: 'ai_tip_generation',
            COPILOT_ANALYSIS: 'copilot_analysis',
            EXPORT_PDF: 'export_pdf_analysis',
            EXPORT_CSV: 'export_csv'
        };

        const action = actionMap[type];
        if (!action) {
            console.warn(`Unknown resource type: ${type}`);
            return { success: false, error: 'Tipo risorsa non riconosciuto' };
        }

        return await CreditService.consumeCredits(organizationId, action, {
            projectId,
            executedById: userId,
            description: `Azione completata: ${type}`
        });
    }

    /**
     * Verifica se l'organizzazione può usare una risorsa (ha crediti sufficienti)
     */
    static async checkCanUseResource(params: {
        organizationId: string;
        action: CreditAction;
        customAmount?: number;
    }): Promise<{ allowed: boolean; reason?: string; creditsNeeded?: number; creditsAvailable?: number }> {
        const { organizationId, action, customAmount } = params;

        // Verifica piano organizzazione
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!org) {
            return { allowed: false, reason: 'Organizzazione non trovata' };
        }

        const organization = org as any; // Bypass Prisma selection typing lag

        // Admin role o piano ADMIN hanno accesso illimitato
        if (organization.plan === 'ADMIN' || organization.monthlyCreditsLimit === BigInt(-1)) {
            return { allowed: true };
        }

        // Verifica feature disponibile per il piano
        const plan = PLANS[organization.plan as PlanType] || PLANS[PlanType.FREE];
        const featureCheck = this.checkFeatureForAction(action, plan);
        if (!featureCheck.allowed) {
            return featureCheck;
        }

        // Calcola crediti necessari
        const creditsNeeded = customAmount || getCreditCost(action);
        const monthlyRemaining = Number(organization.monthlyCreditsLimit) - Number(organization.monthlyCreditsUsed);
        const creditsAvailable = monthlyRemaining + Number(organization.packCreditsAvailable);

        if (creditsAvailable < creditsNeeded) {
            return {
                allowed: false,
                reason: 'Crediti insufficienti',
                creditsNeeded,
                creditsAvailable
            };
        }

        return { allowed: true, creditsNeeded, creditsAvailable };
    }

    /**
     * Verifica se la feature è disponibile per il piano
     */
    private static checkFeatureForAction(action: CreditAction, plan: typeof PLANS[PlanType]): { allowed: boolean; reason?: string } {
        const featureMap: Record<string, keyof typeof plan.features> = {
            interview_question: 'interviewAI',
            interview_complete: 'interviewAI',
            interview_analysis: 'interviewAI',
            chatbot_session_message: 'chatbot',
            chatbot_session_complete: 'chatbot',
            visibility_query: 'visibilityTracker',
            visibility_report: 'visibilityTracker',
            ai_tip_generation: 'aiTips',
            copilot_message: 'copilotStrategico',
            copilot_analysis: 'copilotStrategico',
            export_pdf_simple: 'exportPdf',
            export_pdf_analysis: 'exportPdf',
            export_csv: 'exportCsv'
        };

        const featureKey = featureMap[action];
        if (!featureKey) return { allowed: true };

        const featureValue = plan.features[featureKey];

        // Boolean check
        if (typeof featureValue === 'boolean' && !featureValue) {
            return {
                allowed: false,
                reason: `Questa funzionalità non è inclusa nel piano ${plan.name}`
            };
        }

        return { allowed: true };
    }

    /**
     * Ottiene lo stato dei crediti per un'organizzazione
     */
    static async getCreditsStatus(organizationId: string) {
        return await CreditService.getCreditsStatus(organizationId);
    }

    /**
     * Ottiene il consumo per tool nel mese corrente per l'organizzazione
     */
    static async getUsageByTool(organizationId: string) {
        return await CreditService.getUsageByTool(organizationId);
    }

    /**
     * Ottiene statistiche globali della piattaforma (per admin)
     */
    static async getGlobalStats() {
        // Fetch stats from Organizations now
        const [
            totalUsers,
            totalOrganizations,
            totalCreditsUsed,
            recentTransactions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.organization.count(),
            prisma.organization.aggregate({
                _sum: { monthlyCreditsUsed: true }
            }),
            (prisma as any).orgCreditTransaction.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                where: { type: 'usage' },
                include: {
                    executedBy: { select: { name: true, email: true } },
                    project: { select: { name: true } },
                    organization: { select: { name: true } }
                }
            })
        ]);

        // Stats per piano (su Organizzazione)
        const byPlan = await prisma.organization.groupBy({
            by: ['plan'],
            _count: { id: true }
        });

        const planStats: Record<string, number> = {};
        byPlan.forEach(p => {
            planStats[p.plan] = p._count.id;
        });

        return {
            totalUsers,
            totalOrganizations,
            totalCreditsUsed: Number((totalCreditsUsed as any)._sum.monthlyCreditsUsed || 0),
            byPlan: planStats,
            recentTransactions: recentTransactions.map((t: any) => ({
                id: t.id,
                user: t.executedBy?.name || t.executedBy?.email || 'System',
                organization: t.organization?.name || 'Unknown',
                project: t.project?.name || null,
                amount: Number(t.amount),
                tool: t.tool,
                action: t.action,
                createdAt: t.createdAt
            }))
        };
    }

    /**
     * Ottiene statistiche di utilizzo crediti per un'organizzazione
     */
    static async getOrganizationStats(organizationId: string) {
        const status = await CreditService.getCreditsStatus(organizationId);
        const usageByTool = await CreditService.getUsageByTool(organizationId);

        if (!status) return null;

        return {
            credits: {
                limit: Number(status.monthlyLimit),
                used: Number(status.monthlyUsed),
                remaining: Number(status.monthlyRemaining),
                pack: Number(status.packCredits),
                total: Number(status.totalAvailable),
                percentage: status.usagePercentage,
                warningLevel: status.warningLevel,
                resetDate: status.resetDate,
                isUnlimited: status.monthlyLimit === BigInt(-1)
            },
            byTool: usageByTool
        };
    }
}

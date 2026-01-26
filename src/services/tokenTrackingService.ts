import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';
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
 * - I crediti sono per utente, non per organizzazione
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
     * Registra il consumo di token e scala i crediti dall'utente
     *
     * @param params - Parametri del consumo
     * @returns Risultato con stato crediti
     */
    static async logTokenUsage(params: {
        userId: string;              // Owner dei crediti
        organizationId?: string;     // Per backward compatibility
        projectId?: string;          // Progetto associato
        executedById?: string;       // Chi ha eseguito (se diverso da owner)
        inputTokens: number;
        outputTokens: number;
        category: TokenCategory;
        model: string;
        operation: string;
        resourceType?: string;
        resourceId?: string;
    }) {
        const {
            userId,
            organizationId,
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

        const totalTokens = inputTokens + outputTokens;

        // 1. Determina l'azione crediti dalla categoria
        const action = this.categoryToAction[category] || 'interview_question';

        // 2. Calcola crediti da consumare
        // Usiamo i token effettivi come base per il consumo
        // Il costo base dell'azione viene usato come minimo
        const baseCost = getCreditCost(action);
        const tokenBasedCost = Math.ceil(totalTokens * 0.5); // 0.5 crediti per token
        const creditsToConsume = Math.max(baseCost, tokenBasedCost);

        // 3. Consuma i crediti dall'utente owner
        const creditResult = await CreditService.consumeCredits(userId, action, {
            projectId,
            executedById,
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

        // 4. Log dettagliato per analytics (manteniamo per backward compatibility)
        if (organizationId) {
            await prisma.tokenLog.create({
                data: {
                    organizationId,
                    userId,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    category,
                    model,
                    operation,
                    resourceType,
                    resourceId
                }
            });
        }

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
        userId: string;
        projectId?: string;
        type: 'INTERVIEW_COMPLETE' | 'INTERVIEW_ANALYSIS' | 'CHATBOT_SESSION_COMPLETE' | 'VISIBILITY_REPORT' | 'AI_TIP' | 'COPILOT_ANALYSIS' | 'EXPORT_PDF' | 'EXPORT_CSV';
    }) {
        const { userId, projectId, type } = params;

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

        return await CreditService.consumeCredits(userId, action, {
            projectId,
            description: `Azione completata: ${type}`
        });
    }

    /**
     * Verifica se l'utente può usare una risorsa (ha crediti sufficienti)
     */
    static async checkCanUseResource(params: {
        userId: string;
        action: CreditAction;
        customAmount?: number;
    }): Promise<{ allowed: boolean; reason?: string; creditsNeeded?: number; creditsAvailable?: number }> {
        const { userId, action, customAmount } = params;

        // Verifica piano utente
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!user) {
            return { allowed: false, reason: 'Utente non trovato' };
        }

        // Piano ADMIN ha crediti illimitati
        if (user.monthlyCreditsLimit === BigInt(-1)) {
            return { allowed: true };
        }

        // Verifica feature disponibile per il piano
        const plan = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];
        const featureCheck = this.checkFeatureForAction(action, plan);
        if (!featureCheck.allowed) {
            return featureCheck;
        }

        // Calcola crediti necessari
        const creditsNeeded = customAmount || getCreditCost(action);
        const monthlyRemaining = Number(user.monthlyCreditsLimit) - Number(user.monthlyCreditsUsed);
        const creditsAvailable = monthlyRemaining + Number(user.packCreditsAvailable);

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
     * Verifica se la feature è disponibile per il piano dell'utente
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
     * Ottiene lo stato dei crediti per un utente
     */
    static async getCreditsStatus(userId: string) {
        return await CreditService.getCreditsStatus(userId);
    }

    /**
     * Ottiene il consumo per tool nel mese corrente
     */
    static async getUsageByTool(userId: string) {
        return await CreditService.getUsageByTool(userId);
    }


    /**
     * Ottiene statistiche globali della piattaforma (per admin)
     */
    static async getGlobalStats() {
        const [
            totalUsers,
            totalOrganizations,
            totalCreditsUsed,
            recentTransactions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.organization.count(),
            prisma.user.aggregate({
                _sum: { monthlyCreditsUsed: true }
            }),
            prisma.creditTransaction.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                where: { type: 'usage' },
                include: {
                    user: { select: { name: true, email: true } },
                    project: { select: { name: true } }
                }
            })
        ]);

        // Stats per piano
        const byPlan = await prisma.user.groupBy({
            by: ['plan'],
            _count: { id: true }
        });

        const planStats: Record<string, number> = {};
        byPlan.forEach(p => {
            planStats[p.plan || 'FREE'] = p._count.id;
        });

        return {
            totalUsers,
            totalOrganizations,
            totalCreditsUsed: Number(totalCreditsUsed._sum.monthlyCreditsUsed || 0),
            byPlan: planStats,
            recentTransactions: recentTransactions.map(t => ({
                id: t.id,
                user: t.user?.name || t.user?.email || 'Unknown',
                project: t.project?.name || null,
                amount: Number(t.amount),
                tool: t.tool,
                action: t.action,
                createdAt: t.createdAt
            }))
        };
    }

    /**
     * Ottiene statistiche di utilizzo crediti per un utente
     */
    static async getUserStats(userId: string) {
        const status = await CreditService.getCreditsStatus(userId);
        const usageByTool = await CreditService.getUsageByTool(userId);

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
                isUnlimited: status.isUnlimited
            },
            byTool: usageByTool
        };
    }
}

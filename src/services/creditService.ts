/**
 * Credit Service
 *
 * Gestisce il sistema di crediti per le organizzazioni (Organization-centric).
 * - Consumo crediti per azioni AI
 * - Verifica disponibilità crediti
 * - Acquisto pack crediti
 * - Reset mensile crediti
 */

import { prisma } from '@/lib/prisma';
import { CreditAction, getCreditCost } from '@/config/creditCosts';
import { calculateUsagePercentage, getWarningLevel } from '@/config/creditPacks';
import { PLANS, PlanType } from '@/config/plans';

// Import dinamico per evitare circular dependency
const getNotificationService = async () => {
    const { CreditNotificationService } = await import('./creditNotificationService');
    return CreditNotificationService;
};

// ============================================
// TYPES
// ============================================

export interface CreditResult {
    success: boolean;
    creditsUsed: number;
    creditsRemaining: number;
    usedFromPack: boolean;
    error?: string;
    warningLevel?: 'none' | 'warning' | 'danger' | 'critical' | 'exhausted';
}

export interface OrganizationCreditsStatus {
    monthlyLimit: bigint;
    monthlyUsed: bigint;
    monthlyRemaining: bigint;
    packCredits: bigint;
    totalAvailable: bigint;
    usagePercentage: number;
    warningLevel: 'none' | 'warning' | 'danger' | 'critical' | 'exhausted';
    resetDate: Date | null;
}

export interface CreditUsageByTool {
    tool: string;
    creditsUsed: bigint;
    transactionCount: number;
    percentage: number;
}

// ============================================
// CREDIT SERVICE
// ============================================

export const CreditService = {
    /**
     * Consuma crediti per un'azione a livello organizzazione
     * Prima usa i crediti mensili, poi i pack
     */
    async consumeCredits(
        organizationId: string,
        action: CreditAction,
        options?: {
            projectId?: string;
            executedById?: string;  // Utente che ha eseguito l'azione
            description?: string;
            metadata?: Record<string, unknown>;
            customAmount?: number;  // Per override (es. token effettivi)
        }
    ): Promise<CreditResult> {
        const amount = options?.customAmount ?? getCreditCost(action);

        // Fetch organization credits
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!org) {
            return {
                success: false,
                creditsUsed: 0,
                creditsRemaining: 0,
                usedFromPack: false,
                error: 'Organization not found'
            };
        }

        // Check if unlimited (ADMIN)
        if (org.plan === PlanType.ADMIN || org.monthlyCreditsLimit === BigInt(-1)) {
            // Log transaction but don't deduct
            await this.logTransaction(organizationId, {
                amount: BigInt(amount),
                type: 'usage',
                action,
                projectId: options?.projectId,
                executedById: options?.executedById,
                description: options?.description,
                metadata: options?.metadata,
                balanceAfter: BigInt(-1)
            });

            return {
                success: true,
                creditsUsed: amount,
                creditsRemaining: -1, // Unlimited
                usedFromPack: false,
                warningLevel: 'none'
            };
        }

        const monthlyRemaining = org.monthlyCreditsLimit - org.monthlyCreditsUsed;
        const totalAvailable = monthlyRemaining + org.packCreditsAvailable;

        // Check if enough credits
        if (totalAvailable < BigInt(amount)) {
            return {
                success: false,
                creditsUsed: 0,
                creditsRemaining: Number(totalAvailable),
                usedFromPack: false,
                error: 'Crediti insufficienti',
                warningLevel: 'exhausted'
            };
        }

        // Deduct credits: first from monthly, then from pack
        let usedFromMonthly = BigInt(0);
        let usedFromPack = BigInt(0);

        if (monthlyRemaining >= BigInt(amount)) {
            usedFromMonthly = BigInt(amount);
        } else {
            usedFromMonthly = monthlyRemaining > BigInt(0) ? monthlyRemaining : BigInt(0);
            usedFromPack = BigInt(amount) - usedFromMonthly;
        }

        // Update organization credits using a transaction for safety
        const updatedOrg = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                monthlyCreditsUsed: {
                    increment: usedFromMonthly
                },
                packCreditsAvailable: {
                    decrement: usedFromPack
                }
            },
            select: {
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        const newMonthlyRemaining = updatedOrg.monthlyCreditsLimit - updatedOrg.monthlyCreditsUsed;
        const newTotalRemaining = newMonthlyRemaining + updatedOrg.packCreditsAvailable;

        // Log transaction
        await this.logTransaction(organizationId, {
            amount: BigInt(amount),
            type: 'usage',
            action,
            tool: this.getToolFromAction(action),
            projectId: options?.projectId,
            executedById: options?.executedById,
            description: options?.description,
            metadata: {
                ...options?.metadata,
                usedFromMonthly: Number(usedFromMonthly),
                usedFromPack: Number(usedFromPack)
            },
            balanceAfter: newTotalRemaining
        });

        // Calculate warning level
        const usagePercentage = calculateUsagePercentage(
            Number(updatedOrg.monthlyCreditsUsed),
            Number(updatedOrg.monthlyCreditsLimit)
        );
        const warningLevel = getWarningLevel(usagePercentage);

        // Trigger notifications asynchronously (to organizational members who should receive them)
        // TODO: Refactor notification service to handle organizations
        /*
        if (warningLevel === 'danger' || warningLevel === 'critical' || warningLevel === 'exhausted') {
            getNotificationService().then(service => {
                service.checkAndNotifyOrg(organizationId, usagePercentage).catch(err => {
                    console.error('[Credits] Notification error:', err);
                });
            });
        }
        */

        return {
            success: true,
            creditsUsed: amount,
            creditsRemaining: Number(newTotalRemaining),
            usedFromPack: usedFromPack > BigInt(0),
            warningLevel
        };
    },

    /**
     * Verifica se l'organizzazione ha crediti sufficienti
     */
    async checkCreditsAvailable(organizationId: string, requiredAmount: number): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!org) return false;

        // Unlimited
        if (org.plan === PlanType.ADMIN || org.monthlyCreditsLimit === BigInt(-1)) return true;

        const monthlyRemaining = org.monthlyCreditsLimit - org.monthlyCreditsUsed;
        const totalAvailable = monthlyRemaining + org.packCreditsAvailable;

        return totalAvailable >= BigInt(requiredAmount);
    },

    /**
     * Ottiene lo stato dei crediti dell'organizzazione
     */
    async getOrganizationCreditsStatus(organizationId: string): Promise<OrganizationCreditsStatus | null> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!org) return null;

        const isUnlimitedCredits = org.plan === PlanType.ADMIN || org.monthlyCreditsLimit === BigInt(-1);
        const monthlyRemaining = isUnlimitedCredits
            ? BigInt(-1)
            : org.monthlyCreditsLimit - org.monthlyCreditsUsed;

        const totalAvailable = isUnlimitedCredits
            ? BigInt(-1)
            : (monthlyRemaining > BigInt(0) ? monthlyRemaining : BigInt(0)) + org.packCreditsAvailable;

        const usagePercentage = isUnlimitedCredits
            ? 0
            : calculateUsagePercentage(
                Number(org.monthlyCreditsUsed),
                Number(org.monthlyCreditsLimit)
            );

        return {
            monthlyLimit: org.monthlyCreditsLimit,
            monthlyUsed: org.monthlyCreditsUsed,
            monthlyRemaining: isUnlimitedCredits ? BigInt(-1) : (monthlyRemaining > BigInt(0) ? monthlyRemaining : BigInt(0)),
            packCredits: org.packCreditsAvailable,
            totalAvailable: isUnlimitedCredits ? BigInt(-1) : (totalAvailable > BigInt(0) ? totalAvailable : BigInt(0)),
            usagePercentage,
            warningLevel: getWarningLevel(usagePercentage),
            resetDate: org.creditsResetDate
        };
    },

    /**
     * Reset crediti mensili per tutte le organizzazioni
     * Da eseguire via cron job all'inizio di ogni mese
     */
    async resetMonthlyCredits(): Promise<{ organizationsReset: number }> {
        const now = new Date();

        // Trova organizzazioni da resettare (reset date passata o null)
        const orgsToReset = await prisma.organization.findMany({
            where: {
                OR: [
                    { creditsResetDate: null },
                    { creditsResetDate: { lte: now } }
                ]
            },
            select: {
                id: true,
                plan: true,
                monthlyCreditsUsed: true
            }
        });

        let organizationsReset = 0;

        for (const org of orgsToReset) {
            // Calcola prossima data reset (primo del prossimo mese)
            const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            // Get piano config per limite crediti
            const planConfig = PLANS[org.plan as PlanType] || PLANS[PlanType.FREE];

            await prisma.organization.update({
                where: { id: org.id },
                data: {
                    monthlyCreditsUsed: BigInt(0),
                    monthlyCreditsLimit: BigInt(planConfig.monthlyCredits),
                    creditsResetDate: nextReset
                }
            });

            // Log reset
            if (org.monthlyCreditsUsed > BigInt(0)) {
                await this.logTransaction(org.id, {
                    amount: org.monthlyCreditsUsed,
                    type: 'monthly_reset',
                    description: 'Reset mensile crediti',
                    metadata: { previousUsed: Number(org.monthlyCreditsUsed) },
                    balanceAfter: BigInt(planConfig.monthlyCredits)
                });
            }

            organizationsReset++;
        }

        return { organizationsReset };
    },

    /**
     * Aggiunge crediti pack a un'organizzazione
     */
    async addPackCredits(
        organizationId: string,
        amount: number,
        type: string,
        purchasedBy?: string,
        stripePaymentId?: string
    ): Promise<void> {
        const updatedOrg = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                packCreditsAvailable: { increment: BigInt(amount) }
            },
            select: {
                packCreditsAvailable: true
            }
        });

        // Crea record pack
        await prisma.orgCreditPack.create({
            data: {
                organizationId,
                packType: type,
                creditsPurchased: BigInt(amount),
                creditsRemaining: BigInt(amount),
                pricePaid: 0, // In realtà andrebbe passato il prezzo reale
                purchasedBy,
                stripePaymentId
            }
        });

        // Log transaction
        await this.logTransaction(organizationId, {
            amount: BigInt(amount),
            type: 'pack_purchase',
            description: `Acquisto pack ${type}`,
            metadata: { type, stripePaymentId },
            balanceAfter: updatedOrg.packCreditsAvailable,
            executedById: purchasedBy
        });
    },

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    /**
     * Mappa azione a tool per raggruppamento
     */
    getToolFromAction(action: CreditAction): string {
        const toolMap: Record<string, string> = {
            interview_question: 'interview',
            interview_complete: 'interview',
            interview_analysis: 'interview',
            chatbot_session_message: 'chatbot',
            chatbot_session_complete: 'chatbot',
            visibility_query: 'visibility',
            visibility_report: 'visibility',
            ai_tip_generation: 'ai_tips',
            copilot_message: 'copilot',
            copilot_analysis: 'copilot',
            export_pdf_simple: 'export',
            export_pdf_analysis: 'export',
            export_csv: 'export'
        };
        return toolMap[action] || 'other';
    },

    /**
     * Ottiene lo stato dei crediti dell'organizzazione
     * Alias per backward compatibility con helper che si aspettano getCreditsStatus
     */
    async getCreditsStatus(organizationId: string): Promise<OrganizationCreditsStatus | null> {
        return this.getOrganizationCreditsStatus(organizationId);
    },

    /**
     * Ottiene il consumo per tool nel mese corrente per l'organizzazione
     */
    async getUsageByTool(organizationId: string): Promise<CreditUsageByTool[]> {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch transactions for the current month
        const transactions = await prisma.orgCreditTransaction.findMany({
            where: {
                organizationId,
                type: 'usage',
                createdAt: { gte: firstDayOfMonth }
            },
            select: {
                tool: true,
                amount: true
            }
        });

        if (transactions.length === 0) return [];

        // Group by tool
        const toolTotals: Record<string, { amount: bigint; count: number }> = {};
        let totalAmount = BigInt(0);

        transactions.forEach(t => {
            const tool = t.tool || 'other';
            if (!toolTotals[tool]) {
                toolTotals[tool] = { amount: BigInt(0), count: 0 };
            }
            toolTotals[tool].amount += t.amount;
            toolTotals[tool].count += 1;
            totalAmount += t.amount;
        });

        // Format result
        return Object.entries(toolTotals).map(([tool, stats]) => ({
            tool,
            creditsUsed: stats.amount,
            transactionCount: stats.count,
            percentage: totalAmount > BigInt(0)
                ? Number((stats.amount * BigInt(100)) / totalAmount)
                : 0
        })).sort((a, b) => Number(b.creditsUsed - a.creditsUsed));
    },

    /**
     * Log transaction nel database (a livello organizzazione)
     */
    async logTransaction(
        organizationId: string,
        data: {
            amount: bigint;
            type: string;
            action?: CreditAction;
            tool?: string;
            projectId?: string;
            executedById?: string;
            description?: string;
            metadata?: Record<string, unknown>;
            balanceAfter: bigint;
        }
    ): Promise<void> {
        await prisma.orgCreditTransaction.create({
            data: {
                organizationId,
                amount: data.amount,
                balanceAfter: data.balanceAfter,
                type: data.type,
                tool: data.tool,
                action: data.action,
                projectId: data.projectId,
                executedById: data.executedById,
                description: data.description,
                metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined
            }
        });
    }
};

export default CreditService;

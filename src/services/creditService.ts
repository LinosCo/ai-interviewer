/**
 * Credit Service
 *
 * Gestisce il sistema di crediti per gli utenti.
 * - Consumo crediti per azioni AI
 * - Verifica disponibilità crediti
 * - Acquisto pack crediti
 * - Reset mensile crediti
 */

import { prisma } from '@/lib/prisma';
import { CreditAction, getCreditCost } from '@/config/creditCosts';
import { getCreditPack, calculateUsagePercentage, getWarningLevel } from '@/config/creditPacks';
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

export interface CreditsStatus {
    monthlyLimit: bigint;
    monthlyUsed: bigint;
    monthlyRemaining: bigint;
    packCredits: bigint;
    totalAvailable: bigint;
    usagePercentage: number;
    warningLevel: 'none' | 'warning' | 'danger' | 'critical' | 'exhausted';
    resetDate: Date | null;
    isUnlimited: boolean;
}

export interface CreditUsageByTool {
    tool: string;
    creditsUsed: bigint;
    transactionCount: number;
    percentage: number;
}

export interface PurchaseResult {
    success: boolean;
    creditsAdded: number;
    newPackBalance: bigint;
    error?: string;
    stripeSessionUrl?: string;
}

// ============================================
// CREDIT SERVICE
// ============================================

export const CreditService = {
    /**
     * Consuma crediti per un'azione
     * Prima usa i crediti mensili, poi i pack
     */
    async consumeCredits(
        userId: string,
        action: CreditAction,
        options?: {
            projectId?: string;
            executedById?: string;  // Se diverso dall'owner
            description?: string;
            metadata?: Record<string, unknown>;
            customAmount?: number;  // Per override (es. token effettivi)
        }
    ): Promise<CreditResult> {
        const amount = options?.customAmount ?? getCreditCost(action);

        // Fetch user credits
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                plan: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!user) {
            return {
                success: false,
                creditsUsed: 0,
                creditsRemaining: 0,
                usedFromPack: false,
                error: 'User not found'
            };
        }

        // Check if unlimited (ADMIN)
        if (user.monthlyCreditsLimit === BigInt(-1)) {
            // Log transaction but don't deduct
            await this.logTransaction(userId, {
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

        const monthlyRemaining = user.monthlyCreditsLimit - user.monthlyCreditsUsed;
        const totalAvailable = monthlyRemaining + user.packCreditsAvailable;

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
            usedFromMonthly = monthlyRemaining;
            usedFromPack = BigInt(amount) - monthlyRemaining;
        }

        // Update user credits
        const updatedUser = await prisma.user.update({
            where: { id: userId },
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

        const newMonthlyRemaining = updatedUser.monthlyCreditsLimit - updatedUser.monthlyCreditsUsed;
        const newTotalRemaining = newMonthlyRemaining + updatedUser.packCreditsAvailable;

        // Log transaction
        await this.logTransaction(userId, {
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
            Number(updatedUser.monthlyCreditsUsed),
            Number(updatedUser.monthlyCreditsLimit)
        );
        const warningLevel = getWarningLevel(usagePercentage);

        // Trigger notifications asynchronously (don't await)
        if (warningLevel === 'danger' || warningLevel === 'critical' || warningLevel === 'exhausted') {
            getNotificationService().then(service => {
                service.checkAndNotify(userId, usagePercentage).catch(err => {
                    console.error('[Credits] Notification error:', err);
                });
            });
        }

        return {
            success: true,
            creditsUsed: amount,
            creditsRemaining: Number(newTotalRemaining),
            usedFromPack: usedFromPack > BigInt(0),
            warningLevel
        };
    },

    /**
     * Verifica se l'utente ha crediti sufficienti
     */
    async checkCreditsAvailable(userId: string, requiredAmount: number): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!user) return false;

        // Unlimited
        if (user.monthlyCreditsLimit === BigInt(-1)) return true;

        const monthlyRemaining = user.monthlyCreditsLimit - user.monthlyCreditsUsed;
        const totalAvailable = monthlyRemaining + user.packCreditsAvailable;

        return totalAvailable >= BigInt(requiredAmount);
    },

    /**
     * Ottiene lo stato dei crediti dell'utente
     */
    async getCreditsStatus(userId: string): Promise<CreditsStatus | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!user) return null;

        const isUnlimitedCredits = user.monthlyCreditsLimit === BigInt(-1);
        const monthlyRemaining = isUnlimitedCredits
            ? BigInt(-1)
            : user.monthlyCreditsLimit - user.monthlyCreditsUsed;

        const totalAvailable = isUnlimitedCredits
            ? BigInt(-1)
            : monthlyRemaining + user.packCreditsAvailable;

        const usagePercentage = isUnlimitedCredits
            ? 0
            : calculateUsagePercentage(
                Number(user.monthlyCreditsUsed),
                Number(user.monthlyCreditsLimit)
            );

        return {
            monthlyLimit: user.monthlyCreditsLimit,
            monthlyUsed: user.monthlyCreditsUsed,
            monthlyRemaining,
            packCredits: user.packCreditsAvailable,
            totalAvailable,
            usagePercentage,
            warningLevel: getWarningLevel(usagePercentage),
            resetDate: user.creditsResetDate,
            isUnlimited: isUnlimitedCredits
        };
    },

    /**
     * Ottiene l'utilizzo crediti per tool nel mese corrente
     */
    async getUsageByTool(userId: string): Promise<CreditUsageByTool[]> {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const transactions = await prisma.creditTransaction.groupBy({
            by: ['tool'],
            where: {
                userId,
                type: 'usage',
                createdAt: { gte: startOfMonth },
                tool: { not: null }
            },
            _sum: { amount: true },
            _count: { id: true }
        });

        const totalCredits = transactions.reduce(
            (sum, t) => sum + (t._sum.amount || BigInt(0)),
            BigInt(0)
        );

        return transactions
            .filter(t => t.tool)
            .map(t => ({
                tool: t.tool!,
                creditsUsed: t._sum.amount || BigInt(0),
                transactionCount: t._count.id,
                percentage: totalCredits > BigInt(0)
                    ? Number((t._sum.amount || BigInt(0)) * BigInt(100) / totalCredits)
                    : 0
            }))
            .sort((a, b) => Number(b.creditsUsed - a.creditsUsed));
    },

    /**
     * Acquista un pack di crediti (ritorna URL Stripe o aggiunge direttamente)
     */
    async purchasePack(
        userId: string,
        packId: string,
        options?: { skipStripe?: boolean }
    ): Promise<PurchaseResult> {
        const pack = getCreditPack(packId);
        if (!pack) {
            return {
                success: false,
                creditsAdded: 0,
                newPackBalance: BigInt(0),
                error: 'Pack non trovato'
            };
        }

        // Se skipStripe (per test o admin), aggiungi direttamente
        if (options?.skipStripe) {
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    packCreditsAvailable: { increment: BigInt(pack.credits) }
                },
                select: { packCreditsAvailable: true }
            });

            // Crea record pack
            await prisma.creditPack.create({
                data: {
                    userId,
                    packType: packId,
                    creditsPurchased: BigInt(pack.credits),
                    creditsRemaining: BigInt(pack.credits),
                    pricePaid: pack.price
                }
            });

            // Log transaction
            await this.logTransaction(userId, {
                amount: BigInt(pack.credits),
                type: 'pack_purchase',
                description: `Acquisto ${pack.name}`,
                metadata: { packId, price: pack.price },
                balanceAfter: updatedUser.packCreditsAvailable
            });

            return {
                success: true,
                creditsAdded: pack.credits,
                newPackBalance: updatedUser.packCreditsAvailable
            };
        }

        // Altrimenti ritorna info per creare Stripe session
        return {
            success: true,
            creditsAdded: pack.credits,
            newPackBalance: BigInt(0),
            stripeSessionUrl: `/api/stripe/checkout?pack=${packId}`
        };
    },

    /**
     * Completa l'acquisto pack dopo pagamento Stripe
     */
    async completePurchase(
        userId: string,
        packId: string,
        stripePaymentId: string
    ): Promise<PurchaseResult> {
        const pack = getCreditPack(packId);
        if (!pack) {
            return {
                success: false,
                creditsAdded: 0,
                newPackBalance: BigInt(0),
                error: 'Pack non trovato'
            };
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                packCreditsAvailable: { increment: BigInt(pack.credits) }
            },
            select: { packCreditsAvailable: true }
        });

        // Crea record pack
        await prisma.creditPack.create({
            data: {
                userId,
                packType: packId,
                creditsPurchased: BigInt(pack.credits),
                creditsRemaining: BigInt(pack.credits),
                pricePaid: pack.price,
                stripePaymentId
            }
        });

        // Log transaction
        await this.logTransaction(userId, {
            amount: BigInt(pack.credits),
            type: 'pack_purchase',
            description: `Acquisto ${pack.name}`,
            metadata: { packId, price: pack.price, stripePaymentId },
            balanceAfter: updatedUser.packCreditsAvailable
        });

        return {
            success: true,
            creditsAdded: pack.credits,
            newPackBalance: updatedUser.packCreditsAvailable
        };
    },

    /**
     * Reset crediti mensili per tutti gli utenti
     * Da eseguire via cron job all'inizio di ogni mese
     */
    async resetMonthlyCredits(): Promise<{ usersReset: number }> {
        const now = new Date();

        // Trova utenti da resettare (reset date passata o null)
        const usersToReset = await prisma.user.findMany({
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

        let usersReset = 0;

        for (const user of usersToReset) {
            // Calcola prossima data reset (primo del prossimo mese)
            const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            // Get piano config per limite crediti
            const planConfig = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    monthlyCreditsUsed: BigInt(0),
                    monthlyCreditsLimit: BigInt(planConfig.monthlyCredits),
                    creditsResetDate: nextReset
                }
            });

            // Log reset
            if (user.monthlyCreditsUsed > BigInt(0)) {
                await this.logTransaction(user.id, {
                    amount: user.monthlyCreditsUsed,
                    type: 'monthly_reset',
                    description: 'Reset mensile crediti',
                    metadata: { previousUsed: Number(user.monthlyCreditsUsed) },
                    balanceAfter: BigInt(planConfig.monthlyCredits)
                });
            }

            usersReset++;
        }

        return { usersReset };
    },

    /**
     * Aggiorna il limite crediti quando l'utente cambia piano
     */
    async updatePlanCredits(userId: string, newPlan: PlanType): Promise<void> {
        const planConfig = PLANS[newPlan];
        if (!planConfig) return;

        await prisma.user.update({
            where: { id: userId },
            data: {
                plan: newPlan,
                monthlyCreditsLimit: BigInt(planConfig.monthlyCredits)
            }
        });

        await this.logTransaction(userId, {
            amount: BigInt(0),
            type: 'adjustment',
            description: `Upgrade a piano ${newPlan}`,
            metadata: { newPlan, newLimit: planConfig.monthlyCredits },
            balanceAfter: BigInt(planConfig.monthlyCredits)
        });
    },

    /**
     * Aggiunge crediti manualmente (admin)
     */
    async addCredits(
        userId: string,
        amount: number,
        reason: string
    ): Promise<{ success: boolean; newBalance: bigint }> {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                packCreditsAvailable: { increment: BigInt(amount) }
            },
            select: { packCreditsAvailable: true }
        });

        await this.logTransaction(userId, {
            amount: BigInt(amount),
            type: 'adjustment',
            description: reason,
            balanceAfter: updatedUser.packCreditsAvailable
        });

        return {
            success: true,
            newBalance: updatedUser.packCreditsAvailable
        };
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
     * Log transaction nel database
     */
    async logTransaction(
        userId: string,
        data: {
            amount: bigint;
            type: 'usage' | 'monthly_reset' | 'pack_purchase' | 'adjustment';
            action?: CreditAction;
            tool?: string;
            projectId?: string;
            executedById?: string;
            description?: string;
            metadata?: Record<string, unknown>;
            balanceAfter: bigint;
        }
    ): Promise<void> {
        await prisma.creditTransaction.create({
            data: {
                userId,
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

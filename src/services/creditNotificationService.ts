/**
 * Credit Notification Service
 *
 * Gestisce l'invio di notifiche email basate sull'utilizzo dei crediti.
 * - Invia warning al 85% di utilizzo
 * - Invia alert quando i crediti sono esauriti
 * - Usa la tabella SentNotification (DB) per tracciare le notifiche già inviate,
 *   sopravvivendo a restart/deploy del server.
 *
 * DESIGN NOTE (Sprint 1 Audit):
 * Precedentemente usava un in-memory Map<string, Set<string>> che si azzerava
 * ad ogni restart di Railway, causando invio duplicato di email.
 * Ora usa una tabella DB con constraint UNIQUE (orgId, type, period) per
 * garantire idempotenza anche dopo deploy.
 */

import { prisma } from '@/lib/prisma';
import {
    sendCreditsWarningEmail,
    sendCreditsExhaustedEmail,
    sendCreditsPurchaseConfirmation
} from '@/lib/email';
import { CREDIT_WARNING_THRESHOLDS, formatCredits, getCreditPack } from '@/config/creditPacks';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getOrgRecipients(organizationId: string) {
    const members = await prisma.membership.findMany({
        where: {
            organizationId,
            status: 'ACTIVE',
            receiveAlerts: true
        },
        select: {
            userId: true,
            user: {
                select: {
                    email: true,
                    name: true
                }
            }
        }
    });

    return members
        .map(member => ({
            userId: member.userId,
            email: member.user.email,
            name: member.user.name || 'Utente'
        }))
        .filter(member => Boolean(member.email));
}

/**
 * Check if a notification of the given type has already been sent
 * for this org in the current period (YYYY-MM).
 */
async function hasNotificationBeenSent(
    organizationId: string,
    notificationType: string,
    period: string
): Promise<boolean> {
    const existing = await prisma.sentNotification.findUnique({
        where: {
            organizationId_notificationType_period: {
                organizationId,
                notificationType,
                period
            }
        }
    });
    return !!existing;
}

/**
 * Mark a notification as sent. Uses upsert for idempotency —
 * if another process already recorded it, this is a no-op.
 */
async function markNotificationSent(
    organizationId: string,
    notificationType: string,
    period: string
): Promise<void> {
    await prisma.sentNotification.upsert({
        where: {
            organizationId_notificationType_period: {
                organizationId,
                notificationType,
                period
            }
        },
        create: {
            organizationId,
            notificationType,
            period
        },
        update: {} // No-op if already exists
    });
}

// ── Service ─────────────────────────────────────────────────────────────────

export const CreditNotificationService = {
    /**
     * Verifica e invia notifiche basate sulla percentuale di utilizzo (org-based)
     */
    async checkAndNotifyOrg(organizationId: string, percentage: number): Promise<void> {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!organization) return;
        if (organization.monthlyCreditsLimit === BigInt(-1)) return;

        const recipients = await getOrgRecipients(organizationId);
        if (!recipients.length) return;

        const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

        // Calcola crediti rimanenti
        const monthlyRemaining = Number(organization.monthlyCreditsLimit) - Number(organization.monthlyCreditsUsed);
        const totalRemaining = Math.max(0, monthlyRemaining) + Number(organization.packCreditsAvailable);

        const resetDateFormatted = organization.creditsResetDate
            ? organization.creditsResetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
            : 'il prossimo mese';

        // Warning al 85% (danger)
        if (percentage >= CREDIT_WARNING_THRESHOLDS.danger && percentage < 100) {
            const alreadySent = await hasNotificationBeenSent(organizationId, 'warning', currentMonth);
            if (!alreadySent) {
                await Promise.all(recipients.map(recipient =>
                    sendCreditsWarningEmail({
                        to: recipient.email,
                        userName: recipient.name,
                        percentageUsed: Math.round(percentage),
                        creditsRemaining: formatCredits(totalRemaining),
                        resetDate: resetDateFormatted
                    })
                ));
                await markNotificationSent(organizationId, 'warning', currentMonth);
            }
        }

        // Alert al 100% (exhausted)
        if (percentage >= 100) {
            const alreadySent = await hasNotificationBeenSent(organizationId, 'exhausted', currentMonth);
            if (!alreadySent) {
                await Promise.all(recipients.map(recipient =>
                    sendCreditsExhaustedEmail({
                        to: recipient.email,
                        userName: recipient.name,
                        resetDate: resetDateFormatted
                    })
                ));
                await markNotificationSent(organizationId, 'exhausted', currentMonth);
            }
        }
    },

    /**
     * Compatibilità legacy user-based
     */
    async checkAndNotify(userId: string, percentage: number): Promise<void> {
        const membership = await prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            select: { organizationId: true }
        });

        if (!membership) return;
        await this.checkAndNotifyOrg(membership.organizationId, percentage);
    },

    /**
     * Invia conferma acquisto pack (org-based)
     */
    async sendPurchaseConfirmationForOrg(
        organizationId: string,
        packType: string,
        creditsAdded: number,
        pricePaid?: number
    ): Promise<void> {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!organization) return;

        const recipients = await getOrgRecipients(organizationId);
        if (!recipients.length) return;

        const pack = getCreditPack(packType);
        const packName = pack?.name || packType;
        const amountPaid = typeof pricePaid === 'number' ? pricePaid : (pack?.price ?? 0);

        const monthlyRemaining = Number(organization.monthlyCreditsLimit) - Number(organization.monthlyCreditsUsed);
        const newTotal = Math.max(0, monthlyRemaining) + Number(organization.packCreditsAvailable);

        await Promise.all(recipients.map(recipient =>
            sendCreditsPurchaseConfirmation({
                to: recipient.email,
                userName: recipient.name,
                packName,
                creditsAdded: formatCredits(creditsAdded),
                pricePaid: `€${amountPaid}`,
                newTotal: formatCredits(newTotal)
            })
        ));
    },

    /**
     * Compatibilità legacy user-based
     */
    async sendPurchaseConfirmation(
        userId: string,
        packName: string,
        creditsAdded: number,
        pricePaid: number
    ): Promise<void> {
        const membership = await prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            select: { organizationId: true }
        });

        if (!membership) return;
        await this.sendPurchaseConfirmationForOrg(membership.organizationId, packName, creditsAdded, pricePaid);
    },

    /**
     * Resetta le notifiche inviate per un'organizzazione (da chiamare al reset mensile).
     * Elimina i record del periodo corrente così le notifiche possono essere ri-inviate
     * nel nuovo ciclo.
     */
    async resetOrganizationNotifications(organizationId: string): Promise<void> {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await prisma.sentNotification.deleteMany({
            where: {
                organizationId,
                period: currentMonth
            }
        });
    },

    /**
     * Compatibilità legacy user-based
     */
    async resetUserNotifications(userId: string): Promise<void> {
        const membership = await prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            select: { organizationId: true }
        });
        if (!membership) return;
        await this.resetOrganizationNotifications(membership.organizationId);
    },

    /**
     * Resetta tutte le notifiche (da chiamare al reset mensile globale).
     * Elimina tutti i record del mese corrente.
     */
    async resetAllNotifications(): Promise<void> {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await prisma.sentNotification.deleteMany({
            where: { period: currentMonth }
        });
    },

    /**
     * Pulizia record vecchi (> 3 mesi).
     * Opzionale, da chiamare periodicamente per non accumulare dati.
     */
    async cleanupOldNotifications(): Promise<number> {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const thresholdPeriod = threeMonthsAgo.toISOString().slice(0, 7);

        const result = await prisma.sentNotification.deleteMany({
            where: { period: { lt: thresholdPeriod } }
        });
        return result.count;
    }
};

export default CreditNotificationService;

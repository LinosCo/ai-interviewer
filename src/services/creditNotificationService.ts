/**
 * Credit Notification Service
 *
 * Gestisce l'invio di notifiche email basate sull'utilizzo dei crediti.
 * - Invia warning al 85% di utilizzo
 * - Invia alert quando i crediti sono esauriti
 * - Tiene traccia delle notifiche già inviate per evitare spam
 */

import { prisma } from '@/lib/prisma';
import {
    sendCreditsWarningEmail,
    sendCreditsExhaustedEmail,
    sendCreditsPurchaseConfirmation
} from '@/lib/email';
import { CREDIT_WARNING_THRESHOLDS, formatCredits, getCreditPack } from '@/config/creditPacks';

// Chiavi per tracciare notifiche già inviate (in memory per semplicità)
// In produzione, usare Redis o un campo nel database
const notificationsSent = new Map<string, Set<string>>();

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

        const orgNotifications = notificationsSent.get(organizationId) || new Set();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        // Calcola crediti rimanenti
        const monthlyRemaining = Number(organization.monthlyCreditsLimit) - Number(organization.monthlyCreditsUsed);
        const totalRemaining = Math.max(0, monthlyRemaining) + Number(organization.packCreditsAvailable);

        const resetDateFormatted = organization.creditsResetDate
            ? organization.creditsResetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
            : 'il prossimo mese';

        // Warning al 85% (danger)
        if (percentage >= CREDIT_WARNING_THRESHOLDS.danger && percentage < 100) {
            const key = `warning_${currentMonth}`;
            if (!orgNotifications.has(key)) {
                await Promise.all(recipients.map(recipient =>
                    sendCreditsWarningEmail({
                        to: recipient.email,
                        userName: recipient.name,
                        percentageUsed: Math.round(percentage),
                        creditsRemaining: formatCredits(totalRemaining),
                        resetDate: resetDateFormatted
                    })
                ));
                orgNotifications.add(key);
                notificationsSent.set(organizationId, orgNotifications);
            }
        }

        // Alert al 100% (exhausted)
        if (percentage >= 100) {
            const key = `exhausted_${currentMonth}`;
            if (!orgNotifications.has(key)) {
                await Promise.all(recipients.map(recipient =>
                    sendCreditsExhaustedEmail({
                        to: recipient.email,
                        userName: recipient.name,
                        resetDate: resetDateFormatted
                    })
                ));
                orgNotifications.add(key);
                notificationsSent.set(organizationId, orgNotifications);
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
     * Resetta le notifiche inviate per un utente (da chiamare al reset mensile)
     */
    resetUserNotifications(userId: string): void {
        notificationsSent.delete(userId);
    },

    /**
     * Resetta notifiche inviate per organizzazione
     */
    resetOrganizationNotifications(organizationId: string): void {
        notificationsSent.delete(organizationId);
    },

    /**
     * Resetta tutte le notifiche (da chiamare al reset mensile globale)
     */
    resetAllNotifications(): void {
        notificationsSent.clear();
    }
};

export default CreditNotificationService;

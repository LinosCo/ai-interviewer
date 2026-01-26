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
import { CREDIT_WARNING_THRESHOLDS, formatCredits } from '@/config/creditPacks';

// Chiavi per tracciare notifiche già inviate (in memory per semplicità)
// In produzione, usare Redis o un campo nel database
const notificationsSent = new Map<string, Set<string>>();

export const CreditNotificationService = {
    /**
     * Verifica e invia notifiche basate sulla percentuale di utilizzo
     */
    async checkAndNotify(userId: string, percentage: number): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                name: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true,
                creditsResetDate: true
            }
        });

        if (!user?.email) return;

        const userNotifications = notificationsSent.get(userId) || new Set();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        // Calcola crediti rimanenti
        const monthlyRemaining = Number(user.monthlyCreditsLimit) - Number(user.monthlyCreditsUsed);
        const totalRemaining = monthlyRemaining + Number(user.packCreditsAvailable);

        const resetDateFormatted = user.creditsResetDate
            ? user.creditsResetDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
            : 'il prossimo mese';

        // Warning al 85% (danger)
        if (percentage >= CREDIT_WARNING_THRESHOLDS.danger && percentage < 100) {
            const key = `warning_${currentMonth}`;
            if (!userNotifications.has(key)) {
                await sendCreditsWarningEmail({
                    to: user.email,
                    userName: user.name || 'Utente',
                    percentageUsed: Math.round(percentage),
                    creditsRemaining: formatCredits(totalRemaining),
                    resetDate: resetDateFormatted
                });
                userNotifications.add(key);
                notificationsSent.set(userId, userNotifications);
                console.log(`[Credits] Warning email sent to ${user.email}`);
            }
        }

        // Alert al 100% (exhausted)
        if (percentage >= 100) {
            const key = `exhausted_${currentMonth}`;
            if (!userNotifications.has(key)) {
                await sendCreditsExhaustedEmail({
                    to: user.email,
                    userName: user.name || 'Utente',
                    resetDate: resetDateFormatted
                });
                userNotifications.add(key);
                notificationsSent.set(userId, userNotifications);
                console.log(`[Credits] Exhausted email sent to ${user.email}`);
            }
        }
    },

    /**
     * Invia conferma acquisto pack
     */
    async sendPurchaseConfirmation(
        userId: string,
        packName: string,
        creditsAdded: number,
        pricePaid: number
    ): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                email: true,
                name: true,
                monthlyCreditsLimit: true,
                monthlyCreditsUsed: true,
                packCreditsAvailable: true
            }
        });

        if (!user?.email) return;

        const monthlyRemaining = Number(user.monthlyCreditsLimit) - Number(user.monthlyCreditsUsed);
        const newTotal = monthlyRemaining + Number(user.packCreditsAvailable);

        await sendCreditsPurchaseConfirmation({
            to: user.email,
            userName: user.name || 'Utente',
            packName,
            creditsAdded: formatCredits(creditsAdded),
            pricePaid: `€${pricePaid}`,
            newTotal: formatCredits(newTotal)
        });

        console.log(`[Credits] Purchase confirmation sent to ${user.email}`);
    },

    /**
     * Resetta le notifiche inviate per un utente (da chiamare al reset mensile)
     */
    resetUserNotifications(userId: string): void {
        notificationsSent.delete(userId);
    },

    /**
     * Resetta tutte le notifiche (da chiamare al reset mensile globale)
     */
    resetAllNotifications(): void {
        notificationsSent.clear();
    }
};

export default CreditNotificationService;

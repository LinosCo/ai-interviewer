/**
 * API Route: /api/cron/partner-fees
 *
 * Cron job per calcolo fee e status partner
 * Da eseguire il primo giorno di ogni mese
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PartnerService } from '@/services/partnerService';
import { PARTNER_THRESHOLDS } from '@/config/plans';
import { sendPartnerTrialExpiredEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        // Verifica cron secret
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        console.log('[Cron] Avvio calcolo fee partner...');

        const partners = await prisma.user.findMany({
            where: { isPartner: true }
        });

        let updated = 0;
        let trialsExpired = 0;
        let gracePeriodsEnded = 0;

        for (const partner of partners) {
            const now = new Date();

            // 1. Controlla trial scaduto
            if (partner.partnerStatus === 'trial' && partner.partnerTrialEndDate) {
                if (now > partner.partnerTrialEndDate) {
                    const activeClientsAtExpiry = await PartnerService.getActiveClientsCount(partner.id);

                    await prisma.user.update({
                        where: { id: partner.id },
                        data: { partnerStatus: 'active' }
                    });

                    if (partner.email && activeClientsAtExpiry < PARTNER_THRESHOLDS.freeThreshold) {
                        await sendPartnerTrialExpiredEmail({
                            to: partner.email,
                            userName: partner.name || 'Partner',
                            activeClients: activeClientsAtExpiry,
                            requiredClients: PARTNER_THRESHOLDS.freeThreshold
                        }).catch((err) => {
                            console.error('[Cron] Errore invio email fine trial partner:', err);
                        });
                    }
                    trialsExpired++;
                }
            }

            // 2. Conta clienti attivi (con attribuzioni)
            const activeClients = await PartnerService.getActiveClientsCount(partner.id);

            // 3. Calcola fee e white label
            let newFee: number = PARTNER_THRESHOLDS.baseMonthlyFee;
            let newWhiteLabel = false;

            if (activeClients >= PARTNER_THRESHOLDS.whiteLabelThreshold) {
                newFee = 0;
                newWhiteLabel = true;
            } else if (activeClients >= PARTNER_THRESHOLDS.freeThreshold) {
                newFee = 0;
            }

            // 4. Gestione grace period
            if (partner.partnerFee === 0 && newFee > 0) {
                if (!partner.partnerGracePeriodStart) {
                    // Inizia grace period
                    await prisma.user.update({
                        where: { id: partner.id },
                        data: {
                            partnerGracePeriodStart: now,
                            partnerActiveClients: activeClients
                        }
                    });
                    continue;
                } else {
                    // Controlla se grace period è finito
                    const graceEnd = new Date(partner.partnerGracePeriodStart);
                    graceEnd.setDate(graceEnd.getDate() + PARTNER_THRESHOLDS.gracePeriodDays);

                    if (now < graceEnd) {
                        // Ancora in grace period
                        await prisma.user.update({
                            where: { id: partner.id },
                            data: { partnerActiveClients: activeClients }
                        });
                        continue;
                    }
                    gracePeriodsEnded++;
                }
            }

            // 5. Aggiorna partner
            await prisma.user.update({
                where: { id: partner.id },
                data: {
                    partnerActiveClients: activeClients,
                    partnerFee: newFee,
                    partnerWhiteLabel: newWhiteLabel,
                    partnerGracePeriodStart: newFee === 0 ? null : partner.partnerGracePeriodStart
                }
            });

            updated++;
        }

        console.log(
            `[Cron] Partner fee completato: ${updated} aggiornati, ${trialsExpired} trial scaduti, ${gracePeriodsEnded} grace period terminati`
        );

        return NextResponse.json({
            success: true,
            stats: {
                partnersProcessed: partners.length,
                updated,
                trialsExpired,
                gracePeriodsEnded
            }
        });
    } catch (error) {
        console.error('[Cron] Errore calcolo fee:', error);
        return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
    }
}

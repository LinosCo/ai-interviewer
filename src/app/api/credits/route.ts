/**
 * API Route: /api/credits
 *
 * GET: Restituisce stato crediti utente corrente
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CreditService } from '@/services/creditService';
import { formatCredits } from '@/config/creditPacks';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organizationId');

        let status;
        if (organizationId) {
            // Verifica access per sicurezza
            const membership = await prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: session.user.id,
                        organizationId
                    }
                }
            });
            if (!membership) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
            status = await CreditService.getOrganizationCreditsStatus(organizationId);
        } else {
            status = await CreditService.getCreditsStatus(session.user.id);
        }

        if (!status) {
            return NextResponse.json({ error: 'Status non trovato' }, { status: 404 });
        }

        // Calcola prossima data reset formattata
        const resetDateFormatted = status.resetDate
            ? status.resetDate.toISOString().split('T')[0]
            : null;

        return NextResponse.json({
            monthlyLimit: Number(status.monthlyLimit),
            monthlyUsed: Number(status.monthlyUsed),
            monthlyRemaining: Number(status.monthlyRemaining),
            packAvailable: Number(status.packCredits),
            totalAvailable: Number(status.totalAvailable),
            percentageUsed: status.usagePercentage,
            resetDate: resetDateFormatted,
            alertLevel: status.warningLevel === 'none' ? null : status.warningLevel,
            isUnlimited: status.isUnlimited,
            // Formatted versions for UI
            formatted: {
                monthlyLimit: formatCredits(Number(status.monthlyLimit)),
                monthlyUsed: formatCredits(Number(status.monthlyUsed)),
                monthlyRemaining: formatCredits(Number(status.monthlyRemaining)),
                packAvailable: formatCredits(Number(status.packCredits)),
                totalAvailable: formatCredits(Number(status.totalAvailable))
            }
        });
    } catch (error) {
        console.error('Error fetching credits:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei crediti' },
            { status: 500 }
        );
    }
}

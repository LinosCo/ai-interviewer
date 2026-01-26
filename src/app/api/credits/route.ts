/**
 * API Route: /api/credits
 *
 * GET: Restituisce stato crediti utente corrente
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CreditService } from '@/services/creditService';
import { formatCredits } from '@/config/creditPacks';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const status = await CreditService.getCreditsStatus(session.user.id);
        if (!status) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
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

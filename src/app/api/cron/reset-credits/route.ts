/**
 * API Route: /api/cron/reset-credits
 *
 * Cron job per il reset mensile dei crediti
 * Da chiamare ogni giorno a mezzanotte
 *
 * Protezione: richiede CRON_SECRET header
 */

import { NextResponse } from 'next/server';
import { CreditService } from '@/services/creditService';

export async function POST(request: Request) {
    try {
        // Auth: Bearer token obbligatorio per cron job
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json(
                { error: 'Non autorizzato' },
                { status: 401 }
            );
        }

        console.log('[Cron] Starting monthly credits reset...');

        const result = await CreditService.resetMonthlyCredits();

        console.log(`[Cron] Credits reset completed. Organizations reset: ${result.organizationsReset}`);

        return NextResponse.json({
            success: true,
            organizationsReset: result.organizationsReset,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Cron] Error resetting credits:', error);
        return NextResponse.json(
            { error: 'Errore nel reset dei crediti' },
            { status: 500 }
        );
    }
}

/**
 * GET: Health check per il cron job
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: 'reset-credits',
        description: 'Cron job per il reset mensile dei crediti'
    });
}

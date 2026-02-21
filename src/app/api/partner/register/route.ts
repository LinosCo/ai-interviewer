/**
 * API Route: /api/partner/register
 *
 * POST: Registra l'utente come partner (avvia trial 90 giorni)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const result = await PartnerService.registerAsPartner(session.user.id);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const status = await PartnerService.getPartnerStatus(session.user.id);

        return NextResponse.json({
            success: true,
            message: 'Registrazione come partner completata',
            status
        });
    } catch (error) {
        console.error('Error registering as partner:', error);
        return NextResponse.json(
            { error: 'Errore durante la registrazione' },
            { status: 500 }
        );
    }
}

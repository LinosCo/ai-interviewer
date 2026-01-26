/**
 * API Route: /api/partner/transfer/accept
 *
 * POST: Accetta un invito di trasferimento progetto
 * Body: { token: string }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'Token richiesto' },
                { status: 400 }
            );
        }

        const result = await PartnerService.acceptProjectTransfer({
            token,
            acceptingUserId: session.user.id
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Progetto trasferito con successo'
        });
    } catch (error) {
        console.error('Error accepting transfer:', error);
        return NextResponse.json(
            { error: 'Errore nell\'accettazione del trasferimento' },
            { status: 500 }
        );
    }
}

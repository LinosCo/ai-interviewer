/**
 * API Route: /api/partner/logo
 *
 * PUT: Aggiorna il logo personalizzato del partner (solo con white label)
 * Body: { logoUrl: string | null }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';

export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const body = await request.json();
        const { logoUrl } = body;

        // Valida URL se presente
        if (logoUrl && typeof logoUrl === 'string') {
            try {
                new URL(logoUrl);
            } catch {
                return NextResponse.json(
                    { error: 'URL logo non valido' },
                    { status: 400 }
                );
            }
        }

        const result = await PartnerService.updateCustomLogo(
            session.user.id,
            logoUrl || null
        );

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Logo aggiornato'
        });
    } catch (error) {
        console.error('Error updating partner logo:', error);
        return NextResponse.json(
            { error: 'Errore nell\'aggiornamento del logo' },
            { status: 500 }
        );
    }
}

/**
 * GET: Ottiene il logo personalizzato del partner
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const status = await PartnerService.getPartnerStatus(session.user.id);

        return NextResponse.json({
            hasWhiteLabel: status?.hasWhiteLabel || false,
            customLogo: status?.customLogo || null
        });
    } catch (error) {
        console.error('Error fetching partner logo:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero del logo' },
            { status: 500 }
        );
    }
}

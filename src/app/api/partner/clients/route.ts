/**
 * API Route: /api/partner/clients
 *
 * GET: Ottiene la lista dettagliata dei clienti del partner con attribuzioni
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        // Verifica che sia partner
        const status = await PartnerService.getPartnerStatus(session.user.id);
        if (!status?.isPartner) {
            return NextResponse.json(
                { error: 'Non sei registrato come partner' },
                { status: 403 }
            );
        }

        // Ottieni lista clienti dettagliata con attribuzioni
        const clientsData = await PartnerService.getPartnerClientsDetailed(session.user.id);

        return NextResponse.json(clientsData);
    } catch (error) {
        console.error('Error fetching partner clients:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei clienti' },
            { status: 500 }
        );
    }
}

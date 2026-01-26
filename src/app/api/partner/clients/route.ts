/**
 * API Route: /api/partner/clients
 *
 * GET: Ottiene la lista dei clienti del partner
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

        const status = await PartnerService.getPartnerStatus(session.user.id);
        if (!status?.isPartner) {
            return NextResponse.json({ error: 'Non sei un partner' }, { status: 403 });
        }

        const clients = await PartnerService.getPartnerClients(session.user.id);

        return NextResponse.json({
            clients,
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'active').length
        });
    } catch (error) {
        console.error('Error fetching partner clients:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei clienti' },
            { status: 500 }
        );
    }
}

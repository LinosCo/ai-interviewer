/**
 * API Route: /api/partner/status
 *
 * GET: Ottiene lo status del partner corrente
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';
import { PARTNER_THRESHOLDS } from '@/config/plans';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const status = await PartnerService.getPartnerStatus(session.user.id);

        if (!status) {
            return NextResponse.json({
                isPartner: false,
                canRegister: true,
                thresholds: PARTNER_THRESHOLDS
            });
        }

        return NextResponse.json({
            ...status,
            thresholds: PARTNER_THRESHOLDS
        });
    } catch (error) {
        console.error('Error fetching partner status:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dello status' },
            { status: 500 }
        );
    }
}

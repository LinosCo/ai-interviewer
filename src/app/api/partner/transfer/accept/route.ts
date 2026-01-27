/**
 * API Route: /api/partner/transfer/accept
 *
 * POST: Accetta un invito di trasferimento progetto
 * Body: { token: string }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PartnerService } from '@/services/partnerService';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const body = await request.json();
        const { token, targetOrganizationId } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'Token richiesto' },
                { status: 400 }
            );
        }

        let orgId = targetOrganizationId;
        if (!orgId) {
            const membership = await prisma.membership.findFirst({
                where: { userId: session.user.id },
                select: { organizationId: true }
            });
            orgId = membership?.organizationId;
        }

        if (!orgId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const result = await PartnerService.acceptProjectTransfer({
            token,
            acceptingUserId: session.user.id,
            targetOrganizationId: orgId
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

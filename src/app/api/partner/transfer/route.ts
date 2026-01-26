/**
 * API Route: /api/partner/transfer
 *
 * POST: Crea un invito per trasferire un progetto
 * Body: { projectId: string, toEmail: string }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PartnerService } from '@/services/partnerService';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const body = await request.json();
        const { projectId, toEmail } = body;

        if (!projectId || !toEmail) {
            return NextResponse.json(
                { error: 'projectId e toEmail sono richiesti' },
                { status: 400 }
            );
        }

        // Valida email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(toEmail)) {
            return NextResponse.json(
                { error: 'Email non valida' },
                { status: 400 }
            );
        }

        const result = await PartnerService.createProjectTransferInvite({
            fromUserId: session.user.id,
            projectId,
            toEmail
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Invia email di invito
        try {
            await sendEmail({
                to: toEmail,
                subject: 'Invito a ricevere un progetto su Business Tuner',
                html: `
                    <h2>Hai ricevuto un progetto!</h2>
                    <p>${session.user.name || session.user.email} vuole trasferirti un progetto su Business Tuner.</p>
                    <p>Clicca il link qui sotto per accettare il trasferimento:</p>
                    <a href="${result.inviteUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Accetta il progetto
                    </a>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        Questo link scade tra 7 giorni.
                    </p>
                `
            });
        } catch (emailError) {
            console.error('Error sending transfer email:', emailError);
            // Non blocchiamo se l'email fallisce, l'invito è comunque creato
        }

        return NextResponse.json({
            success: true,
            inviteId: result.inviteId,
            inviteUrl: result.inviteUrl,
            message: `Invito inviato a ${toEmail}`
        });
    } catch (error) {
        console.error('Error creating transfer invite:', error);
        return NextResponse.json(
            { error: 'Errore nella creazione dell\'invito' },
            { status: 500 }
        );
    }
}

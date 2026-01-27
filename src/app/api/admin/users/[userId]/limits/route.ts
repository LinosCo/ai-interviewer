/**
 * API Route: /api/admin/users/[userId]/limits
 *
 * PATCH: Aggiorna piano e limiti crediti di un utente (solo admin)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/config/plans';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        // Verifica che sia admin
        const admin = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        if (admin?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
        }

        const { userId } = await params;
        const body = await request.json();
        const { plan, monthlyCreditsLimit } = body;

        // Valida il piano
        if (plan && !Object.values(PlanType).includes(plan as PlanType)) {
            return NextResponse.json({ error: 'Piano non valido' }, { status: 400 });
        }

        // Prepara i dati da aggiornare
        const updateData: Record<string, unknown> = {};

        if (plan) {
            updateData.plan = plan;

            // Se cambia piano, aggiorna anche i limiti di default del piano
            const planConfig = PLANS[plan as PlanType];
            if (planConfig) {
                updateData.monthlyCreditsLimit = BigInt(planConfig.monthlyCredits);
            }
        }

        // Override manuale dei crediti (se specificato)
        if (monthlyCreditsLimit !== undefined) {
            updateData.monthlyCreditsLimit = BigInt(monthlyCreditsLimit);
        }

        // Aggiorna l'utente
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                plan: true,
                monthlyCreditsLimit: true
            }
        });

        return NextResponse.json({
            success: true,
            user: {
                ...updatedUser,
                monthlyCreditsLimit: Number(updatedUser.monthlyCreditsLimit)
            }
        });
    } catch (error) {
        console.error('Error updating user limits:', error);
        return NextResponse.json(
            { error: 'Errore nell\'aggiornamento' },
            { status: 500 }
        );
    }
}

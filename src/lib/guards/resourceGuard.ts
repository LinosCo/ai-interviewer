import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { CreditAction } from '@/config/creditCosts';
import { NextResponse } from 'next/server';

type GuardResult = {
    allowed: boolean;
    error?: string;
    status?: number;
    code?: 'CREDITS_EXHAUSTED' | 'ACCESS_DENIED';
    userId?: string;
    organizationId?: string | null;
    creditsNeeded?: number;
    creditsAvailable?: number;
};

/**
 * Mappa i vecchi resourceType ai nuovi CreditAction
 */
const resourceToAction: Record<string, CreditAction> = {
    'TOKENS': 'interview_question',
    'INTERVIEW': 'interview_question',
    'CHATBOT_SESSION': 'chatbot_session_message',
    'VISIBILITY_QUERY': 'visibility_query',
    'AI_SUGGESTION': 'ai_tip_generation'
};

/**
 * Verifica se l'utente può usare una risorsa
 *
 * Il controllo viene fatto sul PROPRIETARIO del progetto.
 * Il piano dell'owner determina le feature disponibili.
 *
 * @param resourceType - Tipo di risorsa da verificare
 * @param tokensNeeded - Token necessari (opzionale)
 * @param options - projectId per determinare l'owner
 */
export async function checkResourceAccess(
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION',
    tokensNeeded: number = 0,
    options?: { projectId?: string }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    const currentUserId = session.user.id;
    const currentUserRole = ('role' in session.user ? (session.user as { role?: string }).role : undefined);
    let organizationId: string | null = null;

    // 1. Determina l'organizzazione
    if (options?.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: options.projectId },
            select: { organizationId: true }
        });
        organizationId = project?.organizationId || null;
    }

    // 2. Fallback alla prima organizzazione dell'utente (o quella personale) se manca projectId o orgId
    if (!organizationId) {
        const membership = await prisma.membership.findFirst({
            where: { userId: currentUserId, status: 'ACTIVE' },
            select: { organizationId: true }
        });
        organizationId = membership?.organizationId || null;
    }

    if (currentUserRole === 'ADMIN') {
        return {
            allowed: true,
            userId: currentUserId,
            organizationId
        };
    }

    if (!organizationId) {
        return { allowed: false, error: 'Nessuna organizzazione trovata per l\'utente', status: 403 };
    }

    // Verifica crediti e piano dell'organizzazione
    const action = resourceToAction[resourceType] || 'interview_question';
    const check = await TokenTrackingService.checkCanUseResource({
        organizationId,
        action,
        customAmount: tokensNeeded > 0 ? tokensNeeded : undefined
    });

    if (!check.allowed) {
        const isCreditsExhausted = check.reason === 'Crediti insufficienti';
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: isCreditsExhausted ? 429 : 403,
            code: isCreditsExhausted ? 'CREDITS_EXHAUSTED' : 'ACCESS_DENIED',
            userId: currentUserId,
            organizationId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        userId: currentUserId,
        organizationId,
        creditsNeeded: check.creditsNeeded,
        creditsAvailable: check.creditsAvailable
    };
}

/**
 * Wrapper per API route handler con verifica crediti
 */
export function withResourceGuard(
    handler: (req: Request, context: Record<string, unknown>) => Promise<Response>,
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION'
) {
    return async (req: Request, ...args: unknown[]) => {
        const access = await checkResourceAccess(resourceType) as GuardResult;

        if (!access.allowed) {
            return NextResponse.json({
                code: access.code || 'ACCESS_DENIED',
                error: access.error,
                creditsNeeded: access.creditsNeeded,
                creditsAvailable: access.creditsAvailable
            }, { status: access.status });
        }

        return handler(req, {
                ...((args[0] as Record<string, unknown>) || {}),
                userId: access.userId,
                organizationId: access.organizationId
            });
    };
}

/**
 * Verifica crediti per azione specifica
 */
export async function checkCreditsForAction(
    action: CreditAction,
    customAmount?: number,
    projectId?: string
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    const currentUserId = session.user.id;
    const currentUserRole = ('role' in session.user ? (session.user as { role?: string }).role : undefined);
    let organizationId: string | null = null;

    if (projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });
        organizationId = project?.organizationId || null;
    }

    if (!organizationId) {
        const membership = await prisma.membership.findFirst({
            where: { userId: currentUserId, status: 'ACTIVE' },
            select: { organizationId: true }
        });
        organizationId = membership?.organizationId || null;
    }

    if (currentUserRole === 'ADMIN') {
        return {
            allowed: true,
            userId: currentUserId,
            organizationId
        };
    }

    if (!organizationId) {
        return { allowed: false, error: 'Organizzazione non trovata', status: 403 };
    }

    const check = await TokenTrackingService.checkCanUseResource({
        organizationId,
        action,
        customAmount
    });

    if (!check.allowed) {
        const isCreditsExhausted = check.reason === 'Crediti insufficienti';
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: isCreditsExhausted ? 429 : 403,
            code: isCreditsExhausted ? 'CREDITS_EXHAUSTED' : 'ACCESS_DENIED',
            userId: currentUserId,
            organizationId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        userId: currentUserId,
        organizationId,
        creditsNeeded: check.creditsNeeded,
        creditsAvailable: check.creditsAvailable
    };
}

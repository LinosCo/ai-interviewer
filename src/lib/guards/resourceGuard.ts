import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { CreditAction } from '@/config/creditCosts';
import { NextResponse } from 'next/server';

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
    let ownerId = currentUserId; // Default: utente loggato

    // Se è specificato un projectId, usa il proprietario del progetto
    if (options?.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: options.projectId },
            select: { ownerId: true }
        });

        if (project?.ownerId) {
            ownerId = project.ownerId;
        }
    }

    // Verifica crediti e piano dell'owner
    const action = resourceToAction[resourceType] || 'interview_question';
    const check = await TokenTrackingService.checkCanUseResource({
        userId: ownerId,
        action,
        customAmount: tokensNeeded > 0 ? tokensNeeded : undefined
    });

    if (!check.allowed) {
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: 403,
            userId: currentUserId,
            ownerId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        userId: currentUserId,
        ownerId,
        creditsNeeded: check.creditsNeeded,
        creditsAvailable: check.creditsAvailable
    };
}

/**
 * Wrapper per API route handler con verifica crediti
 */
export function withResourceGuard(
    handler: Function,
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION'
) {
    return async (req: Request, ...args: any[]) => {
        const access = await checkResourceAccess(resourceType);

        if (!access.allowed) {
            return NextResponse.json({
                error: access.error,
                creditsNeeded: access.creditsNeeded,
                creditsAvailable: access.creditsAvailable
            }, { status: access.status });
        }

        return handler(req, {
            ...args[0],
            userId: access.userId,
            ownerId: access.ownerId
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

    let ownerId = session.user.id;

    // Se c'è un projectId, usa l'owner del progetto
    if (projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });
        if (project?.ownerId) {
            ownerId = project.ownerId;
        }
    }

    const check = await TokenTrackingService.checkCanUseResource({
        userId: ownerId,
        action,
        customAmount
    });

    if (!check.allowed) {
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: 403,
            userId: session.user.id,
            ownerId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        userId: session.user.id,
        ownerId,
        creditsNeeded: check.creditsNeeded,
        creditsAvailable: check.creditsAvailable
    };
}

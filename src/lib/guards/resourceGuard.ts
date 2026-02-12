import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { CreditAction } from '@/config/creditCosts';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

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

async function resolveOrganizationIdForUser(userId: string, projectId?: string): Promise<string | null> {
    if (projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });
        if (project?.organizationId) {
            return project.organizationId;
        }
    }

    return resolveActiveOrganizationIdForUser(userId);
}

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
    const organizationId = await resolveOrganizationIdForUser(currentUserId, options?.projectId);

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
    projectId?: string,
    forcedOrganizationId?: string
) {
    const session = await auth();
    if (!session?.user?.id) {
        // Public interview links must work for anonymous users.
        // In that case we can charge credits directly to the interview owner's organization.
        if (!forcedOrganizationId) {
            return { allowed: false, error: 'Unauthorized', status: 401 };
        }

        const check = await TokenTrackingService.checkCanUseResource({
            organizationId: forcedOrganizationId,
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
                userId: undefined,
                organizationId: forcedOrganizationId,
                creditsNeeded: check.creditsNeeded,
                creditsAvailable: check.creditsAvailable
            };
        }

        return {
            allowed: true,
            userId: undefined,
            organizationId: forcedOrganizationId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    const currentUserId = session.user.id;
    const currentUserRole = ('role' in session.user ? (session.user as { role?: string }).role : undefined);

    if (currentUserRole === 'ADMIN') {
        return {
            allowed: true,
            userId: currentUserId,
            organizationId: forcedOrganizationId || await resolveOrganizationIdForUser(currentUserId, projectId)
        };
    }

    let organizationId: string | null = null;

    if (forcedOrganizationId) {
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: currentUserId,
                    organizationId: forcedOrganizationId
                }
            },
            select: { organizationId: true, status: true }
        });

        if (membership?.status !== 'ACTIVE') {
            return { allowed: false, error: 'Organizzazione non accessibile', status: 403 };
        }

        organizationId = forcedOrganizationId;
    } else {
        organizationId = await resolveOrganizationIdForUser(currentUserId, projectId);
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

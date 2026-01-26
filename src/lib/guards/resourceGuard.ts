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
 * Verifica se l'utente ha crediti sufficienti per usare una risorsa
 * Sistema basato su USER, non su organization
 */
export async function checkResourceAccess(
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION',
    tokensNeeded: number = 0
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    const userId = session.user.id;

    // Ottieni organizationId per backward compatibility
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            memberships: {
                take: 1
            }
        }
    });

    const organizationId = user?.memberships[0]?.organizationId;

    // Usa il nuovo sistema di crediti per utente
    const action = resourceToAction[resourceType] || 'interview_question';
    const check = await TokenTrackingService.checkCanUseResource({
        userId,
        action,
        customAmount: tokensNeeded > 0 ? tokensNeeded : undefined
    });

    if (!check.allowed) {
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: 403,
            organizationId,
            userId,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        organizationId,
        userId,
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

        // Passa userId e organizationId al handler
        return handler(req, {
            ...args[0],
            organizationId: access.organizationId,
            userId: access.userId
        });
    };
}

/**
 * Verifica crediti con nuovo sistema (CreditAction based)
 */
export async function checkCreditsForAction(
    action: CreditAction,
    customAmount?: number
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    const check = await TokenTrackingService.checkCanUseResource({
        userId: session.user.id,
        action,
        customAmount
    });

    if (!check.allowed) {
        return {
            allowed: false,
            error: check.reason || 'Crediti insufficienti',
            status: 403,
            userId: session.user.id,
            creditsNeeded: check.creditsNeeded,
            creditsAvailable: check.creditsAvailable
        };
    }

    return {
        allowed: true,
        userId: session.user.id,
        creditsNeeded: check.creditsNeeded,
        creditsAvailable: check.creditsAvailable
    };
}

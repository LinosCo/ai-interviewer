import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { NextResponse } from 'next/server';

export async function checkResourceAccess(
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION',
    tokensNeeded: number = 0
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { allowed: false, error: 'Unauthorized', status: 401 };
    }

    // Ottieni organizationId dell'utente
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            memberships: {
                take: 1
            }
        }
    });

    const organizationId = user?.memberships[0]?.organizationId;
    if (!organizationId) {
        return { allowed: false, error: 'No organization found', status: 404 };
    }

    const check = await TokenTrackingService.checkCanUseResource({
        organizationId,
        resourceType,
        tokensNeeded
    });

    if (!check.allowed) {
        return {
            allowed: false,
            error: check.reason,
            status: 403,
            organizationId
        };
    }

    return { allowed: true, organizationId, userId: session.user.id };
}

/**
 * Wrapper per API route handler
 */
export function withResourceGuard(
    handler: Function,
    resourceType: 'TOKENS' | 'INTERVIEW' | 'CHATBOT_SESSION' | 'VISIBILITY_QUERY' | 'AI_SUGGESTION'
) {
    return async (req: Request, ...args: any[]) => {
        const access = await checkResourceAccess(resourceType);

        if (!access.allowed) {
            return NextResponse.json({ error: access.error }, { status: access.status });
        }

        // Passa organizationId al handler
        return handler(req, { ...args[0], organizationId: access.organizationId, userId: access.userId });
    };
}

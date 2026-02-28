/**
 * POST /api/chatbot/sessions/[conversationId]/rating
 *
 * Stores an end-user thumbs-up / thumbs-down rating for a chatbot session.
 * No authentication required — this endpoint is called from public chatbot widgets.
 *
 * The rating is stored in Conversation.metadata as { userRating: 'UP' | 'DOWN' }
 * to avoid any schema migration.  Toggling the same value removes the rating.
 *
 * Body: { rating: 'UP' | 'DOWN' }
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    try {
        const { conversationId } = await params;
        if (!conversationId) {
            return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
        }

        const body = await req.json();
        const { rating } = body as { rating?: string };

        if (!rating || !['UP', 'DOWN'].includes(rating)) {
            return NextResponse.json(
                { error: "rating must be 'UP' or 'DOWN'" },
                { status: 400 }
            );
        }

        // Load conversation — only need its existence + current metadata
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { id: true, metadata: true }
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Toggle: same value clears the rating
        const current = (conversation.metadata as Record<string, unknown> | null) ?? {};
        const existingRating = current.userRating as string | undefined;
        const newRating = existingRating === rating ? null : rating;

        const updated = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                metadata: {
                    ...current,
                    ...(newRating !== null
                        ? { userRating: newRating, ratedAt: new Date().toISOString() }
                        : { userRating: null, ratedAt: null })
                }
            },
            select: { id: true, metadata: true }
        });

        const meta = updated.metadata as Record<string, unknown> | null;
        return NextResponse.json({
            conversationId,
            userRating: (meta?.userRating as string | null) ?? null,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Internal error';
        console.error('[chatbot-session-rating]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

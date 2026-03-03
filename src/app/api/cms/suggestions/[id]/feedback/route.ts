import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * POST /api/cms/suggestions/[id]/feedback
 * Set or toggle user feedback (thumbs up/down) on a CMS suggestion.
 *
 * Body: { feedback: 'UP' | 'DOWN' | null }
 * - Sending the same value as current → removes the vote (toggle-off)
 * - Sending null explicitly → removes the vote
 * - Sending the opposite value → switches the vote
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json().catch(() => null);
    const incoming = body?.feedback;

    if (incoming !== 'UP' && incoming !== 'DOWN' && incoming !== null) {
        return NextResponse.json(
            { error: 'feedback deve essere "UP", "DOWN" o null' },
            { status: 400 }
        );
    }

    const suggestion = await prisma.cMSSuggestion.findUnique({
        where: { id },
        select: { id: true, userFeedback: true }
    });

    if (!suggestion) {
        return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Toggle: clicking the same thumb again removes the vote
    const newFeedback = incoming === suggestion.userFeedback ? null : incoming;

    const updated = await prisma.cMSSuggestion.update({
        where: { id },
        data: { userFeedback: newFeedback },
        select: { id: true, userFeedback: true }
    });

    return NextResponse.json({ id: updated.id, userFeedback: updated.userFeedback });
}

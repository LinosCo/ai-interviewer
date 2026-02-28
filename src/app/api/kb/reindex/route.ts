/**
 * POST /api/kb/reindex
 *
 * Admin endpoint to backfill pgvector embeddings for KnowledgeSource entries
 * that were created before semantic search was enabled.
 *
 * Body (optional): { botId?: string }
 *
 * Returns: { total, indexed, failed }
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { reindexAllKnowledgeSources } from '@/lib/kb/semantic-search';

export async function POST(request: Request) {
    try {
        // Auth check — admin or cron
        const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
        const isSystemCron = cronSecret === process.env.CRON_SECRET;

        if (!isSystemCron) {
            const session = await auth();
            if (!session?.user?.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            // Only platform admins can trigger a global reindex
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { role: true },
            });
            if (user?.role !== 'ADMIN' && !request.url.includes('botId')) {
                return NextResponse.json({ error: 'Admin only for global reindex' }, { status: 403 });
            }
        }

        const body = await request.json().catch(() => ({}));
        const botId = (body as { botId?: string }).botId;

        const result = await reindexAllKnowledgeSources(botId);

        console.log('[kb/reindex]', result);

        return NextResponse.json({ success: true, ...result });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Reindex failed';
        console.error('[kb/reindex]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

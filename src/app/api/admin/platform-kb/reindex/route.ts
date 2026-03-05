/**
 * POST /api/admin/platform-kb/reindex
 *
 * Seeds or refreshes pgvector embeddings for all Platform KB entries.
 * Admin-only. Accepts optional { force: true } to reindex all entries even if
 * they already have embeddings (useful after content updates).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';
import { PLATFORM_KB } from '@/lib/copilot/platform-kb';
import { indexAllPlatformKBEntries } from '@/lib/copilot/platform-kb-vector';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only guard
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const result = await indexAllPlatformKBEntries(PLATFORM_KB, force);
    return NextResponse.json({ ok: true, ...result });
}

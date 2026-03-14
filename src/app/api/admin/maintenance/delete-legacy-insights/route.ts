import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/maintenance/delete-legacy-insights
 * Deletes CrossChannelInsight records with no projectId (legacy orphan data).
 * Admin only. One-shot maintenance endpoint.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const count = await prisma.crossChannelInsight.count({ where: { projectId: null } });
  const { count: deleted } = await prisma.crossChannelInsight.deleteMany({ where: { projectId: null } });

  return NextResponse.json({ found: count, deleted });
}

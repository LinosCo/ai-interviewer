import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/copilot/alerts?organizationId=xxx&unreadOnly=true
 * Returns alerts for an organization. Query params:
 *   - organizationId: required
 *   - unreadOnly: if "true", only unread alerts (default false)
 *   - limit: max results (default 20)
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const organizationId = url.searchParams.get('organizationId') || '';
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    select: { status: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN' && membership?.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const alerts = await prisma.copilotAlert.findMany({
    where: {
      organizationId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      alertType: true,
      severity: true,
      title: true,
      body: true,
      isRead: true,
      createdAt: true,
      metadata: true,
    },
  });

  const unreadCount = await prisma.copilotAlert.count({
    where: { organizationId, isRead: false },
  });

  return NextResponse.json({ alerts, unreadCount });
}

/**
 * POST /api/copilot/alerts
 * Mark alerts as read.
 * Body: { organizationId: string; alertIds?: string[] }
 * If alertIds omitted, marks ALL as read for the org.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : '';
  const alertIds: string[] | undefined = Array.isArray(body?.alertIds) ? body.alertIds : undefined;

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    select: { status: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN' && membership?.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  await prisma.copilotAlert.updateMany({
    where: {
      organizationId,
      ...(alertIds ? { id: { in: alertIds } } : {}),
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** GET /api/projects/[projectId]/tip-routing-rules */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { memberships: true },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (
      project.organizationId &&
      !user.memberships.some(m => m.organizationId === project.organizationId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId },
      include: {
        mcpConnection: { select: { id: true, name: true, type: true, status: true } },
        cmsConnection: { select: { id: true, name: true, status: true } },
        n8nConnection: { select: { id: true, name: true, status: true } },
      },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (err) {
    console.error('tip-routing-rules GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** POST /api/projects/[projectId]/tip-routing-rules */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId } = await params;
    const body = await req.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { memberships: true },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (
      project.organizationId &&
      !user.memberships.some(m => m.organizationId === project.organizationId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!body.contentKind || !body.behavior) {
      return NextResponse.json({ error: 'contentKind and behavior are required' }, { status: 400 });
    }

    const rule = await prisma.tipRoutingRule.create({
      data: {
        projectId,
        contentKind: String(body.contentKind),
        behavior: String(body.behavior),
        mcpTool: body.mcpTool ? String(body.mcpTool) : null,
        mcpConnectionId: body.mcpConnectionId || null,
        cmsConnectionId: body.cmsConnectionId || null,
        n8nConnectionId: body.n8nConnectionId || null,
        behaviorConfig: body.behaviorConfig || null,
        label: body.label ? String(body.label) : null,
        priority: typeof body.priority === 'number' ? body.priority : 0,
        enabled: body.enabled !== false,
      },
      include: {
        mcpConnection: { select: { id: true, name: true, type: true, status: true } },
        cmsConnection: { select: { id: true, name: true, status: true } },
        n8nConnection: { select: { id: true, name: true, status: true } },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error('tip-routing-rules POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

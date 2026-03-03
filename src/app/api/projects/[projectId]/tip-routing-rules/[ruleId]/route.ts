import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** PATCH /api/projects/[projectId]/tip-routing-rules/[ruleId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId, ruleId } = await params;
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
      !user.memberships.some((m) => m.organizationId === project.organizationId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rule = await prisma.tipRoutingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.projectId !== projectId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if ('enabled' in body) data.enabled = Boolean(body.enabled);
    if ('contentKind' in body) data.contentKind = String(body.contentKind);
    if ('behavior' in body) data.behavior = String(body.behavior);
    if ('mcpTool' in body) data.mcpTool = body.mcpTool ? String(body.mcpTool) : null;
    if ('label' in body) data.label = body.label ? String(body.label) : null;
    if ('priority' in body) data.priority = Number(body.priority);
    if ('behaviorConfig' in body) data.behaviorConfig = body.behaviorConfig ?? null;
    if ('mcpConnectionId' in body) {
      data.mcpConnectionId = body.mcpConnectionId ? String(body.mcpConnectionId) : null;
      if (body.mcpConnectionId) {
        data.cmsConnectionId = null;
        data.n8nConnectionId = null;
      }
    }
    if ('cmsConnectionId' in body) {
      data.cmsConnectionId = body.cmsConnectionId ? String(body.cmsConnectionId) : null;
      if (body.cmsConnectionId) {
        data.mcpConnectionId = null;
        data.n8nConnectionId = null;
      }
    }
    if ('n8nConnectionId' in body) {
      data.n8nConnectionId = body.n8nConnectionId ? String(body.n8nConnectionId) : null;
      if (body.n8nConnectionId) {
        data.mcpConnectionId = null;
        data.cmsConnectionId = null;
      }
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.tipRoutingRule.update({
      where: { id: ruleId },
      data,
      include: {
        mcpConnection: { select: { id: true, name: true, type: true, status: true } },
        cmsConnection: { select: { id: true, name: true, status: true } },
        n8nConnection: { select: { id: true, name: true, status: true } },
      },
    });
    return NextResponse.json({ rule: updated });
  } catch (err) {
    console.error('tip-routing-rule PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** DELETE /api/projects/[projectId]/tip-routing-rules/[ruleId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId, ruleId } = await params;

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
      !user.memberships.some((m) => m.organizationId === project.organizationId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rule = await prisma.tipRoutingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.projectId !== projectId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.tipRoutingRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('tip-routing-rule DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

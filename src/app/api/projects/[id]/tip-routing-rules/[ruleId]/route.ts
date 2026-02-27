import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** PATCH /api/projects/[id]/tip-routing-rules/[ruleId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: projectId, ruleId } = await params;
    const body = await req.json();

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

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.tipRoutingRule.update({ where: { id: ruleId }, data });
    return NextResponse.json({ rule: updated });
  } catch (err) {
    console.error('tip-routing-rule PATCH error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** DELETE /api/projects/[id]/tip-routing-rules/[ruleId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id: projectId, ruleId } = await params;

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

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { TipRoutingExecutor } from '@/lib/cms/tip-routing-executor';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, ruleId } = await params;
    const body = await req.json().catch(() => ({}));

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

    const testResult = await TipRoutingExecutor.testRule(projectId, ruleId, {
      id: `manual-${Date.now()}`,
      title: typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : `Test routing ${new Date().toLocaleString('it-IT')}`,
      content: typeof body.content === 'string' && body.content.trim()
        ? body.content.trim()
        : 'Verifica effettiva del matching BT routing verso hook/tool esterno.',
      contentKind: typeof body.contentKind === 'string' && body.contentKind.trim()
        ? body.contentKind.trim()
        : undefined,
      targetChannel: 'routing_test',
      metaDescription: 'Test routing manuale',
      url: undefined,
    });

    if (!testResult.success) {
      return NextResponse.json(
        {
          success: false,
          result: testResult,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, result: testResult });
  } catch (err) {
    console.error('tip-routing-rule test error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

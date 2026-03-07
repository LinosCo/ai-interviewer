import { ProjectTipStatus } from '@prisma/client';
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { assertProjectAccess, WorkspaceError } from '@/lib/domain/workspace';
import { ProjectTipService } from '@/lib/projects/project-tip.service';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  console.error('Project tips route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

const querySchema = z.object({
  status: z.nativeEnum(ProjectTipStatus).optional(),
  starred: z.enum(['true', 'false']).optional(),
});

const createSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().nullable().optional(),
    priority: z.number().nullable().optional(),
    category: z.string().nullable().optional(),
    contentKind: z.string().nullable().optional(),
    executionClass: z.string().nullable().optional(),
    reasoning: z.string().nullable().optional(),
    strategicAlignment: z.string().nullable().optional(),
    recommendedActions: z.unknown().optional(),
    suggestedRouting: z.unknown().optional(),
    sourceSnapshot: z.unknown().optional(),
  })
  .strict();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      status: url.searchParams.get('status') || undefined,
      starred: url.searchParams.get('starred') || undefined,
    });

    const tips = await ProjectTipService.listProjectTips({
      projectId,
      viewerUserId: session.user.id,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.starred !== undefined ? { starred: parsed.starred === 'true' } : {}),
    });

    return NextResponse.json({ tips });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const data = createSchema.parse(body);
    const access = await assertProjectAccess(session.user.id, projectId, 'MEMBER');

    const tip = await ProjectTipService.createManualTip({
      projectId,
      organizationId: access.organizationId,
      ...data,
      createdBy: session.user.id,
      actorUserId: session.user.id,
    });

    return NextResponse.json({ tip }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

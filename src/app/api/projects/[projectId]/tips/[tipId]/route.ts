import { ProjectTipStatus, TipApprovalMode, TipDraftStatus, TipPublishStatus, TipRoutingStatus } from '@prisma/client';
import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { WorkspaceError } from '@/lib/domain/workspace';
import { ProjectTipService } from '@/lib/projects/project-tip.service';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  console.error('Project tip detail route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

const updateSchema = z
  .object({
    title: z.string().min(1).optional(),
    summary: z.string().nullable().optional(),
    reasoning: z.string().nullable().optional(),
    strategicAlignment: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    contentKind: z.string().nullable().optional(),
    executionClass: z.string().nullable().optional(),
    approvalMode: z.nativeEnum(TipApprovalMode).optional(),
    draftStatus: z.nativeEnum(TipDraftStatus).optional(),
    routingStatus: z.nativeEnum(TipRoutingStatus).optional(),
    publishStatus: z.nativeEnum(TipPublishStatus).optional(),
    starred: z.boolean().optional(),
    status: z.nativeEnum(ProjectTipStatus).optional(),
    methodologySummary: z.string().nullable().optional(),
    recommendedActions: z.unknown().optional(),
    suggestedRouting: z.unknown().optional(),
  })
  .strict();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; tipId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, tipId } = await params;
    const tip = await ProjectTipService.getProjectTip({
      projectId,
      tipId,
      viewerUserId: session.user.id,
    });

    if (!tip) {
      return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
    }

    return NextResponse.json({ tip });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; tipId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, tipId } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    try {
      const tip = await ProjectTipService.updateTip({
        projectId,
        tipId,
        actorUserId: session.user.id,
        ...data,
        lastEditedBy: session.user.id,
      });

      return NextResponse.json({ tip });
    } catch (error) {
      if (error instanceof Error && error.message === 'Tip not found') {
        return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}

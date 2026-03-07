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
  console.error('Project tip duplicate route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; tipId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, tipId } = await params;

    try {
      const tip = await ProjectTipService.duplicateTip({
        projectId,
        tipId,
        actorUserId: session.user.id,
        createdBy: session.user.id,
      });

      return NextResponse.json({ tip }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === 'Tip not found for duplication') {
        return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}

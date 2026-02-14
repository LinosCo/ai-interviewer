import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

const updateSettingsSchema = z.object({
  strategicVision: z.string().optional(),
  valueProposition: z.string().optional()
});

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
  }
  console.error('Project settings route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

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
    await assertProjectAccess(session.user.id, projectId, 'VIEWER');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        strategicVision: true,
        valueProposition: true
      }
    });

    if (!project) {
      throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return NextResponse.json(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
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
    const data = updateSettingsSchema.parse(body);

    await assertProjectAccess(session.user.id, projectId, 'MEMBER');

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        strategicVision: data.strategicVision,
        valueProposition: data.valueProposition
      },
      select: {
        id: true,
        name: true,
        strategicVision: true,
        valueProposition: true
      }
    });

    return NextResponse.json(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}

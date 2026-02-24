import { z } from 'zod';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  WorkspaceError,
  assertProjectAccess,
  autoFixOrphanToolsForOrganization,
  ensureDefaultProjectForOrganization,
  getDefaultProjectNameForOrganization,
  syncLegacyProjectAccessForProject
} from '@/lib/domain/workspace';

const updateProjectSchema = z.object({
  name: z.string().min(1).optional()
});

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
  }
  console.error('Project route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

function hasMcpTypeConflict(sourceTypes: string[], targetTypes: string[]) {
  const source = new Set(sourceTypes);
  return targetTypes.some((type) => source.has(type));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bots: { select: { id: true, name: true, botType: true } },
        organization: { select: { id: true, name: true, slug: true, plan: true } },
        _count: {
          select: { bots: true }
        }
      }
    });

    if (!project) {
      throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    return NextResponse.json({
      ...project,
      currentUserRole: access.role
    });
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
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    await assertProjectAccess(session.user.id, projectId, 'ADMIN');

    const project = await prisma.project.update({
      where: { id: projectId },
      data
    });

    return NextResponse.json(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'ADMIN');
    const organizationId = access.organizationId;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        mcpConnections: { select: { type: true } },
        googleConnection: { select: { id: true } },
        n8nConnection: { select: { id: true } },
        newCmsConnection: { select: { id: true } }
      }
    });

    if (!project) {
      throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const candidates = await prisma.project.findMany({
      where: {
        organizationId,
        id: { not: projectId }
      },
      include: {
        mcpConnections: { select: { type: true } },
        googleConnection: { select: { id: true } },
        n8nConnection: { select: { id: true } },
        newCmsConnection: { select: { id: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    let transferTargetId = candidates.find((candidate) => {
      const sourceMcpTypes = project.mcpConnections.map((connection) => connection.type);
      const targetMcpTypes = candidate.mcpConnections.map((connection) => connection.type);

      if (project.googleConnection && candidate.googleConnection) return false;
      if (project.n8nConnection && candidate.n8nConnection) return false;
      if (project.newCmsConnection && candidate.newCmsConnection) return false;
      if (hasMcpTypeConflict(sourceMcpTypes, targetMcpTypes)) return false;

      return true;
    })?.id;

    if (!transferTargetId) {
      const defaultProject = await ensureDefaultProjectForOrganization(organizationId);
      transferTargetId = defaultProject.id;
      if (transferTargetId === projectId) {
        const recoveryBaseName = await getDefaultProjectNameForOrganization(organizationId);
        const recoveryProject = await prisma.project.create({
          data: {
            name: `${recoveryBaseName} (Recovery)`,
            organizationId,
            ownerId: session.user.id,
            isPersonal: false
          },
          include: {
            mcpConnections: { select: { type: true } },
            googleConnection: { select: { id: true } },
            n8nConnection: { select: { id: true } },
            newCmsConnection: { select: { id: true } }
          }
        });
        transferTargetId = recoveryProject.id;
      }
    }

    if (!transferTargetId) {
      throw new WorkspaceError('Unable to resolve transfer target project', 500, 'TRANSFER_TARGET_MISSING');
    }

    // Check if ProjectVisibilityConfig table exists (outside transaction)
    let projectVisibilityConfigExists = false;
    try {
      const tableCheck = await prisma.$queryRaw<[{ exists: boolean }]>(Prisma.sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'ProjectVisibilityConfig'
        )
      `);
      projectVisibilityConfigExists = tableCheck[0]?.exists || false;
    } catch (error) {
      console.warn('[DELETE_PROJECT_ROUTE] Could not check ProjectVisibilityConfig table existence:', error);
    }

    await prisma.$transaction(async (tx) => {
        await tx.bot.updateMany({
          where: { projectId },
          data: { projectId: transferTargetId }
        });

        await tx.visibilityConfig.updateMany({
          where: { projectId },
          data: {
            projectId: transferTargetId,
            organizationId
          }
        });

        await tx.mCPConnection.updateMany({
          where: { projectId },
          data: {
            projectId: transferTargetId,
            organizationId
          }
        });

        await tx.googleConnection.updateMany({
          where: { projectId },
          data: { projectId: transferTargetId }
        });

        await tx.n8NConnection.updateMany({
          where: { projectId },
          data: { projectId: transferTargetId }
        });

        await tx.cMSConnection.updateMany({
          where: { projectId },
          data: {
            projectId: transferTargetId,
            organizationId
          }
        });

      if (projectVisibilityConfigExists) {
        await tx.projectVisibilityConfig.deleteMany({ where: { projectId } });
      }
      await tx.projectCMSConnection.deleteMany({ where: { projectId } });
      await tx.projectMCPConnection.deleteMany({ where: { projectId } });
      await tx.projectAccess.deleteMany({ where: { projectId } });
      await tx.project.delete({ where: { id: projectId } });
    });

    await syncLegacyProjectAccessForProject(transferTargetId);
    await autoFixOrphanToolsForOrganization(organizationId);

    return NextResponse.json({
      success: true,
      message: 'Progetto eliminato e tool riassegnati al progetto di default dell\'organizzazione.',
      targetProjectId: transferTargetId
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

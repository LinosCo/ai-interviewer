import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  WorkspaceError,
  assertProjectAccess,
  autoFixOrphanToolsForOrganization,
  autoFixToolOrganizationForProject,
  ensureDefaultProjectForOrganization
} from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Project tools API error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

function mapBot(bot: {
  id: string;
  name: string;
  botType: string | null;
  projectId: string;
  project?: { name: string | null; organization?: { name: string | null } | null } | null;
}) {
  return {
    id: bot.id,
    name: bot.name,
    type: 'bot' as const,
    botType: bot.botType,
    projectId: bot.projectId,
    projectName: bot.project?.name || null,
    orgName: bot.project?.organization?.name || null
  };
}

function mapTracker(config: {
  id: string;
  brandName: string;
  projectId: string | null;
  project?: { name: string | null; organization?: { name: string | null } | null } | null;
  projectShares?: Array<{ projectId: string }>;
}) {
  return {
    id: config.id,
    name: config.brandName,
    type: 'tracker' as const,
    botType: 'tracker',
    projectId: config.projectId || config.projectShares?.[0]?.projectId || null,
    projectName: config.project?.name || null,
    orgName: config.project?.organization?.name || null
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const { searchParams } = new URL(req.url);
    const botType = searchParams.get('type');
    const includeAll = searchParams.get('includeAll') === 'true';

    const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');
    await autoFixOrphanToolsForOrganization(access.organizationId);
    await autoFixToolOrganizationForProject(projectId);

    if (includeAll) {
      const orgProjects = await prisma.project.findMany({
        where: { organizationId: access.organizationId },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      });
      const orgProjectIds = orgProjects.map((project) => project.id);

      const linkedBots = await prisma.bot.findMany({
        where: { projectId },
        include: {
          project: {
            select: {
              name: true,
              organization: { select: { name: true } }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      let linkedTrackers: Array<{
        id: string;
        brandName: string;
        projectId: string | null;
        project: { name: string | null; organization: { name: string | null } | null } | null;
        projectShares: Array<{ projectId: string }>;
      }> = [];
      try {
        linkedTrackers = await prisma.visibilityConfig.findMany({
          where: {
            organizationId: access.organizationId,
            OR: [
              { projectId },
              { projectShares: { some: { projectId } } }
            ]
          },
          include: {
            project: {
              select: {
                name: true,
                organization: { select: { name: true } }
              }
            },
            projectShares: { select: { projectId: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });
      } catch (error: any) {
        if (error?.code !== 'P2021') throw error;
        linkedTrackers = await prisma.visibilityConfig.findMany({
          where: {
            organizationId: access.organizationId,
            projectId
          },
          include: {
            project: {
              select: {
                name: true,
                organization: { select: { name: true } }
              }
            }
          },
          orderBy: { updatedAt: 'desc' }
        }) as any;
      }

      const availableBots = await prisma.bot.findMany({
        where: {
          projectId: {
            in: orgProjectIds,
            not: projectId
          }
        },
        include: {
          project: {
            select: {
              name: true,
              organization: { select: { name: true } }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      let availableTrackers: Array<{
        id: string;
        brandName: string;
        projectId: string | null;
        project: { name: string | null; organization: { name: string | null } | null } | null;
        projectShares: Array<{ projectId: string }>;
      }> = [];
      try {
        availableTrackers = await prisma.visibilityConfig.findMany({
          where: {
            organizationId: access.organizationId,
            OR: [
              { projectId: { in: orgProjectIds, not: projectId } },
              { projectShares: { some: { projectId: { in: orgProjectIds, not: projectId } } } }
            ],
            NOT: {
              OR: [
                { projectId },
                { projectShares: { some: { projectId } } }
              ]
            }
          },
          include: {
            project: {
              select: {
                name: true,
                organization: { select: { name: true } }
              }
            },
            projectShares: { select: { projectId: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });
      } catch (error: any) {
        if (error?.code !== 'P2021') throw error;
        availableTrackers = await prisma.visibilityConfig.findMany({
          where: {
            organizationId: access.organizationId,
            projectId: { in: orgProjectIds, not: projectId }
          },
          include: {
            project: {
              select: {
                name: true,
                organization: { select: { name: true } }
              }
            }
          },
          orderBy: { updatedAt: 'desc' }
        }) as any;
      }

      const defaultProject = await ensureDefaultProjectForOrganization(access.organizationId);

      return NextResponse.json({
        defaultProjectId: defaultProject.id,
        linkedTools: [
          ...linkedBots.map(mapBot),
          ...linkedTrackers.map(mapTracker)
        ],
        availableTools: [
          ...availableBots.map(mapBot),
          ...availableTrackers.map(mapTracker)
        ]
      });
    }

    const bots = await prisma.bot.findMany({
      where: {
        projectId,
        ...(botType ? { botType } : {})
      },
      include: {
        conversations: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            candidateProfile: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(bots);
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
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const body = await req.json();
    const botId = String(body.botId || '').trim();
    const targetProjectId = String(body.targetProjectId || '').trim();

    if (!botId || !targetProjectId) {
      throw new WorkspaceError('botId e targetProjectId sono richiesti', 400, 'INVALID_PAYLOAD');
    }

    const sourceAccess = await assertProjectAccess(session.user.id, projectId, 'ADMIN');
    const targetAccess = await assertProjectAccess(session.user.id, targetProjectId, 'ADMIN');

    if (sourceAccess.organizationId !== targetAccess.organizationId) {
      throw new WorkspaceError(
        'Cross-organization tool transfer is not allowed',
        422,
        'CROSS_ORG_TRANSFER_DENIED'
      );
    }

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { id: true, projectId: true }
    });

    if (bot) {
      await assertProjectAccess(session.user.id, bot.projectId, 'ADMIN');
      await prisma.bot.update({
        where: { id: botId },
        data: { projectId: targetProjectId }
      });
      await autoFixToolOrganizationForProject(targetProjectId);
      return NextResponse.json({ success: true, type: 'bot' });
    }

    const tracker = await prisma.visibilityConfig.findUnique({
      where: { id: botId },
      select: { id: true, projectId: true, organizationId: true }
    });

    if (!tracker) {
      throw new WorkspaceError('Tool non trovato', 404, 'TOOL_NOT_FOUND');
    }

    if (tracker.organizationId !== sourceAccess.organizationId) {
      throw new WorkspaceError('Tool belongs to another organization', 422, 'TOOL_ORG_MISMATCH');
    }

    if (tracker.projectId) {
      await assertProjectAccess(session.user.id, tracker.projectId, 'ADMIN');
    }

    await prisma.visibilityConfig.update({
      where: { id: tracker.id },
      data: {
        projectId: targetProjectId,
        organizationId: targetAccess.organizationId
      }
    });

    try {
      await prisma.projectVisibilityConfig.upsert({
        where: {
          projectId_configId: {
            projectId: targetProjectId,
            configId: tracker.id
          }
        },
        update: {},
        create: {
          projectId: targetProjectId,
          configId: tracker.id,
          createdBy: session.user.id
        }
      });
    } catch (error: any) {
      if (error?.code !== 'P2021') throw error;
    }

    await autoFixToolOrganizationForProject(targetProjectId);
    return NextResponse.json({ success: true, type: 'tracker' });
  } catch (error) {
    return toErrorResponse(error);
  }
}

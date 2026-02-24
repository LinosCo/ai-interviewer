import { Role, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getOrCreateDefaultOrganization } from '@/lib/organizations';

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

export class WorkspaceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'WORKSPACE_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hasRequiredRole(role: Role | null | undefined, minimumRole: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

function normalizeDefaultProjectName(rawName: string | null | undefined): string {
  const normalized = String(rawName || '').trim().replace(/\s+/g, ' ');
  return normalized || 'Workspace';
}

export async function getDefaultProjectNameForOrganization(organizationId: string): Promise<string> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true }
  });

  return normalizeDefaultProjectName(organization?.name);
}

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  return user?.role === 'ADMIN';
}

export async function assertOrganizationAccess(
  userId: string,
  organizationId: string,
  minimumRole: Role = 'VIEWER'
) {
  const platformAdmin = await isPlatformAdmin(userId);
  if (platformAdmin) {
    return { role: 'OWNER' as Role, isPlatformAdmin: true };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    },
    select: { role: true, status: true }
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new WorkspaceError('Access denied', 403, 'ORG_ACCESS_DENIED');
  }

  if (!hasRequiredRole(membership.role, minimumRole)) {
    throw new WorkspaceError('Insufficient organization permissions', 403, 'ORG_ROLE_TOO_LOW');
  }

  return { role: membership.role, isPlatformAdmin: false };
}

export async function ensureProjectOrganization(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      ownerId: true
    }
  });

  if (!project) {
    throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
  }

  if (project.organizationId) {
    return project.organizationId;
  }

  if (!project.ownerId) {
    throw new WorkspaceError(
      'Project has no organization and no owner. Manual fix required.',
      422,
      'PROJECT_ORG_UNRESOLVABLE'
    );
  }

  const ownerMembership = await prisma.membership.findFirst({
    where: {
      userId: project.ownerId,
      status: 'ACTIVE'
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: { organizationId: true }
  });

  const organizationId = ownerMembership?.organizationId
    || (await getOrCreateDefaultOrganization(project.ownerId)).id;

  await prisma.project.update({
    where: { id: projectId },
    data: { organizationId }
  });

  await syncLegacyProjectAccessForProject(projectId);

  return organizationId;
}

export async function assertProjectAccess(
  userId: string,
  projectId: string,
  minimumRole: Role = 'VIEWER'
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      ownerId: true
    }
  });

  if (!project) {
    throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
  }

  const organizationId = project.organizationId || await ensureProjectOrganization(project.id);
  const access = await assertOrganizationAccess(userId, organizationId, minimumRole);
  const canAccessAllProjects = access.isPlatformAdmin || hasRequiredRole(access.role, 'ADMIN');

  if (!canAccessAllProjects && project.ownerId !== userId) {
    const explicitProjectAccess = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id
        }
      },
      select: { id: true }
    });

    if (!explicitProjectAccess) {
      throw new WorkspaceError('Project access denied', 403, 'PROJECT_ACCESS_DENIED');
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    organizationId,
    role: access.role,
    isPlatformAdmin: access.isPlatformAdmin
  };
}

export async function ensureDefaultProjectForOrganization(organizationId: string) {
  const existing = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, ownerId: true }
  });

  if (existing) {
    return existing;
  }

  const primaryMember = await prisma.membership.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE'
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: { userId: true, role: true }
  });

  const ownerId = primaryMember?.userId || null;
  const defaultProjectName = await getDefaultProjectNameForOrganization(organizationId);

  return prisma.project.create({
    data: {
      name: defaultProjectName,
      organizationId,
      ownerId,
      isPersonal: false,
      ...(ownerId
        ? {
            accessList: {
              create: {
                userId: ownerId,
                role: 'OWNER'
              }
            }
          }
        : {})
    },
    select: { id: true, name: true, ownerId: true }
  });
}

export async function syncLegacyProjectAccessForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true, ownerId: true }
  });

  if (!project?.organizationId) return;

  const members = await prisma.membership.findMany({
    where: {
      organizationId: project.organizationId,
      status: 'ACTIVE'
    },
    select: {
      userId: true,
      role: true,
      createdAt: true
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }]
  });

  const memberIds = members.map((member) => member.userId);
  const adminMemberIds = members
    .filter((member) => member.role === 'OWNER' || member.role === 'ADMIN')
    .map((member) => member.userId);
  const adminMemberIdSet = new Set(adminMemberIds);
  const derivedOwnerId = adminMemberIds[0] || null;
  const resolvedOwnerId = project.ownerId && memberIds.includes(project.ownerId)
    ? project.ownerId
    : derivedOwnerId;

  await prisma.$transaction(async (tx) => {
    if (memberIds.length === 0) {
      await tx.projectAccess.deleteMany({ where: { projectId } });
    } else {
      await tx.projectAccess.deleteMany({
        where: {
          projectId,
          userId: { notIn: memberIds }
        }
      });
    }

    for (const adminMemberId of adminMemberIds) {
      await tx.projectAccess.upsert({
        where: {
          userId_projectId: {
            userId: adminMemberId,
            projectId
          }
        },
        update: { role: 'OWNER' },
        create: {
          userId: adminMemberId,
          projectId,
          role: 'OWNER'
        }
      });
    }

    if (resolvedOwnerId) {
      await tx.projectAccess.upsert({
        where: {
          userId_projectId: {
            userId: resolvedOwnerId,
            projectId
          }
        },
        update: { role: 'OWNER' },
        create: {
          userId: resolvedOwnerId,
          projectId,
          role: 'OWNER'
        }
      });
    }

    const constrainedMemberIds = memberIds.filter(
      (memberId) => !adminMemberIdSet.has(memberId) && memberId !== resolvedOwnerId
    );
    if (constrainedMemberIds.length > 0) {
      await tx.projectAccess.updateMany({
        where: {
          projectId,
          userId: { in: constrainedMemberIds },
          role: 'OWNER'
        },
        data: { role: 'MEMBER' }
      });
    }

    await tx.project.update({
      where: { id: projectId },
      data: { ownerId: resolvedOwnerId }
    });
  });
}

export async function syncLegacyProjectAccessForOrganization(organizationId: string) {
  const projects = await prisma.project.findMany({
    where: { organizationId },
    select: { id: true }
  });

  for (const project of projects) {
    await syncLegacyProjectAccessForProject(project.id);
  }
}

export async function autoFixToolOrganizationForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true }
  });

  if (!project) {
    throw new WorkspaceError('Project not found', 404, 'PROJECT_NOT_FOUND');
  }

  const organizationId = project.organizationId || await ensureProjectOrganization(projectId);

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
    console.warn('[autoFixToolOrganizationForProject] Could not check ProjectVisibilityConfig table existence:', error);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mCPConnection.updateMany({
      where: {
        projectId,
        organizationId: { not: organizationId }
      },
      data: { organizationId }
    });

    await tx.cMSConnection.updateMany({
      where: {
        projectId,
        organizationId: { not: organizationId }
      },
      data: { organizationId }
    });

    await tx.visibilityConfig.updateMany({
      where: {
        projectId,
        organizationId: { not: organizationId }
      },
      data: { organizationId }
    });

    await tx.crossChannelInsight.updateMany({
      where: {
        projectId,
        organizationId: { not: organizationId }
      },
      data: { organizationId }
    });

    if (projectVisibilityConfigExists) {
      await tx.projectVisibilityConfig.deleteMany({
        where: {
          projectId,
          config: {
            organizationId: { not: organizationId }
          }
        }
      });
    }

    await tx.projectCMSConnection.deleteMany({
      where: {
        projectId,
        connection: {
          organizationId: { not: organizationId }
        }
      }
    });

    await tx.projectMCPConnection.deleteMany({
      where: {
        projectId,
        connection: {
          organizationId: { not: organizationId }
        }
      }
    });
  });
}

export async function autoFixOrphanToolsForOrganization(organizationId: string) {
  const defaultProject = await ensureDefaultProjectForOrganization(organizationId);

  const visibilityResult = await prisma.visibilityConfig.updateMany({
    where: {
      organizationId,
      projectId: null
    },
    data: { projectId: defaultProject.id }
  });

  const orphanCmsConnections = await prisma.cMSConnection.findMany({
    where: {
      organizationId,
      projectId: null
    },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' }
  });

  let cmsFixed = 0;
  const usedProjectIds = new Set<string>([defaultProject.id]);

  for (const connection of orphanCmsConnections) {
    let candidate = await prisma.project.findFirst({
      where: {
        organizationId,
        id: { notIn: Array.from(usedProjectIds) },
        newCmsConnection: null
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!candidate) {
      const created = await prisma.project.create({
        data: {
          name: `Default Project (${connection.name || 'CMS'})`,
          organizationId,
          isPersonal: false
        },
        select: { id: true }
      });
      candidate = created;
    }

    usedProjectIds.add(candidate.id);

    await prisma.cMSConnection.update({
      where: { id: connection.id },
      data: { projectId: candidate.id }
    });

    cmsFixed += 1;
  }

  await syncLegacyProjectAccessForOrganization(organizationId);

  return {
    defaultProjectId: defaultProject.id,
    visibilityFixed: visibilityResult.count,
    cmsFixed
  };
}

export async function moveProjectToOrganization(params: {
  projectId: string;
  targetOrganizationId: string;
  actorUserId: string;
}) {
  const { projectId, targetOrganizationId, actorUserId } = params;

  const sourceOrganizationId = await ensureProjectOrganization(projectId);
  if (sourceOrganizationId === targetOrganizationId) {
    return {
      moved: false,
      sourceOrganizationId,
      targetOrganizationId
    };
  }

  await autoFixToolOrganizationForProject(projectId);

  const targetAdmins = await prisma.membership.findMany({
    where: {
      organizationId: targetOrganizationId,
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN'] }
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: { userId: true }
  });

  const fallbackOwnerId = targetAdmins.find((m) => m.userId === actorUserId)?.userId
    || targetAdmins[0]?.userId
    || null;

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
    console.warn('[moveProjectToOrganization] Could not check ProjectVisibilityConfig table existence:', error);
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        organizationId: targetOrganizationId,
        ownerId: fallbackOwnerId,
        transferredAt: new Date(),
        transferredFromOrgId: sourceOrganizationId
      }
    });

    await tx.mCPConnection.updateMany({
      where: { projectId },
      data: { organizationId: targetOrganizationId }
    });

    await tx.cMSConnection.updateMany({
      where: { projectId },
      data: { organizationId: targetOrganizationId }
    });

    await tx.visibilityConfig.updateMany({
      where: { projectId },
      data: { organizationId: targetOrganizationId }
    });

    await tx.crossChannelInsight.updateMany({
      where: { projectId },
      data: { organizationId: targetOrganizationId }
    });

    if (projectVisibilityConfigExists) {
      await tx.projectVisibilityConfig.deleteMany({ where: { projectId } });
    }
    await tx.projectCMSConnection.deleteMany({ where: { projectId } });
    await tx.projectMCPConnection.deleteMany({ where: { projectId } });
  });

  await autoFixOrphanToolsForOrganization(sourceOrganizationId);
  await autoFixOrphanToolsForOrganization(targetOrganizationId);
  await syncLegacyProjectAccessForProject(projectId);

  return {
    moved: true,
    sourceOrganizationId,
    targetOrganizationId
  };
}

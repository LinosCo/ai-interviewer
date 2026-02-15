import crypto from 'crypto';

import { PrismaClient, Role } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

function normalizePgConnectionString(rawConnectionString: string): string {
  try {
    const url = new URL(rawConnectionString);
    const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
    const hasLibpqCompat = url.searchParams.has('uselibpqcompat');

    if (!hasLibpqCompat && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('uselibpqcompat', 'true');
    }

    return url.toString();
  } catch {
    return rawConnectionString;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  const pool = new Pool({
    connectionString: normalizePgConnectionString(connectionString)
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

type Stats = {
  projectsLinkedToOrganization: number;
  recoveryOrganizationsCreated: number;
  recoveryMembershipsCreated: number;
  defaultProjectsCreated: number;
  recoveryProjectsCreated: number;
  projectOwnersAligned: number;
  projectAccessCreated: number;
  projectAccessUpdated: number;
  projectAccessDeleted: number;
  visibilityAssignedToProject: number;
  visibilityOrganizationFixed: number;
  crossInsightsAssignedToProject: number;
  crossInsightsOrganizationFixed: number;
  mcpOrganizationFixed: number;
  cmsAssignedToProject: number;
  cmsOrganizationFixed: number;
  shareLinksDeleted: number;
  projectTransferInvitesDeleted: number;
  unrecoverableDeleted: number;
};

const stats: Stats = {
  projectsLinkedToOrganization: 0,
  recoveryOrganizationsCreated: 0,
  recoveryMembershipsCreated: 0,
  defaultProjectsCreated: 0,
  recoveryProjectsCreated: 0,
  projectOwnersAligned: 0,
  projectAccessCreated: 0,
  projectAccessUpdated: 0,
  projectAccessDeleted: 0,
  visibilityAssignedToProject: 0,
  visibilityOrganizationFixed: 0,
  crossInsightsAssignedToProject: 0,
  crossInsightsOrganizationFixed: 0,
  mcpOrganizationFixed: 0,
  cmsAssignedToProject: 0,
  cmsOrganizationFixed: 0,
  shareLinksDeleted: 0,
  projectTransferInvitesDeleted: 0,
  unrecoverableDeleted: 0
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const keepUnrecoverable = args.has('--keep-unrecoverable');

const orgArgIndex = process.argv.indexOf('--org');
const onlyOrganizationId =
  orgArgIndex >= 0
    ? process.argv[orgArgIndex + 1]
    : undefined;

if (orgArgIndex >= 0 && !onlyOrganizationId) {
  throw new Error('Missing value after --org');
}

const defaultProjectCache = new Map<string, string>();
const recoveryOrganizationByOwner = new Map<string, string>();
let sharedRecoveryOrganizationId: string | null = null;

function shortId(value: string): string {
  return value.slice(-6);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isHigherOrEqualRole(role: Role, minimumRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

function toLegacyProjectRole(role: Role): 'OWNER' | 'MEMBER' {
  return role === 'OWNER' || role === 'ADMIN' ? 'OWNER' : 'MEMBER';
}

function pickPrimaryMember<T extends { role: Role; createdAt: Date }>(
  members: T[],
  minimumRole: Role = 'MEMBER'
): T | null {
  const eligible = members.filter((member) => isHigherOrEqualRole(member.role, minimumRole));
  if (!eligible.length) return null;
  const sorted = [...eligible].sort((a, b) => {
    const rankDiff = ROLE_RANK[b.role] - ROLE_RANK[a.role];
    if (rankDiff !== 0) return rankDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0] ?? null;
}

async function mutate<T>(description: string, action: () => Promise<T>, dryValue?: unknown): Promise<T> {
  if (dryRun) {
    console.log(`[dry-run] ${description}`);
    return dryValue as T;
  }
  return action();
}

async function getOrCreateSharedRecoveryOrganization(): Promise<string> {
  if (sharedRecoveryOrganizationId) return sharedRecoveryOrganizationId;

  const existing = await prisma.organization.findFirst({
    where: { slug: { startsWith: 'recovered-workspace' } },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  });

  if (existing) {
    sharedRecoveryOrganizationId = existing.id;
    return existing.id;
  }

  const created = await mutate(
    'Create shared recovery organization',
    async () => prisma.organization.create({
      data: {
        name: 'Recovered Workspace',
        slug: `recovered-workspace-${crypto.randomBytes(3).toString('hex')}`,
        maxMembers: 1,
        currentMemberCount: 0
      },
      select: { id: true }
    }),
    { id: `dry-recovered-org-${Date.now()}` }
  );

  stats.recoveryOrganizationsCreated += 1;
  sharedRecoveryOrganizationId = created.id;
  return created.id;
}

async function getOrCreateRecoveryOrganizationForOwner(ownerId: string): Promise<string> {
  const cached = recoveryOrganizationByOwner.get(ownerId);
  if (cached) return cached;

  const activeMembership = await prisma.membership.findFirst({
    where: {
      userId: ownerId,
      status: 'ACTIVE'
    },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' }
  });

  if (activeMembership?.organizationId) {
    recoveryOrganizationByOwner.set(ownerId, activeMembership.organizationId);
    return activeMembership.organizationId;
  }

  const slug = `recovered-owner-${shortId(ownerId)}-${crypto.randomBytes(2).toString('hex')}`;
  const name = `Recovered Org (${shortId(ownerId)})`;

  const org = await mutate(
    `Create owner recovery organization for user ${ownerId}`,
    async () => prisma.organization.create({
      data: {
        name,
        slug: slugify(slug),
        maxMembers: 1,
        currentMemberCount: 1
      },
      select: { id: true }
    }),
    { id: `dry-owner-org-${shortId(ownerId)}` }
  );

  stats.recoveryOrganizationsCreated += 1;

  await mutate(
    `Create owner membership for user ${ownerId} in org ${org.id}`,
    async () => prisma.membership.create({
      data: {
        userId: ownerId,
        organizationId: org.id,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date()
      }
    }),
    {
      id: `dry-membership-${shortId(ownerId)}`,
      userId: ownerId,
      organizationId: org.id,
      role: 'OWNER',
      status: 'ACTIVE',
      acceptedAt: new Date(),
      createdAt: new Date(),
      invitedAt: null,
      invitedBy: null,
      joinedAt: new Date(),
      receiveAlerts: true,
      updatedAt: new Date()
    }
  );

  stats.recoveryMembershipsCreated += 1;
  recoveryOrganizationByOwner.set(ownerId, org.id);
  return org.id;
}

async function ensureProjectOrganization(project: {
  id: string;
  ownerId: string | null;
  organizationId: string | null;
}): Promise<string> {
  if (project.organizationId) return project.organizationId;

  let organizationId: string;
  if (project.ownerId) {
    organizationId = await getOrCreateRecoveryOrganizationForOwner(project.ownerId);
  } else {
    organizationId = await getOrCreateSharedRecoveryOrganization();
  }

  await mutate(
    `Assign organization ${organizationId} to project ${project.id}`,
    async () => prisma.project.update({
      where: { id: project.id },
      data: { organizationId }
    }),
    {
      id: project.id,
      name: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isPersonal: false,
      strategicVision: null,
      valueProposition: null,
      ownerId: project.ownerId,
      organizationId
    }
  );

  stats.projectsLinkedToOrganization += 1;
  return organizationId;
}

async function getDefaultProjectId(organizationId: string): Promise<string> {
  const cached = defaultProjectCache.get(organizationId);
  if (cached) return cached;

  const existing = await prisma.project.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });
  if (existing?.id) {
    defaultProjectCache.set(organizationId, existing.id);
    return existing.id;
  }

  const activeMembers = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE'
    },
    select: {
      userId: true,
      role: true,
      createdAt: true
    }
  });

  const primary = pickPrimaryMember(activeMembers, 'ADMIN') ?? pickPrimaryMember(activeMembers, 'MEMBER');
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true }
  });
  const defaultProjectName = String(organization?.name || '').trim() || 'Workspace';

  const created = await mutate(
    `Create default project for organization ${organizationId}`,
    async () => prisma.project.create({
      data: {
        name: defaultProjectName,
        organizationId,
        ownerId: primary?.userId ?? null,
        isPersonal: false
      },
      select: { id: true }
    }),
    { id: `dry-default-project-${shortId(organizationId)}` }
  );

  stats.defaultProjectsCreated += 1;
  defaultProjectCache.set(organizationId, created.id);
  return created.id;
}

async function getProjectWithoutCmsConnectionOrCreate(organizationId: string, connectionName: string): Promise<string> {
  const available = await prisma.project.findFirst({
    where: {
      organizationId,
      newCmsConnection: null
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  if (available?.id) {
    return available.id;
  }

  const activeMembers = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE'
    },
    select: {
      userId: true,
      role: true,
      createdAt: true
    }
  });

  const primary = pickPrimaryMember(activeMembers, 'ADMIN') ?? pickPrimaryMember(activeMembers, 'MEMBER');
  const safeName = (connectionName || 'CMS').slice(0, 32);

  const created = await mutate(
    `Create recovery project for CMS connection in org ${organizationId}`,
    async () => prisma.project.create({
      data: {
        name: `Recovered CMS (${safeName})`,
        organizationId,
        ownerId: primary?.userId ?? null,
        isPersonal: false
      },
      select: { id: true }
    }),
    { id: `dry-recovery-project-${shortId(organizationId)}-${crypto.randomBytes(2).toString('hex')}` }
  );

  stats.recoveryProjectsCreated += 1;
  return created.id;
}

async function normalizeProjectsAndLegacyAccess(organizationIds: string[]) {
  const projects = await prisma.project.findMany({
    where: onlyOrganizationId
      ? { organizationId: onlyOrganizationId }
      : undefined,
    select: {
      id: true,
      ownerId: true,
      organizationId: true
    },
    orderBy: { createdAt: 'asc' }
  });

  for (const project of projects) {
    const organizationId = await ensureProjectOrganization(project);
    organizationIds.push(organizationId);

    const activeMembers = await prisma.membership.findMany({
      where: {
        organizationId,
        status: 'ACTIVE'
      },
      select: {
        userId: true,
        role: true,
        createdAt: true
      }
    });

    const preferredOwner =
      (project.ownerId
        ? activeMembers.find((member) => member.userId === project.ownerId && isHigherOrEqualRole(member.role, 'ADMIN'))
        : null)
      ?? pickPrimaryMember(activeMembers, 'ADMIN')
      ?? null;
    const desiredOwnerId = preferredOwner?.userId ?? null;

    if (project.ownerId !== desiredOwnerId) {
      await mutate(
        `Align owner for project ${project.id}`,
        async () => prisma.project.update({
          where: { id: project.id },
          data: { ownerId: desiredOwnerId }
        }),
        {
          id: project.id,
          name: '',
          ownerId: desiredOwnerId,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPersonal: false,
          strategicVision: null,
          valueProposition: null
        }
      );
      stats.projectOwnersAligned += 1;
    }

    const expectedRoles = new Map(
      activeMembers.map((member) => [member.userId, toLegacyProjectRole(member.role)])
    );
    const existingAccess = await prisma.projectAccess.findMany({
      where: { projectId: project.id },
      select: { userId: true, role: true }
    });

    const staleUserIds = existingAccess
      .filter((entry) => !expectedRoles.has(entry.userId))
      .map((entry) => entry.userId);

    if (staleUserIds.length > 0) {
      await mutate(
        `Delete stale project access rows for project ${project.id}`,
        async () => prisma.projectAccess.deleteMany({
          where: {
            projectId: project.id,
            userId: { in: staleUserIds }
          }
        }),
        { count: staleUserIds.length }
      );
      stats.projectAccessDeleted += staleUserIds.length;
    }

    const existingByUserId = new Map(existingAccess.map((entry) => [entry.userId, entry.role]));
    for (const [userId, role] of expectedRoles.entries()) {
      const existingRole = existingByUserId.get(userId);
      if (!existingRole) {
        await mutate(
          `Create project access for user ${userId} on project ${project.id}`,
          async () => prisma.projectAccess.create({
            data: {
              projectId: project.id,
              userId,
              role
            }
          }),
          {
            id: `dry-access-${shortId(userId)}`,
            userId,
            projectId: project.id,
            role,
            createdAt: new Date()
          }
        );
        stats.projectAccessCreated += 1;
        continue;
      }

      if (existingRole !== role) {
        await mutate(
          `Update project access role for user ${userId} on project ${project.id}`,
          async () => prisma.projectAccess.update({
            where: {
              userId_projectId: {
                userId,
                projectId: project.id
              }
            },
            data: { role }
          }),
          {
            id: `dry-access-${shortId(userId)}`,
            userId,
            projectId: project.id,
            role,
            createdAt: new Date()
          }
        );
        stats.projectAccessUpdated += 1;
      }
    }
  }
}

async function repairVisibilityConfigs() {
  const rows = await prisma.visibilityConfig.findMany({
    where: onlyOrganizationId
      ? { organizationId: onlyOrganizationId }
      : undefined,
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          organizationId: true
        }
      }
    }
  });

  for (const row of rows) {
    if (!row.projectId) {
      const defaultProjectId = await getDefaultProjectId(row.organizationId);
      await mutate(
        `Assign visibility config ${row.id} to default project ${defaultProjectId}`,
        async () => prisma.visibilityConfig.update({
          where: { id: row.id },
          data: { projectId: defaultProjectId }
        }),
        {
          id: row.id,
          organizationId: row.organizationId,
          projectId: defaultProjectId,
          brandName: '',
          category: '',
          language: 'it',
          territory: 'IT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
          nextScanAt: null,
          websiteUrl: null,
          additionalUrls: null
        }
      );
      stats.visibilityAssignedToProject += 1;
      continue;
    }

    const projectOrgId = row.project?.organizationId;
    if (projectOrgId && row.organizationId !== projectOrgId) {
      await mutate(
        `Fix visibility config ${row.id} organization to ${projectOrgId}`,
        async () => prisma.visibilityConfig.update({
          where: { id: row.id },
          data: { organizationId: projectOrgId }
        }),
        {
          id: row.id,
          organizationId: projectOrgId,
          projectId: row.projectId,
          brandName: '',
          category: '',
          language: 'it',
          territory: 'IT',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
          nextScanAt: null,
          websiteUrl: null,
          additionalUrls: null
        }
      );
      stats.visibilityOrganizationFixed += 1;
    }
  }
}

async function repairCrossChannelInsights() {
  const rows = await prisma.crossChannelInsight.findMany({
    where: onlyOrganizationId
      ? { organizationId: onlyOrganizationId }
      : undefined,
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          organizationId: true
        }
      }
    }
  });

  for (const row of rows) {
    if (!row.projectId) {
      const defaultProjectId = await getDefaultProjectId(row.organizationId);
      await mutate(
        `Assign cross insight ${row.id} to default project ${defaultProjectId}`,
        async () => prisma.crossChannelInsight.update({
          where: { id: row.id },
          data: { projectId: defaultProjectId }
        }),
        {
          id: row.id,
          organizationId: row.organizationId,
          projectId: defaultProjectId,
          topicName: '',
          crossChannelScore: 0,
          priorityScore: 0,
          suggestedActions: null,
          status: 'new',
          reviewedBy: null,
          reviewedAt: null,
          interviewData: null,
          chatbotData: null,
          visibilityData: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
      stats.crossInsightsAssignedToProject += 1;
      continue;
    }

    const projectOrgId = row.project?.organizationId;
    if (projectOrgId && projectOrgId !== row.organizationId) {
      await mutate(
        `Fix cross insight ${row.id} organization to ${projectOrgId}`,
        async () => prisma.crossChannelInsight.update({
          where: { id: row.id },
          data: { organizationId: projectOrgId }
        }),
        {
          id: row.id,
          organizationId: projectOrgId,
          projectId: row.projectId,
          topicName: '',
          crossChannelScore: 0,
          priorityScore: 0,
          suggestedActions: null,
          status: 'new',
          reviewedBy: null,
          reviewedAt: null,
          interviewData: null,
          chatbotData: null,
          visibilityData: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      );
      stats.crossInsightsOrganizationFixed += 1;
    }
  }
}

async function repairMcpConnections() {
  const rows = await prisma.mCPConnection.findMany({
    where: onlyOrganizationId
      ? {
          OR: [
            { organizationId: onlyOrganizationId },
            { project: { organizationId: onlyOrganizationId } }
          ]
        }
      : undefined,
    select: {
      id: true,
      organizationId: true,
      project: {
        select: {
          organizationId: true
        }
      }
    }
  });

  for (const row of rows) {
    const projectOrgId = row.project.organizationId;
    if (!projectOrgId) continue;
    if (row.organizationId === projectOrgId) continue;

    await mutate(
      `Fix MCP connection ${row.id} organization to ${projectOrgId}`,
      async () => prisma.mCPConnection.update({
        where: { id: row.id },
        data: { organizationId: projectOrgId }
      }),
      {
        id: row.id,
        projectId: '',
        type: 'OTHER',
        name: '',
        endpoint: '',
        credentials: '',
        status: 'PENDING',
        lastPingAt: null,
        lastSyncAt: null,
        lastError: null,
        availableTools: [],
        serverVersion: null,
        serverName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '',
        organizationId: projectOrgId
      }
    );
    stats.mcpOrganizationFixed += 1;
  }
}

async function repairCmsConnections() {
  const rows = await prisma.cMSConnection.findMany({
    where: onlyOrganizationId
      ? {
          OR: [
            { organizationId: onlyOrganizationId },
            { project: { organizationId: onlyOrganizationId } }
          ]
        }
      : undefined,
    select: {
      id: true,
      name: true,
      organizationId: true,
      projectId: true,
      project: {
        select: {
          organizationId: true
        }
      }
    }
  });

  for (const row of rows) {
    if (row.projectId && row.project?.organizationId) {
      if (row.organizationId !== row.project.organizationId) {
        await mutate(
          `Fix CMS connection ${row.id} organization to ${row.project.organizationId}`,
          async () => prisma.cMSConnection.update({
            where: { id: row.id },
            data: { organizationId: row.project?.organizationId ?? null }
          }),
          {
            id: row.id,
            name: row.name,
            cmsApiUrl: '',
            cmsDashboardUrl: null,
            cmsPublicUrl: null,
            apiKey: '',
            apiKeyPrefix: '',
            apiKeyLastChars: '',
            webhookSecret: '',
            webhookUrl: '',
            googleAnalyticsPropertyId: null,
            googleAnalyticsConnected: false,
            searchConsoleSiteUrl: null,
            searchConsoleConnected: false,
            googleRefreshToken: null,
            googleTokenExpiresAt: null,
            googleScopes: [],
            status: 'PENDING',
            lastPingAt: null,
            lastSyncAt: null,
            lastSyncError: null,
            capabilities: [],
            cmsVersion: null,
            brandingSyncEnabled: true,
            lastBrandingSyncAt: null,
            notes: null,
            enabledAt: new Date(),
            enabledBy: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            organizationId: row.project.organizationId,
            projectId: row.projectId
          }
        );
        stats.cmsOrganizationFixed += 1;
      }
      continue;
    }

    if (!row.projectId && row.organizationId) {
      const targetProjectId = await getProjectWithoutCmsConnectionOrCreate(row.organizationId, row.name);
      await mutate(
        `Assign CMS connection ${row.id} to project ${targetProjectId}`,
        async () => prisma.cMSConnection.update({
          where: { id: row.id },
          data: { projectId: targetProjectId }
        }),
        {
          id: row.id,
          name: row.name,
          cmsApiUrl: '',
          cmsDashboardUrl: null,
          cmsPublicUrl: null,
          apiKey: '',
          apiKeyPrefix: '',
          apiKeyLastChars: '',
          webhookSecret: '',
          webhookUrl: '',
          googleAnalyticsPropertyId: null,
          googleAnalyticsConnected: false,
          searchConsoleSiteUrl: null,
          searchConsoleConnected: false,
          googleRefreshToken: null,
          googleTokenExpiresAt: null,
          googleScopes: [],
          status: 'PENDING',
          lastPingAt: null,
          lastSyncAt: null,
          lastSyncError: null,
          capabilities: [],
          cmsVersion: null,
          brandingSyncEnabled: true,
          lastBrandingSyncAt: null,
          notes: null,
          enabledAt: new Date(),
          enabledBy: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          organizationId: row.organizationId,
          projectId: targetProjectId
        }
      );
      stats.cmsAssignedToProject += 1;
      continue;
    }

    if (!row.projectId && !row.organizationId && !keepUnrecoverable) {
      await mutate(
        `Delete unrecoverable CMS connection ${row.id}`,
        async () => prisma.cMSConnection.delete({
          where: { id: row.id }
        }),
        {
          id: row.id,
          name: row.name,
          cmsApiUrl: '',
          cmsDashboardUrl: null,
          cmsPublicUrl: null,
          apiKey: '',
          apiKeyPrefix: '',
          apiKeyLastChars: '',
          webhookSecret: '',
          webhookUrl: '',
          googleAnalyticsPropertyId: null,
          googleAnalyticsConnected: false,
          searchConsoleSiteUrl: null,
          searchConsoleConnected: false,
          googleRefreshToken: null,
          googleTokenExpiresAt: null,
          googleScopes: [],
          status: 'PENDING',
          lastPingAt: null,
          lastSyncAt: null,
          lastSyncError: null,
          capabilities: [],
          cmsVersion: null,
          brandingSyncEnabled: true,
          lastBrandingSyncAt: null,
          notes: null,
          enabledAt: new Date(),
          enabledBy: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          organizationId: null,
          projectId: null
        }
      );
      stats.unrecoverableDeleted += 1;
    }
  }
}

async function deleteInconsistentShareLinks() {
  const visibilityShares = await prisma.projectVisibilityConfig.findMany({
    select: {
      id: true,
      project: { select: { organizationId: true } },
      config: { select: { organizationId: true } }
    }
  });

  for (const share of visibilityShares) {
    if (share.project.organizationId !== share.config.organizationId) {
      await mutate(
        `Delete inconsistent ProjectVisibilityConfig share ${share.id}`,
        async () => prisma.projectVisibilityConfig.delete({ where: { id: share.id } }),
        {
          id: share.id,
          projectId: '',
          configId: '',
          role: 'VIEWER',
          createdAt: new Date(),
          createdBy: null
        }
      );
      stats.shareLinksDeleted += 1;
    }
  }

  const cmsShares = await prisma.projectCMSConnection.findMany({
    select: {
      id: true,
      project: { select: { organizationId: true } },
      connection: { select: { organizationId: true } }
    }
  });

  for (const share of cmsShares) {
    if (!share.connection.organizationId || share.project.organizationId !== share.connection.organizationId) {
      await mutate(
        `Delete inconsistent ProjectCMSConnection share ${share.id}`,
        async () => prisma.projectCMSConnection.delete({ where: { id: share.id } }),
        {
          id: share.id,
          projectId: '',
          connectionId: '',
          role: 'VIEWER',
          createdAt: new Date(),
          createdBy: null
        }
      );
      stats.shareLinksDeleted += 1;
    }
  }

  const mcpShares = await prisma.projectMCPConnection.findMany({
    select: {
      id: true,
      project: { select: { organizationId: true } },
      connection: { select: { organizationId: true } }
    }
  });

  for (const share of mcpShares) {
    if (!share.connection.organizationId || share.project.organizationId !== share.connection.organizationId) {
      await mutate(
        `Delete inconsistent ProjectMCPConnection share ${share.id}`,
        async () => prisma.projectMCPConnection.delete({ where: { id: share.id } }),
        {
          id: share.id,
          projectId: '',
          connectionId: '',
          role: 'VIEWER',
          createdAt: new Date(),
          createdBy: null
        }
      );
      stats.shareLinksDeleted += 1;
    }
  }
}

async function cleanupProjectTransferInvites() {
  const now = new Date();
  const invites = await prisma.projectTransferInvite.findMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        {
          projectId: {
            notIn: (
              await prisma.project.findMany({ select: { id: true } })
            ).map((project) => project.id)
          }
        }
      ]
    },
    select: { id: true }
  });

  for (const invite of invites) {
    await mutate(
      `Delete stale project transfer invite ${invite.id}`,
      async () => prisma.projectTransferInvite.delete({ where: { id: invite.id } }),
      {
        id: invite.id,
        projectId: '',
        partnerId: '',
        clientEmail: '',
        token: '',
        status: 'pending',
        expiresAt: new Date(),
        createdAt: new Date(),
        acceptedAt: null,
        includeData: false,
        partnerKeepsAccess: true,
        personalMessage: null
      }
    );
    stats.projectTransferInvitesDeleted += 1;
  }
}

async function main() {
  console.log('Workspace consistency repair started.');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY CHANGES'}`);
  if (onlyOrganizationId) {
    console.log(`Scope: organization ${onlyOrganizationId}`);
  } else {
    console.log('Scope: all organizations');
  }

  const organizations = await prisma.organization.findMany({
    where: onlyOrganizationId ? { id: onlyOrganizationId } : undefined,
    select: { id: true }
  });
  const organizationIds = organizations.map((org) => org.id);

  await normalizeProjectsAndLegacyAccess(organizationIds);

  const uniqueOrganizationIds = Array.from(new Set(organizationIds));
  for (const organizationId of uniqueOrganizationIds) {
    await getDefaultProjectId(organizationId);
  }

  await repairVisibilityConfigs();
  await repairCrossChannelInsights();
  await repairMcpConnections();
  await repairCmsConnections();
  await deleteInconsistentShareLinks();
  await cleanupProjectTransferInvites();

  console.log('\nRepair summary:');
  for (const [key, value] of Object.entries(stats)) {
    console.log(`- ${key}: ${value}`);
  }
}

main()
  .catch((error) => {
    console.error('Repair failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

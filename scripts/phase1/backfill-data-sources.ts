import {
  DataSourceOwnershipMode,
  DataSourceType,
  Prisma,
  ProjectDataSourceBindingRole,
} from '@prisma/client';

import { createCounters, createPrismaClient, printCounters, safeString } from './_shared.js';

const prisma = createPrismaClient();
const counters = createCounters();
let bindingCreated = 0;
let bindingUpdated = 0;
let bindingSkipped = 0;
let bindingFailed = 0;
let skippedUnmapped = 0;

type ProjectMeta = {
  id: string;
  name: string;
  organizationId: string | null;
};

function uniqueProjectIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function upsertDataSource(params: {
  organizationId: string;
  sourceType: DataSourceType;
  entityId: string;
  ownershipMode: DataSourceOwnershipMode;
  label: string | null;
  status: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<{ id: string; created: boolean; updated: boolean }> {
  const existing = await prisma.dataSource.findUnique({
    where: {
      sourceType_entityId: {
        sourceType: params.sourceType,
        entityId: params.entityId,
      },
    },
    select: {
      id: true,
      organizationId: true,
      ownershipMode: true,
      label: true,
      status: true,
      metadata: true,
    },
  });

  if (!existing) {
    const created = await prisma.dataSource.create({
      data: {
        organizationId: params.organizationId,
        sourceType: params.sourceType,
        entityId: params.entityId,
        ownershipMode: params.ownershipMode,
        label: params.label,
        status: params.status,
        metadata: params.metadata,
      },
      select: { id: true },
    });
    return { id: created.id, created: true, updated: false };
  }

  const nextMetadata = params.metadata ?? null;
  const currentMetadata = existing.metadata ?? null;
  const changed =
    existing.organizationId !== params.organizationId ||
    existing.ownershipMode !== params.ownershipMode ||
    (existing.label ?? null) !== params.label ||
    (existing.status ?? null) !== params.status ||
    JSON.stringify(currentMetadata) !== JSON.stringify(nextMetadata);

  if (!changed) {
    return { id: existing.id, created: false, updated: false };
  }

  await prisma.dataSource.update({
    where: { id: existing.id },
    data: {
      organizationId: params.organizationId,
      ownershipMode: params.ownershipMode,
      label: params.label,
      status: params.status,
      metadata: params.metadata,
    },
  });
  return { id: existing.id, created: false, updated: true };
}

async function upsertBinding(params: {
  projectId: string;
  dataSourceId: string;
  bindingRole: ProjectDataSourceBindingRole;
}) {
  const existing = await prisma.projectDataSourceBinding.findUnique({
    where: {
      projectId_dataSourceId: {
        projectId: params.projectId,
        dataSourceId: params.dataSourceId,
      },
    },
    select: { id: true, bindingRole: true },
  });

  if (!existing) {
    await prisma.projectDataSourceBinding.create({
      data: {
        projectId: params.projectId,
        dataSourceId: params.dataSourceId,
        bindingRole: params.bindingRole,
      },
    });
    bindingCreated += 1;
    return;
  }

  if (existing.bindingRole === params.bindingRole) {
    bindingSkipped += 1;
    return;
  }

  await prisma.projectDataSourceBinding.update({
    where: { id: existing.id },
    data: { bindingRole: params.bindingRole },
  });
  bindingUpdated += 1;
}

async function registerDataSource(params: {
  organizationId: string | null;
  sourceType: DataSourceType;
  entityId: string;
  ownershipMode: DataSourceOwnershipMode;
  label: string | null;
  status: string | null;
  bindingRole: ProjectDataSourceBindingRole;
  projectIds: string[];
  metadata?: Prisma.InputJsonValue;
}) {
  if (!params.organizationId || !params.projectIds.length) {
    skippedUnmapped += 1;
    counters.skipped += 1;
    return;
  }

  const source = await upsertDataSource({
    organizationId: params.organizationId,
    sourceType: params.sourceType,
    entityId: params.entityId,
    ownershipMode: params.ownershipMode,
    label: params.label,
    status: params.status,
    metadata: params.metadata,
  });

  if (source.created) counters.created += 1;
  if (source.updated) counters.updated += 1;
  if (!source.created && !source.updated) counters.skipped += 1;

  for (const projectId of params.projectIds) {
    try {
      await upsertBinding({
        projectId,
        dataSourceId: source.id,
        bindingRole: params.bindingRole,
      });
    } catch (error) {
      bindingFailed += 1;
      console.error(
        `[backfill-data-sources] binding failed sourceType=${params.sourceType} entityId=${params.entityId} projectId=${projectId}`,
        error
      );
    }
  }
}

async function run(): Promise<void> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });
  const projectMap = new Map<string, ProjectMeta>(projects.map((project) => [project.id, project]));

  const [bots, knowledgeSources, visibilityConfigs, googleConnections, cmsConnections, mcpConnections, n8nConnections] =
    await Promise.all([
      prisma.bot.findMany({
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { organizationId: true } },
        },
      }),
      prisma.knowledgeSource.findMany({
        select: {
          id: true,
          title: true,
          type: true,
          botId: true,
          bot: {
            select: {
              projectId: true,
              project: { select: { organizationId: true } },
            },
          },
        },
      }),
      prisma.visibilityConfig.findMany({
        select: {
          id: true,
          organizationId: true,
          brandName: true,
          projectId: true,
          isActive: true,
          projectShares: { select: { projectId: true } },
        },
      }),
      prisma.googleConnection.findMany({
        select: {
          id: true,
          projectId: true,
          ga4Status: true,
          gscStatus: true,
          project: {
            select: {
              name: true,
              organizationId: true,
            },
          },
        },
      }),
      prisma.cMSConnection.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          organizationId: true,
          projectId: true,
          project: { select: { organizationId: true } },
          projectShares: { select: { projectId: true } },
        },
      }),
      prisma.mCPConnection.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          organizationId: true,
          projectId: true,
          project: { select: { organizationId: true } },
          projectShares: { select: { projectId: true } },
        },
      }),
      prisma.n8NConnection.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          projectId: true,
          project: { select: { organizationId: true } },
        },
      }),
    ]);

  for (const bot of bots) {
    try {
      await registerDataSource({
        organizationId: bot.project.organizationId,
        sourceType: DataSourceType.BOT,
        entityId: bot.id,
        ownershipMode: DataSourceOwnershipMode.DEDICATED,
        label: safeString(bot.name),
        status: null,
        bindingRole: ProjectDataSourceBindingRole.PRIMARY,
        projectIds: uniqueProjectIds([bot.projectId]),
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] bot failed id=${bot.id}`, error);
    }
  }

  for (const knowledgeSource of knowledgeSources) {
    try {
      const projectId = knowledgeSource.bot?.projectId ?? null;
      const organizationId = knowledgeSource.bot?.project?.organizationId ?? null;
      await registerDataSource({
        organizationId,
        sourceType: DataSourceType.KNOWLEDGE_SOURCE,
        entityId: knowledgeSource.id,
        ownershipMode: DataSourceOwnershipMode.DEDICATED,
        label: safeString(knowledgeSource.title) ?? safeString(knowledgeSource.type),
        status: null,
        bindingRole: ProjectDataSourceBindingRole.REFERENCE,
        projectIds: uniqueProjectIds([projectId]),
        metadata: knowledgeSource.botId
          ? ({ botId: knowledgeSource.botId } as Prisma.InputJsonValue)
          : undefined,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] knowledge source failed id=${knowledgeSource.id}`, error);
    }
  }

  for (const config of visibilityConfigs) {
    try {
      const shared = config.projectShares.length > 0;
      const projectIds = uniqueProjectIds([config.projectId, ...config.projectShares.map((share) => share.projectId)]);
      await registerDataSource({
        organizationId: config.organizationId,
        sourceType: DataSourceType.VISIBILITY_CONFIG,
        entityId: config.id,
        ownershipMode: shared ? DataSourceOwnershipMode.SHARED : DataSourceOwnershipMode.DEDICATED,
        label: safeString(config.brandName),
        status: config.isActive ? 'ACTIVE' : 'INACTIVE',
        bindingRole: ProjectDataSourceBindingRole.PRIMARY,
        projectIds,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] visibility config failed id=${config.id}`, error);
    }
  }

  for (const connection of googleConnections) {
    try {
      await registerDataSource({
        organizationId: connection.project.organizationId,
        sourceType: DataSourceType.GOOGLE_CONNECTION,
        entityId: connection.id,
        ownershipMode: DataSourceOwnershipMode.DEDICATED,
        label: `Google: ${connection.project.name}`,
        status: safeString(connection.ga4Status) ?? safeString(connection.gscStatus),
        bindingRole: ProjectDataSourceBindingRole.REFERENCE,
        projectIds: uniqueProjectIds([connection.projectId]),
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] google connection failed id=${connection.id}`, error);
    }
  }

  for (const connection of cmsConnections) {
    try {
      const shared = connection.projectShares.length > 0;
      const projectIds = uniqueProjectIds([
        connection.projectId,
        ...connection.projectShares.map((share) => share.projectId),
      ]);
      const fallbackOrganizationId =
        connection.organizationId ?? connection.project?.organizationId ?? projectMap.get(projectIds[0])?.organizationId ?? null;

      await registerDataSource({
        organizationId: fallbackOrganizationId,
        sourceType: DataSourceType.CMS_CONNECTION,
        entityId: connection.id,
        ownershipMode: shared ? DataSourceOwnershipMode.SHARED : DataSourceOwnershipMode.DEDICATED,
        label: safeString(connection.name),
        status: safeString(connection.status),
        bindingRole: ProjectDataSourceBindingRole.EXECUTION,
        projectIds,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] cms connection failed id=${connection.id}`, error);
    }
  }

  for (const connection of mcpConnections) {
    try {
      const shared = connection.projectShares.length > 0;
      const projectIds = uniqueProjectIds([
        connection.projectId,
        ...connection.projectShares.map((share) => share.projectId),
      ]);
      const fallbackOrganizationId =
        connection.organizationId ?? connection.project?.organizationId ?? projectMap.get(projectIds[0])?.organizationId ?? null;

      await registerDataSource({
        organizationId: fallbackOrganizationId,
        sourceType: DataSourceType.MCP_CONNECTION,
        entityId: connection.id,
        ownershipMode: shared ? DataSourceOwnershipMode.SHARED : DataSourceOwnershipMode.DEDICATED,
        label: safeString(connection.name),
        status: safeString(connection.status),
        bindingRole: ProjectDataSourceBindingRole.EXECUTION,
        projectIds,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] mcp connection failed id=${connection.id}`, error);
    }
  }

  for (const connection of n8nConnections) {
    try {
      await registerDataSource({
        organizationId: connection.project.organizationId,
        sourceType: DataSourceType.N8N_CONNECTION,
        entityId: connection.id,
        ownershipMode: DataSourceOwnershipMode.DEDICATED,
        label: safeString(connection.name),
        status: safeString(connection.status),
        bindingRole: ProjectDataSourceBindingRole.EXECUTION,
        projectIds: uniqueProjectIds([connection.projectId]),
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-data-sources] n8n connection failed id=${connection.id}`, error);
    }
  }

  printCounters('backfill-data-sources', counters, {
    totalProjects: projects.length,
    totalBots: bots.length,
    totalKnowledgeSources: knowledgeSources.length,
    totalVisibilityConfigs: visibilityConfigs.length,
    totalGoogleConnections: googleConnections.length,
    totalCmsConnections: cmsConnections.length,
    totalMcpConnections: mcpConnections.length,
    totalN8nConnections: n8nConnections.length,
    bindingCreated,
    bindingUpdated,
    bindingSkipped,
    bindingFailed,
    skippedUnmapped,
  });
}

run()
  .catch((error) => {
    console.error('[backfill-data-sources] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { DataSourceOwnershipMode } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function syncTransferredProjectIntelligence(params: {
  projectId: string;
  targetOrganizationId: string;
}): Promise<void> {
  const { projectId, targetOrganizationId } = params;

  await prisma.projectTip.updateMany({
    where: {
      projectId,
      organizationId: { not: targetOrganizationId },
    },
    data: { organizationId: targetOrganizationId },
  });

  const dedicatedBindings = await prisma.projectDataSourceBinding.findMany({
    where: {
      projectId,
      dataSource: { ownershipMode: DataSourceOwnershipMode.DEDICATED },
    },
    select: { dataSourceId: true },
  });

  const dedicatedSourceIds = [...new Set(dedicatedBindings.map((binding) => binding.dataSourceId))];
  const dedicatedExclusiveSourceIds: string[] = [];
  const dedicatedSharedAcrossProjects: string[] = [];

  for (const dataSourceId of dedicatedSourceIds) {
    const bindingsCount = await prisma.projectDataSourceBinding.count({
      where: { dataSourceId },
    });

    if (bindingsCount <= 1) {
      dedicatedExclusiveSourceIds.push(dataSourceId);
    } else {
      dedicatedSharedAcrossProjects.push(dataSourceId);
    }
  }

  if (dedicatedExclusiveSourceIds.length > 0) {
    await prisma.dataSource.updateMany({
      where: {
        id: { in: dedicatedExclusiveSourceIds },
        organizationId: { not: targetOrganizationId },
      },
      data: { organizationId: targetOrganizationId },
    });
  }

  if (dedicatedSharedAcrossProjects.length > 0) {
    console.warn('[project-transfer-intelligence] dedicated data sources used by multiple projects; skipped org move', {
      projectId,
      targetOrganizationId,
      dataSourceIds: dedicatedSharedAcrossProjects,
    });
  }

  const sharedSources = await prisma.projectDataSourceBinding.findMany({
    where: {
      projectId,
      dataSource: { ownershipMode: DataSourceOwnershipMode.SHARED },
    },
    select: {
      dataSource: {
        select: {
          id: true,
          sourceType: true,
          entityId: true,
          label: true,
          organizationId: true,
        },
      },
    },
  });

  if (sharedSources.length > 0) {
    console.warn('[project-transfer-intelligence] shared data sources require manual follow-up', {
      projectId,
      targetOrganizationId,
      sharedDataSources: sharedSources.map((item) => item.dataSource),
    });
  }
}

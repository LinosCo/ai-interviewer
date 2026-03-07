import { DataSourceOwnershipMode } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type TransferCompletenessResult = {
  movedTipsCount: number;
  movedDedicatedSourceIds: string[];
  sharedDedicatedSourceIds: string[];
  sharedSourceSummaries: Array<{
    id: string;
    sourceType: string;
    label: string | null;
    organizationId: string;
  }>;
  methodologyDependencies: Array<{
    bindingId: string;
    methodologyProfileId: string;
    methodologyName: string;
    methodologyOrgId: string;
    requiresFollowUp: boolean;
  }>;
  hasUnresolvedDependencies: boolean;
};

export async function syncTransferredProjectIntelligence(params: {
  projectId: string;
  targetOrganizationId: string;
}): Promise<TransferCompletenessResult> {
  const { projectId, targetOrganizationId } = params;

  const { count: movedTipsCount } = await prisma.projectTip.updateMany({
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
  const movedDedicatedSourceIds: string[] = [];
  const sharedDedicatedSourceIds: string[] = [];

  for (const dataSourceId of dedicatedSourceIds) {
    const bindingsCount = await prisma.projectDataSourceBinding.count({
      where: { dataSourceId },
    });

    if (bindingsCount <= 1) {
      movedDedicatedSourceIds.push(dataSourceId);
    } else {
      sharedDedicatedSourceIds.push(dataSourceId);
    }
  }

  if (movedDedicatedSourceIds.length > 0) {
    await prisma.dataSource.updateMany({
      where: {
        id: { in: movedDedicatedSourceIds },
        organizationId: { not: targetOrganizationId },
      },
      data: { organizationId: targetOrganizationId },
    });
  }

  const sharedSourceResults = await prisma.projectDataSourceBinding.findMany({
    where: {
      projectId,
      dataSource: { ownershipMode: DataSourceOwnershipMode.SHARED },
    },
    select: {
      dataSource: {
        select: {
          id: true,
          sourceType: true,
          label: true,
          organizationId: true,
        },
      },
    },
  });

  const sharedSourceSummaries = sharedSourceResults.map((item) => item.dataSource);

  const bindingRows = await prisma.projectMethodologyBinding.findMany({
    where: { projectId },
    select: {
      id: true,
      methodologyProfileId: true,
      methodologyProfile: {
        select: {
          name: true,
          organizationId: true,
        },
      },
    },
  });

  const methodologyDependencies = bindingRows.map((row) => ({
    bindingId: row.id,
    methodologyProfileId: row.methodologyProfileId,
    methodologyName: row.methodologyProfile.name,
    methodologyOrgId: row.methodologyProfile.organizationId,
    requiresFollowUp: row.methodologyProfile.organizationId !== targetOrganizationId,
  }));

  const hasUnresolvedDependencies =
    sharedDedicatedSourceIds.length > 0 ||
    sharedSourceSummaries.length > 0 ||
    methodologyDependencies.some((dep) => dep.requiresFollowUp);

  return {
    movedTipsCount,
    movedDedicatedSourceIds,
    sharedDedicatedSourceIds,
    sharedSourceSummaries,
    methodologyDependencies,
    hasUnresolvedDependencies,
  };
}

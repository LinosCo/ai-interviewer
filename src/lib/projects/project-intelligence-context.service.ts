import { Role } from '@prisma/client';

import { assertProjectAccess, hasRequiredRole } from '@/lib/domain/workspace';
import { prisma } from '@/lib/prisma';
import { isMissingPrismaTable } from '@/lib/prisma-table-errors';
import { readDerivedTipSuggestions } from '@/lib/projects/project-tip-related-suggestions';
import type {
  CrossProjectReference,
  DataSourceBindingSnapshot,
  MethodologyProfileSnapshot,
  ProjectIntelligenceContext,
  ProjectStrategySnapshot,
  ProjectTipSnapshot,
  RoutingCapabilitySnapshot,
} from '@/lib/projects/project-intelligence-types';

export class ProjectIntelligenceContextService {
  static async getContext(params: {
    projectId: string;
    viewerUserId: string;
    includeCrossProjectContext?: boolean;
    limitPerSource?: number;
  }): Promise<ProjectIntelligenceContext> {
    const { projectId, viewerUserId } = params;
    const includeCrossProjectContext = Boolean(params.includeCrossProjectContext);
    const limitPerSource = Math.max(1, Math.min(params.limitPerSource ?? 20, 100));

    const access = await assertProjectAccess(viewerUserId, projectId, 'VIEWER');

    let project: any;
    try {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          strategy: true,
          methodologyBindings: {
            include: { methodologyProfile: true },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          },
          dataSourceBindings: {
            include: { dataSource: true },
            orderBy: { createdAt: 'desc' },
            take: limitPerSource,
          },
          projectTips: {
            orderBy: { updatedAt: 'desc' },
            take: limitPerSource,
          },
          tipRoutingRules: {
            where: { enabled: true },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          },
          cmsConnection: { select: { id: true, name: true, status: true } },
          mcpConnections: { select: { id: true, name: true, status: true } },
          n8nConnection: { select: { id: true, name: true, status: true } },
          cmsShares: { include: { connection: { select: { id: true, name: true, status: true } } } },
          mcpShares: { include: { connection: { select: { id: true, name: true, status: true } } } },
          visibilityConfigs: { select: { id: true, brandName: true, isActive: true } },
          visibilityShares: { include: { config: { select: { id: true, brandName: true, isActive: true } } } },
        },
      });
    } catch (error) {
      if (
        !isMissingPrismaTable(error, [
          'ProjectStrategy',
          'ProjectMethodologyBinding',
          'MethodologyProfile',
          'DataSource',
          'ProjectDataSourceBinding',
          'ProjectTip',
        ])
      ) {
        throw error;
      }

      project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          tipRoutingRules: {
            where: { enabled: true },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          },
          cmsConnection: { select: { id: true, name: true, status: true } },
          mcpConnections: { select: { id: true, name: true, status: true } },
          n8nConnection: { select: { id: true, name: true, status: true } },
          cmsShares: { include: { connection: { select: { id: true, name: true, status: true } } } },
          mcpShares: { include: { connection: { select: { id: true, name: true, status: true } } } },
          visibilityConfigs: { select: { id: true, brandName: true, isActive: true } },
          visibilityShares: { include: { config: { select: { id: true, brandName: true, isActive: true } } } },
        },
      });
    }

    if (!project) {
      throw new Error('Project not found');
    }

    const strategy: ProjectStrategySnapshot | null = project.strategy
      ? {
          projectId: project.id,
          positioning: project.strategy.positioning ?? null,
          valueProposition: project.strategy.valueProposition ?? null,
          targetAudiences: project.strategy.targetAudiences ?? null,
          strategicGoals: project.strategy.strategicGoals ?? null,
          priorityKpis: project.strategy.priorityKpis ?? null,
          keyOffers: project.strategy.keyOffers ?? null,
          constraints: project.strategy.constraints ?? null,
          toneGuidelines: project.strategy.toneGuidelines ?? null,
          editorialPriorities: project.strategy.editorialPriorities ?? null,
          channelPriorities: project.strategy.channelPriorities ?? null,
          updatedAt: project.strategy.updatedAt.toISOString(),
        }
      : project.strategicVision || project.valueProposition
      ? {
          projectId: project.id,
          positioning: project.strategicVision ?? null,
          valueProposition: project.valueProposition ?? null,
          targetAudiences: null,
          strategicGoals: null,
          priorityKpis: null,
          keyOffers: null,
          constraints: null,
          toneGuidelines: null,
          editorialPriorities: null,
          channelPriorities: null,
          updatedAt: project.updatedAt.toISOString(),
        }
      : null;

    const methodologies: MethodologyProfileSnapshot[] = (project.methodologyBindings ?? []).map((binding: any) => ({
      id: binding.methodologyProfile.id,
      organizationId: binding.methodologyProfile.organizationId,
      slug: binding.methodologyProfile.slug,
      name: binding.methodologyProfile.name,
      category: binding.methodologyProfile.category,
      role: binding.role,
      knowledge: binding.methodologyProfile.knowledge,
      isDefault: binding.methodologyProfile.isDefault,
      status: binding.methodologyProfile.status,
    }));

    const dataSources: DataSourceBindingSnapshot[] = (project.dataSourceBindings ?? []).map((binding: any) => ({
      bindingId: binding.id,
      projectId: binding.projectId,
      dataSourceId: binding.dataSource.id,
      sourceType: binding.dataSource.sourceType,
      ownershipMode: binding.dataSource.ownershipMode,
      bindingRole: binding.bindingRole,
      label: binding.dataSource.label ?? null,
      status: binding.dataSource.status ?? null,
      channelIntent: binding.channelIntent ?? null,
      relevanceScore: binding.relevanceScore ?? null,
      metadata: binding.metadata ?? null,
    }));

    const tips: ProjectTipSnapshot[] = (project.projectTips ?? []).map((tip: any) => {
      const derivedSuggestions = readDerivedTipSuggestions(tip.suggestedRouting);

      return {
      id: tip.id,
      organizationId: tip.organizationId,
      projectId: tip.projectId,
      originType: tip.originType,
      originId: tip.originId ?? null,
      originItemKey: tip.originItemKey ?? null,
      originFingerprint: tip.originFingerprint ?? null,
      title: tip.title,
      summary: tip.summary ?? null,
      status: tip.status,
      priority: tip.priority ?? null,
      category: tip.category ?? null,
      contentKind: tip.contentKind ?? null,
      executionClass: tip.executionClass ?? null,
      approvalMode: tip.approvalMode,
      draftStatus: tip.draftStatus,
      routingStatus: tip.routingStatus,
      publishStatus: tip.publishStatus,
      starred: tip.starred,
      reasoning: tip.reasoning ?? null,
      strategicAlignment: tip.strategicAlignment ?? null,
      methodologySummary: tip.methodologySummary ?? null,
      methodologyRefs: tip.methodologyRefs ?? null,
      sourceSnapshot: tip.sourceSnapshot ?? null,
      recommendedActions: tip.recommendedActions ?? null,
      suggestedRouting: tip.suggestedRouting ?? null,
      derivedSuggestions,
      relatedActionSuggestions: derivedSuggestions?.relatedActionSuggestions ?? [],
      relatedPromptSuggestions: derivedSuggestions?.relatedPromptSuggestions ?? [],
      reviewerNotes: (tip as typeof tip & { reviewerNotes?: string | null }).reviewerNotes ?? null,
      createdBy: tip.createdBy ?? null,
      lastEditedBy: tip.lastEditedBy ?? null,
      createdAt: tip.createdAt.toISOString(),
      updatedAt: tip.updatedAt.toISOString(),
      };
    });

    const routingCapabilities: RoutingCapabilitySnapshot[] = [];
    for (const rule of project.tipRoutingRules) {
      routingCapabilities.push({
        kind: 'tip-routing-rule',
        projectId: project.id,
        destinationType: rule.behavior,
        referenceId: rule.mcpConnectionId ?? rule.cmsConnectionId ?? rule.n8nConnectionId ?? null,
        label: rule.label ?? `${rule.contentKind}:${rule.behavior}`,
        enabled: rule.enabled,
        metadata: rule.behaviorConfig ?? null,
      });
    }

    if (project.cmsConnection) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'CMS',
        referenceId: project.cmsConnection.id,
        label: project.cmsConnection.name,
        enabled: project.cmsConnection.status === 'ACTIVE',
      });
    }

    if (project.n8nConnection) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'N8N',
        referenceId: project.n8nConnection.id,
        label: project.n8nConnection.name,
        enabled: project.n8nConnection.status === 'ACTIVE',
      });
    }

    for (const mcp of project.mcpConnections) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'MCP',
        referenceId: mcp.id,
        label: mcp.name,
        enabled: mcp.status === 'ACTIVE',
      });
    }

    for (const sharedCms of project.cmsShares) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'CMS_SHARED',
        referenceId: sharedCms.connection.id,
        label: sharedCms.connection.name,
        enabled: sharedCms.connection.status === 'ACTIVE',
      });
    }

    for (const sharedMcp of project.mcpShares) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'MCP_SHARED',
        referenceId: sharedMcp.connection.id,
        label: sharedMcp.connection.name,
        enabled: sharedMcp.connection.status === 'ACTIVE',
      });
    }

    for (const visibility of project.visibilityConfigs) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'VISIBILITY',
        referenceId: visibility.id,
        label: visibility.brandName,
        enabled: visibility.isActive,
      });
    }

    for (const visibilityShare of project.visibilityShares) {
      routingCapabilities.push({
        kind: 'integration',
        projectId: project.id,
        destinationType: 'VISIBILITY_SHARED',
        referenceId: visibilityShare.config.id,
        label: visibilityShare.config.brandName,
        enabled: visibilityShare.config.isActive,
      });
    }

    const crossProjectContext = includeCrossProjectContext
      ? await this.getCrossProjectReferences({
          viewerUserId,
          organizationId: access.organizationId,
          currentProjectId: project.id,
          role: access.role,
          isPlatformAdmin: access.isPlatformAdmin,
          limitPerSource,
        })
      : [];

    return {
      projectId: project.id,
      projectName: project.name,
      organizationId: access.organizationId,
      strategy,
      methodologies,
      dataSources,
      tips,
      routingCapabilities,
      crossProjectContext,
    };
  }

  private static async getCrossProjectReferences(params: {
    viewerUserId: string;
    organizationId: string;
    currentProjectId: string;
    role: Role;
    isPlatformAdmin: boolean;
    limitPerSource: number;
  }): Promise<CrossProjectReference[]> {
    const canAccessAllProjects = params.isPlatformAdmin || hasRequiredRole(params.role, 'ADMIN');

    let projects: Array<{
      id: string;
      name: string;
      projectTips?: Array<{ title: string; category: string | null }>;
    }> = [];
    try {
      projects = await prisma.project.findMany({
        where: {
          organizationId: params.organizationId,
          id: { not: params.currentProjectId },
          ...(canAccessAllProjects
            ? {}
            : {
                OR: [
                  { ownerId: params.viewerUserId },
                  { accessList: { some: { userId: params.viewerUserId } } },
                ],
              }),
        },
        select: {
          id: true,
          name: true,
          projectTips: {
            orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
            take: Math.min(params.limitPerSource, 5),
            select: { title: true, category: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(params.limitPerSource, 20),
      });
    } catch (error) {
      if (!isMissingPrismaTable(error, ['ProjectTip'])) {
        throw error;
      }

      projects = await prisma.project.findMany({
        where: {
          organizationId: params.organizationId,
          id: { not: params.currentProjectId },
          ...(canAccessAllProjects
            ? {}
            : {
                OR: [
                  { ownerId: params.viewerUserId },
                  { accessList: { some: { userId: params.viewerUserId } } },
                ],
              }),
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(params.limitPerSource, 20),
      });
    }

    return projects.map((project) => ({
      projectId: project.id,
      name: project.name,
      topTipTitles: (project.projectTips ?? []).map((tip) => tip.title),
      patterns: [...new Set((project.projectTips ?? []).map((tip) => tip.category).filter((value): value is string => Boolean(value)))],
    }));
  }
}

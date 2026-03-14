import { Prisma, ProjectTipOriginType, ProjectTipStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { isMissingPrismaTable } from '@/lib/prisma-table-errors';
import type { ProjectTipGroundingEvidenceRow, ProjectTipGroundingPayload } from '@/lib/projects/project-intelligence-types';

function safeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeStatus(value: unknown): ProjectTipStatus {
  const normalized = safeString(value)?.toLowerCase();
  switch (normalized) {
    case 'reviewed':
      return ProjectTipStatus.REVIEWED;
    case 'approved':
      return ProjectTipStatus.APPROVED;
    case 'drafted':
      return ProjectTipStatus.DRAFTED;
    case 'routed':
      return ProjectTipStatus.ROUTED;
    case 'automated':
      return ProjectTipStatus.AUTOMATED;
    case 'completed':
    case 'done':
      return ProjectTipStatus.COMPLETED;
    case 'dismissed':
    case 'archived':
      return ProjectTipStatus.ARCHIVED;
    default:
      return ProjectTipStatus.NEW;
  }
}

function isNonEmptyJson(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function collectActionEvidence(payload: unknown, sourceTypeFallback: string): ProjectTipGroundingEvidenceRow[] {
  const rows: ProjectTipGroundingEvidenceRow[] = [];
  const payloadObj = toRecord(payload);
  const actions = Array.isArray(payloadObj?.suggestedActions)
    ? payloadObj.suggestedActions
    : Array.isArray(payloadObj?.actions)
      ? payloadObj.actions
      : [];
  let sortOrder = 0;

  for (const action of actions) {
    const actionObj = toRecord(action);
    if (!actionObj) continue;
    const sourceType = safeString(actionObj.sourceType) ?? sourceTypeFallback;
    const evidenceItems = Array.isArray(actionObj.evidence) ? actionObj.evidence : [];

    for (const evidence of evidenceItems) {
      if (typeof evidence === 'string' && evidence.trim()) {
        rows.push({
          sourceType,
          detail: evidence.trim(),
          sortOrder: sortOrder++,
        });
        continue;
      }

      const evidenceObj = toRecord(evidence);
      if (!evidenceObj) continue;
      const detail =
        safeString(evidenceObj.detail) ??
        safeString(evidenceObj.reasoning) ??
        safeString(evidenceObj.text);
      if (!detail) continue;
      rows.push({
        sourceType,
        sourceEntityId: safeString(evidenceObj.sourceRef),
        sourceLabel: safeString(evidenceObj.sourceLabel),
        detail,
        metricValue: toNumberOrNull(evidenceObj.metricValue),
        metricUnit: safeString(evidenceObj.metricUnit),
        sortOrder: sortOrder++,
      });
    }
  }

  return rows;
}

async function buildProjectSummaries(projectId: string): Promise<{
  strategySummary: string | null;
  methodologySummary: string | null;
  methodologyRefsSummary: string[];
}> {
  let project: {
    strategy?: {
      positioning: string | null;
      valueProposition: string | null;
    } | null;
    strategicVision?: string | null;
    valueProposition?: string | null;
    methodologyBindings?: Array<{
      methodologyProfile: {
        name: string;
        slug: string;
        category: string;
      };
    }>;
  } | null = null;

  try {
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        strategy: {
          select: {
            positioning: true,
            valueProposition: true,
          },
        },
        methodologyBindings: {
          include: {
            methodologyProfile: {
              select: { name: true, slug: true, category: true },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!isMissingPrismaTable(error, ['ProjectStrategy', 'ProjectMethodologyBinding', 'MethodologyProfile'])) {
      throw error;
    }

    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        strategicVision: true,
        valueProposition: true,
      },
    });
  }

  const strategySummary = project?.strategy
    ? [safeString(project.strategy.positioning), safeString(project.strategy.valueProposition)]
        .filter((value): value is string => Boolean(value))
        .join(' | ') || null
    : [safeString(project?.strategicVision), safeString(project?.valueProposition)]
        .filter((value): value is string => Boolean(value))
        .join(' | ') || null;

  const methodologyBindings = project?.methodologyBindings ?? [];
  const methodologyRefsSummary = methodologyBindings.map(
    (binding) => `${binding.methodologyProfile.slug}:${binding.methodologyProfile.name}`
  );
  const methodologySummary = methodologyBindings.length
    ? methodologyBindings
        .map((binding) => `${binding.methodologyProfile.name} (${binding.methodologyProfile.category})`)
        .join(' | ')
    : null;

  return { strategySummary, methodologySummary, methodologyRefsSummary };
}

async function resolveProjectTargetsFromVisibilityConfig(configId: string): Promise<{ organizationId: string; projectIds: string[] }> {
  const config = await prisma.visibilityConfig.findUnique({
    where: { id: configId },
    select: {
      organizationId: true,
      projectId: true,
      projectShares: { select: { projectId: true } },
    },
  });

  if (!config) throw new Error(`VisibilityConfig ${configId} not found`);
  const projectIds = [
    ...new Set([config.projectId, ...config.projectShares.map((share) => share.projectId)].filter(Boolean)),
  ] as string[];
  if (!projectIds.length) {
    throw new Error(`No project target resolvable for VisibilityConfig ${configId}`);
  }
  return { organizationId: config.organizationId, projectIds };
}

export class ProjectTipGroundingService {
  static async buildFromCrossChannelInsight(insightId: string): Promise<ProjectTipGroundingPayload> {
    const insight = await prisma.crossChannelInsight.findUnique({
      where: { id: insightId },
    });
    if (!insight) throw new Error(`CrossChannelInsight ${insightId} not found`);
    if (!insight.projectId) throw new Error(`CrossChannelInsight ${insightId} has no projectId`);

    const visibility = toRecord(insight.visibilityData);
    const reasoning = safeString(visibility?.globalReasoning);
    const summary = reasoning ? reasoning.slice(0, 280) : null;

    const evidenceRows: ProjectTipGroundingEvidenceRow[] = [];
    let sortOrder = 0;
    if (isNonEmptyJson(insight.interviewData)) {
      evidenceRows.push({ sourceType: 'interview', detail: 'Legacy interviewData block present', sortOrder: sortOrder++ });
    }
    if (isNonEmptyJson(insight.chatbotData)) {
      evidenceRows.push({ sourceType: 'chatbot', detail: 'Legacy chatbotData block present', sortOrder: sortOrder++ });
    }
    if (isNonEmptyJson(insight.visibilityData)) {
      evidenceRows.push({ sourceType: 'visibility', detail: 'Legacy visibilityData block present', sortOrder: sortOrder++ });
    }

    const actionEvidence = collectActionEvidence(insight.suggestedActions, 'legacy_action');
    actionEvidence.forEach((row, idx) => evidenceRows.push({ ...row, sortOrder: sortOrder + idx }));

    const { strategySummary, methodologySummary, methodologyRefsSummary } = await buildProjectSummaries(insight.projectId);

    return {
      tip: {
        organizationId: insight.organizationId,
        projectId: insight.projectId,
        originType: ProjectTipOriginType.CROSS_CHANNEL_INSIGHT,
        originId: insight.id,
        originItemKey: 'base',
        title: insight.topicName,
        summary,
        status: normalizeStatus(insight.status),
        priority: insight.priorityScore,
        category: null,
        reasoning,
        strategicAlignment: null,
        sourceSnapshot: {
          interviewData: insight.interviewData ?? null,
          chatbotData: insight.chatbotData ?? null,
          visibilityData: insight.visibilityData ?? null,
        } as Prisma.JsonObject,
        recommendedActions: (insight.suggestedActions as Prisma.JsonValue) ?? null,
      },
      evidenceRows,
      methodologyRefsSummary,
      strategySummary,
      methodologySummary,
    };
  }

  static async buildFromWebsiteAnalysis(params: {
    analysisId: string;
    recommendationIndex: number;
    targetProjectId: string;
  }): Promise<ProjectTipGroundingPayload> {
    const analysis = await prisma.websiteAnalysis.findUnique({
      where: { id: params.analysisId },
      select: { id: true, configId: true, status: true, recommendations: true },
    });
    if (!analysis) throw new Error(`WebsiteAnalysis ${params.analysisId} not found`);

    const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const recommendation = recommendations[params.recommendationIndex];
    const recommendationObj = toRecord(recommendation);
    if (!recommendationObj) {
      throw new Error(`Recommendation index ${params.recommendationIndex} missing for analysis ${params.analysisId}`);
    }

    const title = safeString(recommendationObj.title);
    if (!title) throw new Error(`Recommendation ${params.recommendationIndex} has no title`);

    const target = await resolveProjectTargetsFromVisibilityConfig(analysis.configId);
    if (!target.projectIds.includes(params.targetProjectId)) {
      throw new Error(`Target project ${params.targetProjectId} not linked to VisibilityConfig ${analysis.configId}`);
    }
    const projectId = params.targetProjectId;
    const evidenceRows: ProjectTipGroundingEvidenceRow[] = [];
    const evidencePoints = Array.isArray(recommendationObj.evidencePoints) ? recommendationObj.evidencePoints : [];
    let sortOrder = 0;
    for (const point of evidencePoints) {
      const detail = safeString(point);
      if (!detail) continue;
      evidenceRows.push({ sourceType: 'website_analysis', detail, sortOrder: sortOrder++ });
    }
    const actionEvidence = collectActionEvidence(recommendationObj, 'legacy_action');
    actionEvidence.forEach((row, idx) => evidenceRows.push({ ...row, sortOrder: sortOrder + idx }));

    const { strategySummary, methodologySummary, methodologyRefsSummary } = await buildProjectSummaries(projectId);

    return {
      tip: {
        organizationId: target.organizationId,
        projectId,
        originType: ProjectTipOriginType.WEBSITE_ANALYSIS,
        originId: analysis.id,
        originItemKey: `rec:${params.recommendationIndex}`,
        title,
        summary: safeString(recommendationObj.description),
        status: normalizeStatus(recommendationObj.status ?? analysis.status),
        priority: toNumberOrNull(recommendationObj.priority),
        category: null,
        reasoning: safeString(recommendationObj.impact),
        strategicAlignment: safeString(recommendationObj.strategyAlignment),
        sourceSnapshot: recommendationObj as Prisma.JsonObject,
        recommendedActions: ((recommendationObj.contentDraft ?? recommendationObj) as Prisma.JsonValue) ?? null,
      },
      evidenceRows,
      methodologyRefsSummary,
      strategySummary,
      methodologySummary,
    };
  }

  static async buildFromBrandReport(params: {
    reportId: string;
    tipIndex: number;
    targetProjectId: string;
  }): Promise<ProjectTipGroundingPayload> {
    const report = await prisma.brandReport.findUnique({
      where: { id: params.reportId },
      select: { id: true, configId: true, status: true, aiTips: true },
    });
    if (!report) throw new Error(`BrandReport ${params.reportId} not found`);

    const aiTips = toRecord(report.aiTips);
    const tips = Array.isArray(aiTips?.tips) ? aiTips.tips : [];
    const tipObj = toRecord(tips[params.tipIndex]);
    if (!tipObj) throw new Error(`Tip index ${params.tipIndex} missing for report ${params.reportId}`);

    const title = safeString(tipObj.title);
    if (!title) throw new Error(`BrandReport tip ${params.tipIndex} has no title`);

    const target = await resolveProjectTargetsFromVisibilityConfig(report.configId);
    if (!target.projectIds.includes(params.targetProjectId)) {
      throw new Error(`Target project ${params.targetProjectId} not linked to VisibilityConfig ${report.configId}`);
    }
    const projectId = params.targetProjectId;
    const evidenceRows = collectActionEvidence(tipObj, 'legacy_action').map((row, idx) => ({
      ...row,
      sortOrder: idx,
    }));
    const { strategySummary, methodologySummary, methodologyRefsSummary } = await buildProjectSummaries(projectId);

    return {
      tip: {
        organizationId: target.organizationId,
        projectId,
        originType: ProjectTipOriginType.BRAND_REPORT,
        originId: report.id,
        originItemKey: `tip:${params.tipIndex}`,
        title,
        summary: safeString(tipObj.description) ?? safeString(tipObj.summary),
        status: normalizeStatus(tipObj.status ?? report.status),
        priority: toNumberOrNull(tipObj.priority) ?? toNumberOrNull(tipObj.score),
        category: safeString(tipObj.category),
        reasoning: safeString(tipObj.rationale) ?? safeString(tipObj.reasoning),
        strategicAlignment: null,
        sourceSnapshot: tipObj as Prisma.JsonObject,
        recommendedActions: null,
      },
      evidenceRows,
      methodologyRefsSummary,
      strategySummary,
      methodologySummary,
    };
  }

  static async buildFromCopilotInput(params: {
    projectId: string;
    organizationId: string;
    title: string;
    reasoning?: string | null;
    summary?: string | null;
    actions?: unknown;
    evidence?: unknown;
  }): Promise<ProjectTipGroundingPayload> {
    const { strategySummary, methodologySummary, methodologyRefsSummary } = await buildProjectSummaries(params.projectId);

    const evidenceRows: ProjectTipGroundingEvidenceRow[] = [];
    const explicitEvidence = Array.isArray(params.evidence) ? params.evidence : [];
    let sortOrder = 0;
    for (const item of explicitEvidence) {
      if (typeof item === 'string' && item.trim()) {
        evidenceRows.push({
          sourceType: 'copilot',
          detail: item.trim(),
          sortOrder: sortOrder++,
        });
        continue;
      }
      const itemObj = toRecord(item);
      const detail = safeString(itemObj?.detail) ?? safeString(itemObj?.text);
      if (!detail) continue;
      evidenceRows.push({
        sourceType: safeString(itemObj?.sourceType) ?? 'copilot',
        sourceEntityId: safeString(itemObj?.sourceRef),
        sourceLabel: safeString(itemObj?.sourceLabel),
        detail,
        metricValue: toNumberOrNull(itemObj?.metricValue),
        metricUnit: safeString(itemObj?.metricUnit),
        sortOrder: sortOrder++,
      });
    }

    return {
      tip: {
        organizationId: params.organizationId,
        projectId: params.projectId,
        originType: ProjectTipOriginType.COPILOT,
        originId: null,
        originItemKey: 'base',
        title: params.title,
        summary: params.summary ?? null,
        status: ProjectTipStatus.NEW,
        priority: null,
        category: null,
        reasoning: params.reasoning ?? null,
        strategicAlignment: strategySummary,
        sourceSnapshot: null,
        recommendedActions: (params.actions as Prisma.JsonValue) ?? null,
      },
      evidenceRows,
      methodologyRefsSummary,
      strategySummary,
      methodologySummary,
    };
  }
}

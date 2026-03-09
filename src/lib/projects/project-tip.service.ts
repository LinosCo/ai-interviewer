import {
  Prisma,
  ProjectTipOriginType,
  TipApprovalMode,
  TipDraftStatus,
  TipPublishStatus,
  TipRevisionEditorType,
  TipRouteDestinationType,
  TipRoutePolicyMode,
  TipExecutionRunType,
  TipRoutingStatus,
  type ProjectTip,
  type ProjectTipStatus,
  type TipRouteStatus,
} from '@prisma/client';

import { assertProjectAccess } from '@/lib/domain/workspace';
import { prisma } from '@/lib/prisma';
import { ProjectTipGroundingService } from '@/lib/projects/project-tip-grounding.service';
import {
  mergeSuggestedRoutingWithDerivedSuggestions,
  readDerivedTipSuggestions,
} from '@/lib/projects/project-tip-related-suggestions';
import type {
  ProjectTipDetailSnapshot,
  ProjectTipExecutionSnapshot,
  ProjectTipGroundingPayload,
  ProjectTipRouteSnapshot,
  ProjectTipSnapshot,
  TipExplainabilityBlock,
} from '@/lib/projects/project-intelligence-types';

function buildOriginFingerprint(
  projectId: string,
  originType: ProjectTipOriginType,
  originId: string | null,
  originItemKey: string | null
): string {
  return `${projectId}:${originType}:${originId || 'none'}:${originItemKey || 'base'}`;
}

function toNullableJson(
  value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapTipSnapshot(
  tip: ProjectTip,
  counts?: { evidenceCount: number; routeCount: number; executionCount: number }
): ProjectTipSnapshot {
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
    reviewerNotes: (tip as ProjectTip & { reviewerNotes?: string | null }).reviewerNotes ?? null,
    createdBy: tip.createdBy ?? null,
    lastEditedBy: tip.lastEditedBy ?? null,
    evidenceCount: counts?.evidenceCount,
    routeCount: counts?.routeCount,
    executionCount: counts?.executionCount,
    createdAt: tip.createdAt.toISOString(),
    updatedAt: tip.updatedAt.toISOString(),
  };
}

function buildStoredSuggestedRouting(context: {
  title: string;
  summary?: string | null;
  contentKind?: string | null;
  category?: string | null;
  executionClass?: string | null;
  recommendedActions?: unknown;
  suggestedRouting?: unknown;
  sourceSnapshot?: unknown;
}): Prisma.InputJsonValue {
  return mergeSuggestedRoutingWithDerivedSuggestions(context) as Prisma.InputJsonValue;
}

function buildExplainability(
  tip: ProjectTip & { reviewerNotes?: string | null },
  evidenceCount: number
): TipExplainabilityBlock {
  const projectInputsUsed: string[] = [];
  if (evidenceCount > 0) projectInputsUsed.push(`${evidenceCount} evidence signal${evidenceCount !== 1 ? 's' : ''}`);
  if (tip.sourceSnapshot) projectInputsUsed.push('source data snapshot');
  if (tip.methodologyRefs) projectInputsUsed.push('methodology references');

  let automationRecommendation: string | null = null;
  const routing = toRecord(tip.suggestedRouting);
  if (routing) {
    const dest = String(routing.destinationType || routing.destination || '').toLowerCase();
    const kind = tip.contentKind || '';
    if (dest) {
      automationRecommendation = kind
        ? `Route as ${kind} via ${dest}`
        : `Route via ${dest}`;
    }
  } else if (tip.contentKind) {
    automationRecommendation = `Content type: ${tip.contentKind} — configure a routing rule to automate dispatch`;
  }

  const whyThisTip = tip.reasoning
    ? tip.reasoning.slice(0, 300)
    : tip.summary
    ? `Based on: ${tip.summary.slice(0, 250)}`
    : 'No explicit reasoning recorded — tip was created manually or migrated.';

  return {
    whyThisTip,
    projectInputsUsed,
    strategyContext: tip.strategicAlignment ?? null,
    methodologyContext: tip.methodologySummary ?? null,
    automationRecommendation,
  };
}

function mapTipRouteSnapshot(route: {
  id: string;
  tipId: string;
  destinationType: any;
  destinationRefId: string | null;
  policyMode: any;
  status: any;
  payloadPreview: Prisma.JsonValue | null;
  lastDispatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectTipRouteSnapshot {
  return {
    id: route.id,
    tipId: route.tipId,
    destinationType: route.destinationType,
    destinationRefId: route.destinationRefId,
    policyMode: route.policyMode,
    status: route.status,
    payloadPreview: route.payloadPreview,
    lastDispatchedAt: route.lastDispatchedAt ? route.lastDispatchedAt.toISOString() : null,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  };
}

function mapTipExecutionSnapshot(execution: {
  id: string;
  tipId: string;
  routeId: string | null;
  runType: any;
  status: any;
  requestPayload: Prisma.JsonValue | null;
  responsePayload: Prisma.JsonValue | null;
  errorMessage: string | null;
  executedBy: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): ProjectTipExecutionSnapshot {
  return {
    id: execution.id,
    tipId: execution.tipId,
    routeId: execution.routeId,
    runType: execution.runType,
    status: execution.status,
    requestPayload: execution.requestPayload,
    responsePayload: execution.responsePayload,
    errorMessage: execution.errorMessage,
    executedBy: execution.executedBy,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt ? execution.completedAt.toISOString() : null,
  };
}

async function syncEvidenceRows(tipId: string, evidenceRows: ProjectTipGroundingPayload['evidenceRows']): Promise<void> {
  await prisma.projectTipEvidence.deleteMany({ where: { tipId } });
  if (!evidenceRows.length) return;

  await prisma.projectTipEvidence.createMany({
    data: evidenceRows.map((row, idx) => ({
      tipId,
      sourceType: row.sourceType,
      sourceEntityId: row.sourceEntityId ?? null,
      sourceLabel: row.sourceLabel ?? null,
      detail: row.detail,
      metricValue: row.metricValue ?? null,
      metricUnit: row.metricUnit ?? null,
      sortOrder: row.sortOrder ?? idx,
    })),
  });
}

async function appendRevision(params: {
  tipId: string;
  editorType: TipRevisionEditorType;
  editorUserId?: string | null;
  changeSummary: string;
  snapshot: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.projectTipRevision.create({
    data: {
      tipId: params.tipId,
      editorType: params.editorType,
      editorUserId: params.editorUserId ?? null,
      changeSummary: params.changeSummary,
      snapshot: params.snapshot,
    },
  });
}

async function materializeGrounding(payload: ProjectTipGroundingPayload): Promise<{ tipId: string; created: boolean }> {
  const originFingerprint = buildOriginFingerprint(
    payload.tip.projectId,
    payload.tip.originType,
    payload.tip.originId,
    payload.tip.originItemKey
  );

  const existing = await prisma.projectTip.findUnique({
    where: { originFingerprint },
    select: { id: true, suggestedRouting: true },
  });

  const tip = existing
    ? await prisma.projectTip.update({
        where: { id: existing.id },
        data: {
          organizationId: payload.tip.organizationId,
          projectId: payload.tip.projectId,
          originType: payload.tip.originType,
          originId: payload.tip.originId,
          originItemKey: payload.tip.originItemKey,
          originFingerprint,
          title: payload.tip.title,
          summary: payload.tip.summary,
          status: payload.tip.status,
          priority: payload.tip.priority,
          category: payload.tip.category,
          reasoning: payload.tip.reasoning,
          strategicAlignment: payload.tip.strategicAlignment,
          methodologySummary: payload.methodologySummary,
          methodologyRefs: toNullableJson(payload.methodologyRefsSummary as unknown as Prisma.InputJsonValue),
          sourceSnapshot: toNullableJson(payload.tip.sourceSnapshot),
          recommendedActions: toNullableJson(payload.tip.recommendedActions),
          suggestedRouting: toNullableJson(
            buildStoredSuggestedRouting({
              title: payload.tip.title,
              summary: payload.tip.summary,
              category: payload.tip.category,
              recommendedActions: payload.tip.recommendedActions,
              suggestedRouting: existing?.suggestedRouting ?? null,
              sourceSnapshot: payload.tip.sourceSnapshot,
            })
          ),
        },
      })
    : await prisma.projectTip.create({
        data: {
          organizationId: payload.tip.organizationId,
          projectId: payload.tip.projectId,
          originType: payload.tip.originType,
          originId: payload.tip.originId,
          originItemKey: payload.tip.originItemKey,
          originFingerprint,
          title: payload.tip.title,
          summary: payload.tip.summary,
          status: payload.tip.status,
          priority: payload.tip.priority,
          category: payload.tip.category,
          reasoning: payload.tip.reasoning,
          strategicAlignment: payload.tip.strategicAlignment,
          methodologySummary: payload.methodologySummary,
          methodologyRefs: toNullableJson(payload.methodologyRefsSummary as unknown as Prisma.InputJsonValue),
          sourceSnapshot: toNullableJson(payload.tip.sourceSnapshot),
          recommendedActions: toNullableJson(payload.tip.recommendedActions),
          suggestedRouting: toNullableJson(
            buildStoredSuggestedRouting({
              title: payload.tip.title,
              summary: payload.tip.summary,
              category: payload.tip.category,
              recommendedActions: payload.tip.recommendedActions,
              sourceSnapshot: payload.tip.sourceSnapshot,
            })
          ),
        },
      });

  await syncEvidenceRows(tip.id, payload.evidenceRows);
  return { tipId: tip.id, created: !existing };
}

async function resolveProjectTargetsFromVisibilityConfig(configId: string): Promise<string[]> {
  const config = await prisma.visibilityConfig.findUnique({
    where: { id: configId },
    select: {
      projectId: true,
      projectShares: { select: { projectId: true } },
    },
  });
  if (!config) return [];
  return [...new Set([config.projectId, ...config.projectShares.map((share) => share.projectId)].filter(Boolean))] as string[];
}

export type CreateManualTipInput = {
  projectId: string;
  organizationId: string;
  title: string;
  summary?: string | null;
  priority?: number | null;
  category?: string | null;
  contentKind?: string | null;
  executionClass?: string | null;
  approvalMode?: TipApprovalMode;
  reasoning?: string | null;
  strategicAlignment?: string | null;
  recommendedActions?: unknown;
  suggestedRouting?: unknown;
  sourceSnapshot?: unknown;
  createdBy?: string | null;
  actorUserId?: string;
};

export type CreateCopilotTipInput = {
  projectId: string;
  organizationId: string;
  title: string;
  summary?: string | null;
  priority?: number | null;
  category?: string | null;
  contentKind?: string | null;
  executionClass?: string | null;
  approvalMode?: TipApprovalMode;
  reasoning?: string | null;
  strategicAlignment?: string | null;
  suggestedRouting?: unknown;
  actions?: unknown;
  evidence?: unknown;
  createdBy?: string | null;
};

export type UpdateProjectTipInput = {
  projectId: string;
  tipId: string;
  actorUserId: string;
  title?: string;
  summary?: string | null;
  status?: ProjectTip['status'];
  priority?: number | null;
  category?: string | null;
  contentKind?: string | null;
  executionClass?: string | null;
  approvalMode?: TipApprovalMode;
  draftStatus?: TipDraftStatus;
  routingStatus?: TipRoutingStatus;
  publishStatus?: TipPublishStatus;
  starred?: boolean;
  reasoning?: string | null;
  strategicAlignment?: string | null;
  methodologySummary?: string | null;
  recommendedActions?: unknown;
  suggestedRouting?: unknown;
  reviewerNotes?: string | null;
  lastEditedBy?: string | null;
};

export type DuplicateProjectTipInput = {
  projectId: string;
  tipId: string;
  actorUserId: string;
  createdBy?: string | null;
};

export class ProjectTipService {
  static async materializeFromCrossChannelInsight(insightId: string): Promise<{ tipId: string | null; created: boolean }> {
    const payload = await ProjectTipGroundingService.buildFromCrossChannelInsight(insightId);
    const result = await materializeGrounding(payload);
    await appendRevision({
      tipId: result.tipId,
      editorType: TipRevisionEditorType.SYSTEM,
      changeSummary: `Materialized from ${ProjectTipOriginType.CROSS_CHANNEL_INSIGHT}:${insightId}`,
      snapshot: {
        sourceSnapshot: payload.tip.sourceSnapshot ?? null,
        recommendedActions: payload.tip.recommendedActions ?? null,
      } as Prisma.InputJsonValue,
    });
    return result;
  }

  static async materializeFromWebsiteAnalysis(
    analysisId: string
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const analysis = await prisma.websiteAnalysis.findUnique({
      where: { id: analysisId },
      select: { id: true, configId: true, recommendations: true },
    });
    if (!analysis) return { created: 0, updated: 0, skipped: 1 };

    const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    const targets = await resolveProjectTargetsFromVisibilityConfig(analysis.configId);
    if (!targets.length) return { created: 0, updated: 0, skipped: recommendations.length || 1 };

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let index = 0; index < recommendations.length; index += 1) {
      for (const projectId of targets) {
        const payload = await ProjectTipGroundingService.buildFromWebsiteAnalysis({
          analysisId,
          recommendationIndex: index,
          targetProjectId: projectId,
        });
        const result = await materializeGrounding(payload);
        if (result.created) created += 1;
        else updated += 1;
      }
    }

    if (!recommendations.length) skipped += 1;
    return { created, updated, skipped };
  }

  static async materializeFromBrandReport(reportId: string): Promise<{ created: number; updated: number; skipped: number }> {
    const report = await prisma.brandReport.findUnique({
      where: { id: reportId },
      select: { id: true, configId: true, aiTips: true },
    });
    if (!report) return { created: 0, updated: 0, skipped: 1 };

    const tips = Array.isArray(toRecord(report.aiTips)?.tips) ? (toRecord(report.aiTips)?.tips as unknown[]) : [];
    const targets = await resolveProjectTargetsFromVisibilityConfig(report.configId);
    if (!targets.length) return { created: 0, updated: 0, skipped: tips.length || 1 };

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let index = 0; index < tips.length; index += 1) {
      for (const projectId of targets) {
        const payload = await ProjectTipGroundingService.buildFromBrandReport({
          reportId,
          tipIndex: index,
          targetProjectId: projectId,
        });
        const result = await materializeGrounding(payload);
        if (result.created) created += 1;
        else updated += 1;
      }
    }

    if (!tips.length) skipped += 1;
    return { created, updated, skipped };
  }

  static async createManualTip(input: CreateManualTipInput): Promise<ProjectTip> {
    if (input.actorUserId) {
      await assertProjectAccess(input.actorUserId, input.projectId, 'MEMBER');
    }

    const tip = await prisma.projectTip.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        originType: ProjectTipOriginType.MANUAL,
        originId: null,
        originItemKey: null,
        originFingerprint: null,
        title: input.title,
        summary: input.summary ?? null,
        priority: input.priority ?? null,
        category: input.category ?? null,
        contentKind: input.contentKind ?? null,
        executionClass: input.executionClass ?? null,
        approvalMode: input.approvalMode ?? TipApprovalMode.MANUAL,
        reasoning: input.reasoning ?? null,
        strategicAlignment: input.strategicAlignment ?? null,
        recommendedActions: toNullableJson((input.recommendedActions as Prisma.InputJsonValue) ?? null),
        suggestedRouting: toNullableJson(
          buildStoredSuggestedRouting({
            title: input.title,
            summary: input.summary ?? null,
            contentKind: input.contentKind ?? null,
            category: input.category ?? null,
            executionClass: input.executionClass ?? null,
            recommendedActions: input.recommendedActions ?? null,
            suggestedRouting: input.suggestedRouting ?? null,
            sourceSnapshot: input.sourceSnapshot ?? null,
          })
        ),
        sourceSnapshot: toNullableJson((input.sourceSnapshot as Prisma.InputJsonValue) ?? null),
        createdBy: input.createdBy ?? null,
        lastEditedBy: input.createdBy ?? null,
      },
    });

    await appendRevision({
      tipId: tip.id,
      editorType: input.createdBy ? TipRevisionEditorType.USER : TipRevisionEditorType.SYSTEM,
      editorUserId: input.createdBy ?? null,
      changeSummary: 'Manual tip created',
      snapshot: {
        title: tip.title,
        summary: tip.summary ?? null,
        contentKind: tip.contentKind ?? null,
        executionClass: tip.executionClass ?? null,
        approvalMode: tip.approvalMode,
      } as Prisma.InputJsonValue,
    });

    return tip;
  }

  static async createCopilotTip(input: CreateCopilotTipInput): Promise<ProjectTip> {
    const payload = await ProjectTipGroundingService.buildFromCopilotInput({
      projectId: input.projectId,
      organizationId: input.organizationId,
      title: input.title,
      summary: input.summary ?? null,
      reasoning: input.reasoning ?? null,
      actions: input.actions,
      evidence: input.evidence,
    });

    const tip = await prisma.projectTip.create({
      data: {
        organizationId: payload.tip.organizationId,
        projectId: payload.tip.projectId,
        originType: payload.tip.originType,
        originId: payload.tip.originId,
        originItemKey: payload.tip.originItemKey,
        originFingerprint: null,
        title: payload.tip.title,
        summary: payload.tip.summary ?? null,
        status: payload.tip.status,
        priority: input.priority ?? payload.tip.priority ?? null,
        category: input.category ?? payload.tip.category ?? null,
        contentKind: input.contentKind ?? null,
        executionClass: input.executionClass ?? null,
        approvalMode: input.approvalMode ?? TipApprovalMode.MANUAL,
        reasoning: payload.tip.reasoning ?? null,
        strategicAlignment: input.strategicAlignment ?? payload.tip.strategicAlignment ?? null,
        methodologySummary: payload.methodologySummary,
        methodologyRefs: toNullableJson(payload.methodologyRefsSummary as unknown as Prisma.InputJsonValue),
        sourceSnapshot: toNullableJson(payload.tip.sourceSnapshot as Prisma.InputJsonValue),
        recommendedActions: toNullableJson(payload.tip.recommendedActions as Prisma.InputJsonValue),
        suggestedRouting: toNullableJson(
          buildStoredSuggestedRouting({
            title: payload.tip.title,
            summary: payload.tip.summary ?? null,
            contentKind: input.contentKind ?? null,
            category: input.category ?? payload.tip.category ?? null,
            executionClass: input.executionClass ?? null,
            recommendedActions: payload.tip.recommendedActions,
            suggestedRouting: input.suggestedRouting ?? null,
            sourceSnapshot: payload.tip.sourceSnapshot,
          })
        ),
        createdBy: input.createdBy ?? null,
        lastEditedBy: input.createdBy ?? null,
      },
    });

    await syncEvidenceRows(tip.id, payload.evidenceRows);
    await appendRevision({
      tipId: tip.id,
      editorType: TipRevisionEditorType.COPILOT,
      editorUserId: input.createdBy ?? null,
      changeSummary: 'Copilot canonical tip created',
      snapshot: {
        title: tip.title,
        summary: tip.summary ?? null,
        contentKind: tip.contentKind ?? null,
        executionClass: tip.executionClass ?? null,
        approvalMode: tip.approvalMode,
      } as Prisma.InputJsonValue,
    });

    return tip;
  }

  static async updateTip(input: UpdateProjectTipInput): Promise<ProjectTip> {
    await assertProjectAccess(input.actorUserId, input.projectId, 'MEMBER');

    const existing = await prisma.projectTip.findFirst({
      where: { id: input.tipId, projectId: input.projectId },
      select: {
        id: true,
        title: true,
        summary: true,
        category: true,
        contentKind: true,
        executionClass: true,
        recommendedActions: true,
        suggestedRouting: true,
        sourceSnapshot: true,
      },
    });
    if (!existing) {
      throw new Error('Tip not found');
    }

    const updated = await prisma.projectTip.update({
      where: { id: input.tipId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.contentKind !== undefined ? { contentKind: input.contentKind } : {}),
        ...(input.executionClass !== undefined ? { executionClass: input.executionClass } : {}),
        ...(input.approvalMode !== undefined ? { approvalMode: input.approvalMode } : {}),
        ...(input.draftStatus !== undefined ? { draftStatus: input.draftStatus } : {}),
        ...(input.routingStatus !== undefined ? { routingStatus: input.routingStatus } : {}),
        ...(input.publishStatus !== undefined ? { publishStatus: input.publishStatus } : {}),
        ...(input.starred !== undefined ? { starred: input.starred } : {}),
        ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
        ...(input.strategicAlignment !== undefined ? { strategicAlignment: input.strategicAlignment } : {}),
        ...(input.methodologySummary !== undefined ? { methodologySummary: input.methodologySummary } : {}),
        ...(input.recommendedActions !== undefined
          ? { recommendedActions: toNullableJson(input.recommendedActions as Prisma.InputJsonValue) }
          : {}),
        suggestedRouting: toNullableJson(
          buildStoredSuggestedRouting({
            title: input.title ?? existing.title,
            summary: input.summary !== undefined ? input.summary : existing.summary,
            contentKind: input.contentKind !== undefined ? input.contentKind : existing.contentKind,
            category: input.category !== undefined ? input.category : existing.category,
            executionClass: input.executionClass !== undefined ? input.executionClass : existing.executionClass,
            recommendedActions: input.recommendedActions !== undefined ? input.recommendedActions : existing.recommendedActions,
            suggestedRouting: input.suggestedRouting !== undefined ? input.suggestedRouting : existing.suggestedRouting,
            sourceSnapshot: existing.sourceSnapshot,
          })
        ),
        ...(input.reviewerNotes !== undefined ? { reviewerNotes: input.reviewerNotes } : {}),
        ...(input.lastEditedBy !== undefined ? { lastEditedBy: input.lastEditedBy } : {}),
      },
    });

    await appendRevision({
      tipId: updated.id,
      editorType: TipRevisionEditorType.USER,
      editorUserId: input.lastEditedBy ?? null,
      changeSummary: 'Tip updated manually',
      snapshot: {
        title: updated.title,
        summary: updated.summary ?? null,
        status: updated.status,
        contentKind: updated.contentKind ?? null,
        executionClass: updated.executionClass ?? null,
        approvalMode: updated.approvalMode,
        draftStatus: updated.draftStatus,
        routingStatus: updated.routingStatus,
        publishStatus: updated.publishStatus,
        methodologySummary: updated.methodologySummary ?? null,
      } as Prisma.InputJsonValue,
    });

    return updated;
  }

  static async duplicateTip(input: DuplicateProjectTipInput): Promise<ProjectTip> {
    await assertProjectAccess(input.actorUserId, input.projectId, 'MEMBER');

    const source = await prisma.projectTip.findFirst({
      where: {
        id: input.tipId,
        projectId: input.projectId,
      },
    });
    if (!source) {
      throw new Error('Tip not found for duplication');
    }

    const duplicated = await prisma.projectTip.create({
      data: {
        organizationId: source.organizationId,
        projectId: source.projectId,
        originType: ProjectTipOriginType.MANUAL,
        originId: source.id,
        originItemKey: 'duplicate',
        originFingerprint: null,
        title: `${source.title} (Copy)`,
        summary: source.summary,
        status: source.status,
        priority: source.priority,
        category: source.category,
        contentKind: source.contentKind,
        executionClass: source.executionClass,
        starred: source.starred,
        reasoning: source.reasoning,
        strategicAlignment: source.strategicAlignment,
        methodologySummary: source.methodologySummary,
        methodologyRefs: toNullableJson(source.methodologyRefs),
        sourceSnapshot: toNullableJson(source.sourceSnapshot),
        recommendedActions: toNullableJson(source.recommendedActions),
        suggestedRouting: toNullableJson(
          buildStoredSuggestedRouting({
            title: `${source.title} (Copy)`,
            summary: source.summary,
            contentKind: source.contentKind,
            category: source.category,
            executionClass: source.executionClass,
            recommendedActions: source.recommendedActions,
            suggestedRouting: source.suggestedRouting,
            sourceSnapshot: source.sourceSnapshot,
          })
        ),
        createdBy: input.createdBy ?? null,
        lastEditedBy: input.createdBy ?? null,
      },
    });

    const sourceEvidence = await prisma.projectTipEvidence.findMany({
      where: { tipId: source.id },
    });
    if (sourceEvidence.length) {
      await prisma.projectTipEvidence.createMany({
        data: sourceEvidence.map((row) => ({
          tipId: duplicated.id,
          sourceType: row.sourceType,
          sourceEntityId: row.sourceEntityId,
          sourceLabel: row.sourceLabel,
          detail: row.detail,
          metricValue: row.metricValue,
          metricUnit: row.metricUnit,
          sortOrder: row.sortOrder,
        })),
      });
    }

    await appendRevision({
      tipId: duplicated.id,
      editorType: TipRevisionEditorType.SYSTEM,
      editorUserId: input.createdBy ?? null,
      changeSummary: `Tip duplicated from ${source.id}`,
      snapshot: {
        sourceTipId: source.id,
      } as Prisma.InputJsonValue,
    });

    return duplicated;
  }

  static async listProjectTips(params: {
    projectId: string;
    viewerUserId: string;
    status?: ProjectTipStatus;
    starred?: boolean;
  }): Promise<ProjectTipSnapshot[]> {
    await assertProjectAccess(params.viewerUserId, params.projectId, 'VIEWER');
    const tips = await prisma.projectTip.findMany({
      where: {
        projectId: params.projectId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.starred !== undefined ? { starred: params.starred } : {}),
      },
      include: {
        _count: {
          select: {
            evidence: true,
            routes: true,
            executions: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    return tips.map((tip) =>
      mapTipSnapshot(tip, {
        evidenceCount: tip._count.evidence,
        routeCount: tip._count.routes,
        executionCount: tip._count.executions,
      })
    );
  }

  static async getProjectTip(params: {
    projectId: string;
    tipId: string;
    viewerUserId: string;
  }): Promise<ProjectTipDetailSnapshot | null> {
    await assertProjectAccess(params.viewerUserId, params.projectId, 'VIEWER');
    const tip = await prisma.projectTip.findFirst({
      where: { id: params.tipId, projectId: params.projectId },
      include: {
        evidence: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        revisions: { orderBy: { createdAt: 'desc' } },
        routes: { orderBy: { createdAt: 'desc' } },
        executions: { orderBy: { startedAt: 'desc' } },
      },
    });
    if (!tip) return null;

    return {
      ...mapTipSnapshot(tip),
      evidence: tip.evidence.map((row) => ({
        id: row.id,
        tipId: row.tipId,
        sourceType: row.sourceType,
        sourceEntityId: row.sourceEntityId ?? null,
        sourceLabel: row.sourceLabel ?? null,
        detail: row.detail,
        metricValue: row.metricValue ?? null,
        metricUnit: row.metricUnit ?? null,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt.toISOString(),
      })),
      revisions: tip.revisions.map((revision) => ({
        id: revision.id,
        tipId: revision.tipId,
        editorType: revision.editorType,
        editorUserId: revision.editorUserId ?? null,
        changeSummary: revision.changeSummary,
        snapshot: revision.snapshot,
        createdAt: revision.createdAt.toISOString(),
      })),
      routes: tip.routes.map(mapTipRouteSnapshot),
      executions: tip.executions.map(mapTipExecutionSnapshot),
      explainability: buildExplainability(tip as ProjectTip & { reviewerNotes?: string | null }, tip.evidence.length),
      reviewerNotes: (tip as ProjectTip & { reviewerNotes?: string | null }).reviewerNotes ?? null,
    };
  }

  static async listTipExecutions(params: {
    projectId: string;
    tipId: string;
    viewerUserId: string;
  }): Promise<ProjectTipExecutionSnapshot[]> {
    await assertProjectAccess(params.viewerUserId, params.projectId, 'VIEWER');

    const tip = await prisma.projectTip.findFirst({
      where: { id: params.tipId, projectId: params.projectId },
      select: { id: true },
    });
    if (!tip) {
      throw new Error('Tip not found');
    }

    const executions = await prisma.projectTipExecution.findMany({
      where: { tipId: params.tipId },
      orderBy: { startedAt: 'desc' },
    });

    return executions.map(mapTipExecutionSnapshot);
  }

  static async summarizeRoutingStatus(params: {
    projectId: string;
    viewerUserId: string;
  }): Promise<Array<{
    category: string | null;
    contentKind: string | null;
    tipCount: number;
    statusCounts: Record<TipRouteStatus | 'UNROUTED', number>;
    executionCount: number;
  }>> {
    await assertProjectAccess(params.viewerUserId, params.projectId, 'VIEWER');

    const tips = await prisma.projectTip.findMany({
      where: { projectId: params.projectId },
      include: {
        routes: { select: { status: true } },
        executions: { select: { id: true } },
      },
    });

    const buckets = new Map<
      string,
      {
        category: string | null;
        contentKind: string | null;
        tipCount: number;
        statusCounts: Record<TipRouteStatus | 'UNROUTED', number>;
        executionCount: number;
      }
    >();

    const emptyStatusCounts = (): Record<TipRouteStatus | 'UNROUTED', number> => ({
      UNROUTED: 0,
      PLANNED: 0,
      READY: 0,
      DISPATCHED: 0,
      SUCCEEDED: 0,
      FAILED: 0,
    });

    for (const tip of tips) {
      const key = `${tip.category || '__null__'}::${tip.contentKind || '__null__'}`;
      const bucket =
        buckets.get(key) ??
        {
          category: tip.category ?? null,
          contentKind: tip.contentKind ?? null,
          tipCount: 0,
          statusCounts: emptyStatusCounts(),
          executionCount: 0,
        };

      bucket.tipCount += 1;
      bucket.executionCount += tip.executions.length;

      if (!tip.routes.length) {
        bucket.statusCounts.UNROUTED += 1;
      } else {
        for (const route of tip.routes) {
          bucket.statusCounts[route.status] += 1;
        }
      }

      buckets.set(key, bucket);
    }

    return Array.from(buckets.values()).sort((a, b) => b.tipCount - a.tipCount);
  }

  // ─── Canonical Route & Execution Helpers ────────────────────────────────────

  /**
   * Find or create a canonical route for a tip/destination pair.
   * Returns the route id for use with openExecution().
   */
  static async upsertRoute(params: {
    tipId: string;
    destinationType: TipRouteDestinationType;
    destinationRefId?: string | null;
    policyMode?: TipRoutePolicyMode;
    payloadPreview?: Prisma.InputJsonValue | null;
  }): Promise<string> {
    const { tipId, destinationType, destinationRefId = null, policyMode = 'AUTO_EXECUTE', payloadPreview } = params;

    const existing = await prisma.projectTipRoute.findFirst({
      where: { tipId, destinationType, destinationRefId },
      select: { id: true },
    });

    if (existing) {
      await prisma.projectTipRoute.update({
        where: { id: existing.id },
        data: {
          status: 'READY',
          ...(policyMode ? { policyMode } : {}),
          ...(payloadPreview !== undefined ? { payloadPreview: toNullableJson(payloadPreview) } : {}),
        },
      });
      return existing.id;
    }

    const created = await prisma.projectTipRoute.create({
      data: {
        tipId,
        destinationType,
        destinationRefId,
        policyMode,
        status: 'READY',
        ...(payloadPreview !== undefined ? { payloadPreview: toNullableJson(payloadPreview) } : {}),
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Open a new execution record in RUNNING state.
   * Returns the execution id for use with markExecutionSuccess/Failure.
   */
  static async openExecution(params: {
    tipId: string;
    routeId: string | null;
    runType: TipExecutionRunType;
    requestPayload?: Prisma.InputJsonValue | null;
  }): Promise<string> {
    const { tipId, routeId, runType, requestPayload } = params;

    const execution = await prisma.projectTipExecution.create({
      data: {
        tipId,
        routeId,
        runType,
        status: 'RUNNING',
        requestPayload: requestPayload !== undefined ? toNullableJson(requestPayload) : Prisma.DbNull,
      },
      select: { id: true },
    });
    return execution.id;
  }

  /**
   * Mark an execution as SUCCEEDED and update the parent route + tip lifecycle.
   */
  static async markExecutionSuccess(params: {
    executionId: string;
    routeId: string | null;
    responsePayload?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    const { executionId, routeId, responsePayload } = params;

    const execution = await prisma.projectTipExecution.update({
      where: { id: executionId },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        ...(responsePayload !== undefined ? { responsePayload: toNullableJson(responsePayload) } : {}),
      },
      select: { tipId: true },
    });

    if (routeId) {
      await prisma.projectTipRoute.update({
        where: { id: routeId },
        data: { status: 'SUCCEEDED', lastDispatchedAt: new Date() },
      });
    }

    // Conservatively advance tip lifecycle: dispatched but not declared published
    await prisma.projectTip.update({
      where: { id: execution.tipId },
      data: { routingStatus: 'DISPATCHED' },
    });
  }

  /**
   * Mark an execution as FAILED and update the parent route + tip lifecycle.
   */
  static async markExecutionFailure(params: {
    executionId: string;
    routeId: string | null;
    errorMessage: string;
  }): Promise<void> {
    const { executionId, routeId, errorMessage } = params;

    const execution = await prisma.projectTipExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage,
      },
      select: { tipId: true },
    });

    if (routeId) {
      await prisma.projectTipRoute.update({
        where: { id: routeId },
        data: { status: 'FAILED' },
      });
    }

    await prisma.projectTip.update({
      where: { id: execution.tipId },
      data: { routingStatus: 'FAILED' },
    });
  }
}

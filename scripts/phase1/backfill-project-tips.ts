import { Prisma, ProjectTipOriginType, ProjectTipStatus, TipRevisionEditorType } from '@prisma/client';

import {
  buildOriginFingerprint,
  createCounters,
  createPrismaClient,
  isNonEmptyJson,
  normalizeJsonArray,
  printCounters,
  safeString,
} from './_shared.js';

const prisma = createPrismaClient();
const counters = createCounters();
let evidenceCreated = 0;
let revisionCreated = 0;
let skippedNoProject = 0;

type EvidenceInput = {
  sourceType: string;
  sourceEntityId?: string | null;
  sourceLabel?: string | null;
  detail: string;
  metricValue?: number | null;
  metricUnit?: string | null;
  sortOrder: number;
};

function toProjectTipStatus(value: unknown): ProjectTipStatus {
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
    case 'new':
    default:
      return ProjectTipStatus.NEW;
  }
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

function shortSummary(value: string | null): string | null {
  if (!value) return null;
  return value.length > 280 ? value.slice(0, 280) : value;
}

function collectActionEvidence(payload: unknown, sourceTypeFallback: string): EvidenceInput[] {
  const rows: EvidenceInput[] = [];
  const actions = normalizeJsonArray(
    toRecord(payload)?.suggestedActions ??
      toRecord(payload)?.actions ??
      toRecord(payload)?.recommendedActions
  );

  let sort = 0;
  for (const action of actions) {
    const actionObj = toRecord(action);
    if (!actionObj) continue;
    const sourceType = safeString(actionObj.sourceType) ?? sourceTypeFallback;
    const evidenceItems = normalizeJsonArray(actionObj.evidence);
    for (const item of evidenceItems) {
      if (typeof item === 'string' && item.trim()) {
        rows.push({
          sourceType,
          detail: item.trim(),
          sortOrder: sort++,
        });
        continue;
      }
      const evidenceObj = toRecord(item);
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
        sortOrder: sort++,
      });
    }
  }
  return rows;
}

async function syncEvidence(tipId: string, rows: EvidenceInput[]): Promise<void> {
  const existing = await prisma.projectTipEvidence.findMany({
    where: { tipId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      sourceType: true,
      sourceEntityId: true,
      sourceLabel: true,
      detail: true,
      metricValue: true,
      metricUnit: true,
      sortOrder: true,
    },
  });

  const normalizedIncoming = rows.map((row) => ({
    sourceType: row.sourceType,
    sourceEntityId: row.sourceEntityId ?? null,
    sourceLabel: row.sourceLabel ?? null,
    detail: row.detail,
    metricValue: row.metricValue ?? null,
    metricUnit: row.metricUnit ?? null,
    sortOrder: row.sortOrder,
  }));
  const normalizedExisting = existing.map((row) => ({
    sourceType: row.sourceType,
    sourceEntityId: row.sourceEntityId ?? null,
    sourceLabel: row.sourceLabel ?? null,
    detail: row.detail,
    metricValue: row.metricValue ?? null,
    metricUnit: row.metricUnit ?? null,
    sortOrder: row.sortOrder,
  }));

  if (JSON.stringify(normalizedExisting) === JSON.stringify(normalizedIncoming)) {
    return;
  }

  await prisma.projectTipEvidence.deleteMany({ where: { tipId } });
  if (!rows.length) return;

  await prisma.projectTipEvidence.createMany({
    data: rows.map((row) => ({
      tipId,
      sourceType: row.sourceType,
      sourceEntityId: row.sourceEntityId ?? null,
      sourceLabel: row.sourceLabel ?? null,
      detail: row.detail,
      metricValue: row.metricValue ?? null,
      metricUnit: row.metricUnit ?? null,
      sortOrder: row.sortOrder,
    })),
  });
  evidenceCreated += rows.length;
}

function toNullableJson(
  value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

async function ensureRevision(params: {
  tipId: string;
  originType: ProjectTipOriginType;
  originId: string;
  originItemKey: string;
  snapshot: Prisma.InputJsonValue;
}): Promise<void> {
  const changeSummary = `Backfill import from ${params.originType}:${params.originId}:${params.originItemKey}`;
  const existing = await prisma.projectTipRevision.findFirst({
    where: {
      tipId: params.tipId,
      editorType: TipRevisionEditorType.SYSTEM,
      changeSummary,
    },
    select: { id: true },
  });

  if (existing) return;
  await prisma.projectTipRevision.create({
    data: {
      tipId: params.tipId,
      editorType: TipRevisionEditorType.SYSTEM,
      changeSummary,
      snapshot: params.snapshot,
    },
  });
  revisionCreated += 1;
}

async function upsertTip(params: {
  organizationId: string;
  projectId: string;
  originType: ProjectTipOriginType;
  originId: string;
  originItemKey: string;
  title: string;
  summary: string | null;
  status: ProjectTipStatus;
  priority: number | null;
  category?: string | null;
  reasoning?: string | null;
  strategicAlignment?: string | null;
  sourceSnapshot?: Prisma.InputJsonValue | Prisma.JsonValue | null;
  recommendedActions?: Prisma.InputJsonValue | Prisma.JsonValue | null;
  evidenceRows: EvidenceInput[];
}): Promise<void> {
  const originFingerprint = buildOriginFingerprint(
    params.projectId,
    params.originType,
    params.originId,
    params.originItemKey
  );
  const existing = await prisma.projectTip.findUnique({
    where: { originFingerprint },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      title: true,
      summary: true,
      status: true,
      priority: true,
      category: true,
      reasoning: true,
      strategicAlignment: true,
      sourceSnapshot: true,
      recommendedActions: true,
    },
  });

  const nextData = {
    organizationId: params.organizationId,
    projectId: params.projectId,
    originType: params.originType,
    originId: params.originId,
    originItemKey: params.originItemKey,
    originFingerprint,
    title: params.title,
    summary: params.summary,
    status: params.status,
    priority: params.priority,
    category: params.category ?? null,
    reasoning: params.reasoning ?? null,
    strategicAlignment: params.strategicAlignment ?? null,
    sourceSnapshot: toNullableJson(params.sourceSnapshot),
    recommendedActions: toNullableJson(params.recommendedActions),
  };

  let tipId: string;
  if (!existing) {
    const created = await prisma.projectTip.create({
      data: nextData,
      select: { id: true },
    });
    counters.created += 1;
    tipId = created.id;
  } else {
    const changed =
      existing.organizationId !== nextData.organizationId ||
      existing.projectId !== nextData.projectId ||
      existing.title !== nextData.title ||
      (existing.summary ?? null) !== (nextData.summary ?? null) ||
      existing.status !== nextData.status ||
      (existing.priority ?? null) !== (nextData.priority ?? null) ||
      (existing.category ?? null) !== (nextData.category ?? null) ||
      (existing.reasoning ?? null) !== (nextData.reasoning ?? null) ||
      (existing.strategicAlignment ?? null) !== (nextData.strategicAlignment ?? null) ||
      JSON.stringify(existing.sourceSnapshot ?? null) !== JSON.stringify(nextData.sourceSnapshot ?? null) ||
      JSON.stringify(existing.recommendedActions ?? null) !==
        JSON.stringify(nextData.recommendedActions ?? null);

    if (!changed) {
      counters.skipped += 1;
    } else {
      await prisma.projectTip.update({
        where: { id: existing.id },
        data: nextData,
      });
      counters.updated += 1;
    }
    tipId = existing.id;
  }

  await syncEvidence(tipId, params.evidenceRows);
  await ensureRevision({
    tipId,
    originType: params.originType,
    originId: params.originId,
    originItemKey: params.originItemKey,
    snapshot: {
      sourceSnapshot: params.sourceSnapshot ?? null,
      recommendedActions: params.recommendedActions ?? null,
      importedAt: new Date().toISOString(),
    },
  });
}

async function runCrossChannelBackfill(): Promise<void> {
  const insights = await prisma.crossChannelInsight.findMany({
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      topicName: true,
      status: true,
      priorityScore: true,
      suggestedActions: true,
      interviewData: true,
      chatbotData: true,
      visibilityData: true,
    },
  });

  for (const insight of insights) {
    try {
      if (!insight.projectId) {
        counters.skipped += 1;
        skippedNoProject += 1;
        continue;
      }

      const visibilityRecord = toRecord(insight.visibilityData);
      const reasoning =
        safeString(visibilityRecord?.globalReasoning) ??
        safeString(toRecord(normalizeJsonArray(insight.suggestedActions)[0])?.reasoning);
      const summary = shortSummary(reasoning);

      const evidenceRows: EvidenceInput[] = [];
      let sort = 0;
      if (isNonEmptyJson(insight.interviewData)) {
        evidenceRows.push({
          sourceType: 'interview',
          detail: 'Legacy interviewData block present',
          sortOrder: sort++,
        });
      }
      if (isNonEmptyJson(insight.chatbotData)) {
        evidenceRows.push({
          sourceType: 'chatbot',
          detail: 'Legacy chatbotData block present',
          sortOrder: sort++,
        });
      }
      if (isNonEmptyJson(insight.visibilityData)) {
        evidenceRows.push({
          sourceType: 'visibility',
          detail: 'Legacy visibilityData block present',
          sortOrder: sort++,
        });
      }
      evidenceRows.push(...collectActionEvidence(insight.suggestedActions, 'legacy_action'));

      const title = safeString(insight.topicName);
      if (!title) {
        counters.skipped += 1;
        continue;
      }

      await upsertTip({
        organizationId: insight.organizationId,
        projectId: insight.projectId,
        originType: ProjectTipOriginType.CROSS_CHANNEL_INSIGHT,
        originId: insight.id,
        originItemKey: 'base',
        title,
        summary,
        status: toProjectTipStatus(insight.status),
        priority: toNumberOrNull(insight.priorityScore),
        reasoning,
      sourceSnapshot: ({
          interviewData: insight.interviewData ?? null,
          chatbotData: insight.chatbotData ?? null,
          visibilityData: insight.visibilityData ?? null,
        }) as Prisma.InputJsonValue,
      recommendedActions: insight.suggestedActions,
      evidenceRows,
      });
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-project-tips] cross insight failed id=${insight.id}`, error);
    }
  }
}

async function runWebsiteAnalysisBackfill(projectTargetsByConfigId: Map<string, string[]>): Promise<void> {
  const analyses = await prisma.websiteAnalysis.findMany({
    select: {
      id: true,
      configId: true,
      status: true,
      recommendations: true,
    },
  });

  const configOrgMap = new Map(
    (
      await prisma.visibilityConfig.findMany({
        select: { id: true, organizationId: true },
      })
    ).map((config) => [config.id, config.organizationId])
  );

  for (const analysis of analyses) {
    try {
      const recommendations = normalizeJsonArray(analysis.recommendations);
      if (!recommendations.length) {
        counters.skipped += 1;
        continue;
      }

      const targetProjects = projectTargetsByConfigId.get(analysis.configId) ?? [];
      const organizationId = configOrgMap.get(analysis.configId) ?? null;

      if (!organizationId || !targetProjects.length) {
        skippedNoProject += recommendations.length;
        counters.skipped += recommendations.length;
        continue;
      }

      for (let index = 0; index < recommendations.length; index += 1) {
        const recommendationObj = toRecord(recommendations[index]);
        const title = safeString(recommendationObj?.title);
        if (!title) {
          counters.skipped += targetProjects.length;
          continue;
        }

        const summary = safeString(recommendationObj?.description);
        const reasoning = safeString(recommendationObj?.impact);
        const strategicAlignment = safeString(recommendationObj?.strategyAlignment);
        const recommendationStatus = recommendationObj?.status ?? analysis.status;
        const evidencePoints = normalizeJsonArray(recommendationObj?.evidencePoints);

        const evidenceRows: EvidenceInput[] = [];
        let sort = 0;
        for (const point of evidencePoints) {
          const detail = safeString(point);
          if (!detail) continue;
          evidenceRows.push({
            sourceType: 'website_analysis',
            detail,
            sortOrder: sort++,
          });
        }
        evidenceRows.push(...collectActionEvidence(recommendationObj, 'legacy_action'));

        for (const projectId of targetProjects) {
          await upsertTip({
            organizationId,
            projectId,
            originType: ProjectTipOriginType.WEBSITE_ANALYSIS,
            originId: analysis.id,
            originItemKey: `rec:${index}`,
            title,
            summary,
            status: toProjectTipStatus(recommendationStatus),
            priority: toNumberOrNull(recommendationObj?.priority),
            reasoning,
            strategicAlignment,
            sourceSnapshot: recommendationObj as Prisma.InputJsonValue,
            recommendedActions: recommendationObj?.contentDraft ?? recommendationObj,
            evidenceRows,
          });
        }
      }
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-project-tips] website analysis failed id=${analysis.id}`, error);
    }
  }
}

async function runBrandReportBackfill(projectTargetsByConfigId: Map<string, string[]>): Promise<void> {
  const reports = await prisma.brandReport.findMany({
    select: {
      id: true,
      configId: true,
      status: true,
      aiTips: true,
    },
  });

  const configOrgMap = new Map(
    (
      await prisma.visibilityConfig.findMany({
        select: { id: true, organizationId: true },
      })
    ).map((config) => [config.id, config.organizationId])
  );

  for (const report of reports) {
    try {
      const payload = toRecord(report.aiTips);
      const tips = normalizeJsonArray(payload?.tips);
      if (!tips.length) {
        counters.skipped += 1;
        continue;
      }

      const targetProjects = projectTargetsByConfigId.get(report.configId) ?? [];
      const organizationId = configOrgMap.get(report.configId) ?? null;
      if (!organizationId || !targetProjects.length) {
        skippedNoProject += tips.length;
        counters.skipped += tips.length;
        continue;
      }

      for (let index = 0; index < tips.length; index += 1) {
        const tipObj = toRecord(tips[index]);
        const title = safeString(tipObj?.title);
        if (!title) {
          counters.skipped += targetProjects.length;
          continue;
        }

        const summary = safeString(tipObj?.description) ?? safeString(tipObj?.summary);
        const reasoning = safeString(tipObj?.rationale) ?? safeString(tipObj?.reasoning);
        const category = safeString(tipObj?.category);
        const status = toProjectTipStatus(tipObj?.status ?? report.status);
        const priority = toNumberOrNull(tipObj?.priority) ?? toNumberOrNull(tipObj?.score);
        const evidenceRows = collectActionEvidence(tipObj, 'legacy_action').map((row, idx) => ({
          ...row,
          sortOrder: idx,
        }));

        for (const projectId of targetProjects) {
          await upsertTip({
            organizationId,
            projectId,
            originType: ProjectTipOriginType.BRAND_REPORT,
            originId: report.id,
            originItemKey: `tip:${index}`,
            title,
            summary,
            status,
            priority,
            category,
            reasoning,
            sourceSnapshot: tipObj as Prisma.InputJsonValue,
            recommendedActions: null,
            evidenceRows,
          });
        }
      }
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-project-tips] brand report failed id=${report.id}`, error);
    }
  }
}

async function buildProjectTargetsByConfig(): Promise<Map<string, string[]>> {
  const configs = await prisma.visibilityConfig.findMany({
    select: {
      id: true,
      projectId: true,
      projectShares: { select: { projectId: true } },
    },
  });

  const targets = new Map<string, string[]>();
  for (const config of configs) {
    targets.set(
      config.id,
      [...new Set([config.projectId, ...config.projectShares.map((share) => share.projectId)].filter(Boolean))] as string[]
    );
  }
  return targets;
}

async function run(): Promise<void> {
  const projectTargetsByConfigId = await buildProjectTargetsByConfig();

  await runCrossChannelBackfill();
  await runWebsiteAnalysisBackfill(projectTargetsByConfigId);
  await runBrandReportBackfill(projectTargetsByConfigId);

  printCounters('backfill-project-tips', counters, {
    evidenceCreated,
    revisionCreated,
    skippedNoProject,
  });
}

run()
  .catch((error) => {
    console.error('[backfill-project-tips] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

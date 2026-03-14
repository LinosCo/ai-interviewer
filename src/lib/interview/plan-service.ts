import type { Bot, TopicBlock } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  InterviewPlan,
  InterviewPlanOverrides,
} from './plan-types';
import {
  buildDeterministicScores,
  maybeRefineWithLlm,
  resolveBudgetConfig,
  clamp,
  round2,
  mapImportanceBand,
  DEFAULT_BUDGET_CONFIG,
  type PlanBudgetConfig,
  type ScoredTopic,
} from './plan-grading';
import { applyComputation } from './plan-coverage';

export type { PlanBudgetConfig };
export { DEFAULT_BUDGET_CONFIG };

// ─── Override sanitization ────────────────────────────────────────────────────

export function sanitizeOverrides(base: InterviewPlan, overrides?: InterviewPlanOverrides | null): InterviewPlanOverrides {
  if (!overrides) return {};
  const exploreTopicIds = new Set(base.explore.topics.map((topic) => topic.topicId));
  const sanitized: InterviewPlanOverrides = {
    explore: { topics: {} },
    deepen: {
      maxTurnsPerTopic: overrides.deepen?.maxTurnsPerTopic,
      fallbackTurns: overrides.deepen?.fallbackTurns,
    },
  };

  for (const [topicId, topicOverride] of Object.entries(overrides.explore?.topics || {})) {
    if (!exploreTopicIds.has(topicId)) continue;
    type TopicOverrideEntry = NonNullable<NonNullable<InterviewPlanOverrides['explore']>['topics']>[string];
    const nextTopicOverride: TopicOverrideEntry = {};
    if (typeof topicOverride.minTurns === 'number') nextTopicOverride.minTurns = Math.max(1, Math.floor(topicOverride.minTurns));
    if (typeof topicOverride.maxTurns === 'number') nextTopicOverride.maxTurns = Math.max(1, Math.floor(topicOverride.maxTurns));
    if (typeof topicOverride.importanceScore === 'number') nextTopicOverride.importanceScore = clamp(round2(topicOverride.importanceScore), 0, 1);
    if (topicOverride.importanceBand) nextTopicOverride.importanceBand = topicOverride.importanceBand;
    if (typeof topicOverride.rationale === 'string') nextTopicOverride.rationale = topicOverride.rationale.trim() || undefined;
    if (typeof topicOverride.enabled === 'boolean') nextTopicOverride.enabled = topicOverride.enabled;
    if (typeof topicOverride.targetTurns === 'number') nextTopicOverride.targetTurns = Math.max(0, Math.floor(topicOverride.targetTurns));
    if (typeof topicOverride.stretchTurns === 'number') nextTopicOverride.stretchTurns = Math.max(0, Math.floor(topicOverride.stretchTurns));
    if (typeof topicOverride.targetSubGoalCount === 'number') nextTopicOverride.targetSubGoalCount = Math.max(0, Math.floor(topicOverride.targetSubGoalCount));
    if (typeof topicOverride.stretchSubGoalCount === 'number') nextTopicOverride.stretchSubGoalCount = Math.max(0, Math.floor(topicOverride.stretchSubGoalCount));
    const subGoalOverrides: NonNullable<typeof nextTopicOverride.subGoals> = {};
    for (const [subGoalId, subGoalOverride] of Object.entries(topicOverride.subGoals || {})) {
      if (typeof subGoalOverride.importanceScore === 'number') {
        subGoalOverrides[subGoalId] = {
          ...(subGoalOverrides[subGoalId] || {}),
          importanceScore: clamp(round2(subGoalOverride.importanceScore), 0, 1),
        };
      }
      if (subGoalOverride.importanceBand) {
        subGoalOverrides[subGoalId] = {
          ...(subGoalOverrides[subGoalId] || {}),
          importanceBand: subGoalOverride.importanceBand,
        };
      }
      if (subGoalOverride.coverageTier) {
        subGoalOverrides[subGoalId] = {
          ...(subGoalOverrides[subGoalId] || {}),
          coverageTier: subGoalOverride.coverageTier,
        };
      }
      if (typeof subGoalOverride.rationale === 'string') {
        subGoalOverrides[subGoalId] = {
          ...(subGoalOverrides[subGoalId] || {}),
          rationale: subGoalOverride.rationale.trim() || undefined,
        };
      }
      if (typeof subGoalOverride.enabled === 'boolean') {
        subGoalOverrides[subGoalId] = {
          ...(subGoalOverrides[subGoalId] || {}),
          enabled: subGoalOverride.enabled,
        };
      }
    }
    if (Object.keys(subGoalOverrides).length > 0) {
      nextTopicOverride.subGoals = subGoalOverrides;
    }
    (sanitized.explore!.topics as NonNullable<NonNullable<InterviewPlanOverrides['explore']>['topics']>)[topicId] = nextTopicOverride;
  }

  if (typeof sanitized.deepen?.maxTurnsPerTopic === 'number') {
    sanitized.deepen.maxTurnsPerTopic = Math.max(1, Math.floor(sanitized.deepen.maxTurnsPerTopic));
  }
  if (typeof sanitized.deepen?.fallbackTurns === 'number') {
    sanitized.deepen.fallbackTurns = Math.max(1, Math.floor(sanitized.deepen.fallbackTurns));
  }

  return sanitized;
}

// ─── Override application ─────────────────────────────────────────────────────

function applyOverrideValues(base: InterviewPlan, safeOverrides?: InterviewPlanOverrides | null): ScoredTopic[] {
  return base.explore.topics.map((topic) => {
    const topicOverride = safeOverrides?.explore?.topics?.[topic.topicId];
    const importanceScore = typeof topicOverride?.importanceScore === 'number'
      ? clamp(round2(topicOverride.importanceScore), 0, 1)
      : topic.importanceScore;
    const importanceBand = topicOverride?.importanceBand || mapImportanceBand(importanceScore);

    return {
      topicId: topic.topicId,
      label: topic.label,
      orderIndex: topic.orderIndex,
      editorialOrderIndex: topic.editorialOrderIndex ?? topic.orderIndex,
      subGoals: topic.subGoals,
      subGoalPlans: topic.subGoalPlans.map((subGoal, index) => {
        const subGoalOverride = topicOverride?.subGoals?.[subGoal.id];
        const subGoalScore = typeof subGoalOverride?.importanceScore === 'number'
          ? clamp(round2(subGoalOverride.importanceScore), 0, 1)
          : subGoal.importanceScore;
        return {
          id: subGoal.id,
          label: subGoal.label,
          editorialOrderIndex: subGoal.editorialOrderIndex ?? index,
          importanceScore: subGoalScore,
          importanceBand: subGoalOverride?.importanceBand || mapImportanceBand(subGoalScore),
          rationale: subGoalOverride?.rationale || subGoal.rationale,
          enabled: typeof subGoalOverride?.enabled === 'boolean' ? subGoalOverride.enabled : subGoal.enabled,
        };
      }),
      importanceScore,
      importanceBand,
      rationale: topicOverride?.rationale || topic.rationale,
      configuredMaxTurns: Math.max(1, topicOverride?.maxTurns ?? topic.maxTurns),
      enabled: typeof topicOverride?.enabled === 'boolean' ? topicOverride.enabled : topic.enabled,
    };
  });
}

// ─── Public plan builders ─────────────────────────────────────────────────────

export function buildBaseInterviewPlan(bot: Bot, topics: TopicBlock[], budgetConfig?: Partial<PlanBudgetConfig>): InterviewPlan {
  const deterministicTopics = buildDeterministicScores(bot, topics);
  return applyComputation(deterministicTopics, bot, budgetConfig, {
    gradingSource: 'deterministic',
  });
}

async function buildStrategicInterviewPlan(bot: Bot, topics: TopicBlock[], budgetConfig?: Partial<PlanBudgetConfig>) {
  const deterministicTopics = buildDeterministicScores(bot, topics);
  const refined = await maybeRefineWithLlm(deterministicTopics, bot);
  return applyComputation(refined.topics, bot, budgetConfig, {
    gradingSource: refined.gradingSource,
  });
}

export function mergeInterviewPlan(
  base: InterviewPlan,
  overrides?: InterviewPlanOverrides | null,
  options?: { maxDurationMins?: number; budgetConfig?: Partial<PlanBudgetConfig> }
): InterviewPlan {
  const safeOverrides = sanitizeOverrides(base, overrides);
  const scoredTopics = applyOverrideValues(base, safeOverrides);
  const botLike = {
    maxDurationMins: options?.maxDurationMins ?? base.meta.maxDurationMins,
    researchGoal: '',
    targetAudience: '',
    introMessage: '',
    language: 'it',
    interviewerQuality: base.meta.interviewerQuality,
  } as Bot;

  return applyComputation(
    scoredTopics,
    botLike,
    options?.budgetConfig ?? {
      planBaseTurnsDivisor: base.meta.secondsPerTurn,
      deepenFallbackTurns: base.deepen.fallbackTurns,
      deepenMaxTurnsPerTopic: base.deepen.maxTurnsPerTopic,
      planBaseTurnsMin: DEFAULT_BUDGET_CONFIG.planBaseTurnsMin,
      planMaxTurnsBonus: DEFAULT_BUDGET_CONFIG.planMaxTurnsBonus,
    },
    {
      maxDurationMins: options?.maxDurationMins ?? base.meta.maxDurationMins,
      gradingSource: base.meta.gradingSource,
      objectiveSignature: base.meta.objectiveSignature,
    },
    safeOverrides
  );
}

// ─── Prisma-backed operations ─────────────────────────────────────────────────

export async function getOrCreateInterviewPlan(bot: Bot & { topics: TopicBlock[] }, budgetConfig?: Partial<PlanBudgetConfig>) {
  const topics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
  const resolvedBudgetConfig = resolveBudgetConfig(bot, budgetConfig);
  const deterministicPlan = buildBaseInterviewPlan(bot, topics, resolvedBudgetConfig);

  const existing = await prisma.interviewPlan.findUnique({
    where: { botId: bot.id },
  });

  if (!existing) {
    const basePlan = await buildStrategicInterviewPlan(bot, topics, resolvedBudgetConfig);
    await prisma.interviewPlan.create({
      data: {
        botId: bot.id,
        basePlan: basePlan as any,
        overrides: undefined,
        version: 1,
      },
    });
    return basePlan;
  }

  const existingBase = existing.basePlan as InterviewPlan;
  const overrides = existing.overrides as InterviewPlanOverrides | null;

  if (
    !existingBase?.meta?.topicsSignature ||
    existingBase.meta.topicsSignature !== deterministicPlan.meta.topicsSignature ||
    existingBase.meta.maxDurationMins !== deterministicPlan.meta.maxDurationMins ||
    existingBase.meta.budgetSignature !== deterministicPlan.meta.budgetSignature ||
    existingBase.meta.objectiveSignature !== deterministicPlan.meta.objectiveSignature ||
    existingBase.meta.planLogicVersion !== deterministicPlan.meta.planLogicVersion
  ) {
    const basePlan = await buildStrategicInterviewPlan(bot, topics, resolvedBudgetConfig);
    const merged = mergeInterviewPlan(basePlan, overrides, { budgetConfig: resolvedBudgetConfig });
    await prisma.interviewPlan.update({
      where: { botId: bot.id },
      data: {
        basePlan: basePlan as any,
        overrides: overrides as any,
        version: (existing.version || 1) + 1,
      },
    });
    return merged;
  }

  return mergeInterviewPlan(existingBase, overrides, { budgetConfig: resolvedBudgetConfig });
}

export async function regenerateInterviewPlan(botId: string, budgetConfig?: Partial<PlanBudgetConfig>) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!bot) throw new Error('Bot not found');

  const resolvedBudgetConfig = resolveBudgetConfig(bot, budgetConfig);
  const basePlan = await buildStrategicInterviewPlan(bot, bot.topics, resolvedBudgetConfig);
  const existing = await prisma.interviewPlan.findUnique({ where: { botId } });
  const overrides = existing?.overrides as InterviewPlanOverrides | null;
  const merged = mergeInterviewPlan(basePlan, overrides, { budgetConfig: resolvedBudgetConfig });

  await prisma.interviewPlan.upsert({
    where: { botId },
    update: {
      basePlan: basePlan as any,
      overrides: overrides as any,
      version: (existing?.version || 1) + 1,
    },
    create: {
      botId,
      basePlan: basePlan as any,
      overrides: overrides as any,
      version: 1,
    },
  });

  return merged;
}

export async function previewInterviewPlan(params: {
  botId: string;
  overrides?: InterviewPlanOverrides | null;
  maxDurationMins?: number;
  budgetConfig?: Partial<PlanBudgetConfig>;
}) {
  const bot = await prisma.bot.findUnique({
    where: { id: params.botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!bot) throw new Error('Bot not found');

  const resolvedBudgetConfig = resolveBudgetConfig(bot, params.budgetConfig);
  const existing = await prisma.interviewPlan.findUnique({ where: { botId: params.botId } });
  const basePlan = (existing?.basePlan as InterviewPlan | null) || buildBaseInterviewPlan(bot, bot.topics, resolvedBudgetConfig);
  const safeOverrides = sanitizeOverrides(basePlan, params.overrides || (existing?.overrides as InterviewPlanOverrides | null));

  return mergeInterviewPlan(basePlan, safeOverrides, {
    maxDurationMins: params.maxDurationMins,
    budgetConfig: resolvedBudgetConfig,
  });
}

export async function updateInterviewPlanOverrides(
  botId: string,
  overrides: InterviewPlanOverrides,
  options?: { maxDurationMins?: number; budgetConfig?: Partial<PlanBudgetConfig> }
) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!bot) throw new Error('Bot not found');

  const resolvedBudgetConfig = resolveBudgetConfig(bot, options?.budgetConfig);
  const existing = await prisma.interviewPlan.findUnique({ where: { botId } });
  const basePlan = (existing?.basePlan as InterviewPlan | null) || await buildStrategicInterviewPlan(bot, bot.topics, resolvedBudgetConfig);
  const nextOverrides = sanitizeOverrides(basePlan, overrides);
  const merged = mergeInterviewPlan(basePlan, nextOverrides, {
    maxDurationMins: options?.maxDurationMins,
    budgetConfig: resolvedBudgetConfig,
  });

  if (typeof options?.maxDurationMins === 'number' && options.maxDurationMins > 0 && options.maxDurationMins !== bot.maxDurationMins) {
    await prisma.bot.update({
      where: { id: botId },
      data: { maxDurationMins: Math.max(1, Math.floor(options.maxDurationMins)) },
    });
  }

  await prisma.interviewPlan.upsert({
    where: { botId },
    update: {
      basePlan: basePlan as any,
      overrides: nextOverrides as any,
      version: (existing?.version || 1) + 1,
    },
    create: {
      botId,
      basePlan: basePlan as any,
      overrides: nextOverrides as any,
      version: 1,
    },
  });

  return merged;
}

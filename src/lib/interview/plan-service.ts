import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import type { Bot, TopicBlock } from '@prisma/client';
import { z } from 'zod';
import { getTierConfig } from '@/config/interview-tiers';
import { getConfigValue } from '@/lib/config';
import { decryptIfNeeded } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';
import type {
  CoverageTier,
  ImportanceBand,
  InterviewPlan,
  InterviewPlanOverrides,
  PlanCoverageMetrics,
  PlanCoverageSummary,
  PlanSubGoal,
  PlanTopic,
} from './plan-types';

const PLAN_LOGIC_VERSION = '3.0';

export interface PlanBudgetConfig {
  planBaseTurnsDivisor: number;
  planBaseTurnsMin: number;
  planMaxTurnsBonus: number;
  deepenFallbackTurns: number;
  deepenMaxTurnsPerTopic: number;
}

const DEFAULT_BUDGET_CONFIG: PlanBudgetConfig = {
  planBaseTurnsDivisor: 45,
  planBaseTurnsMin: 2,
  planMaxTurnsBonus: 2,
  deepenFallbackTurns: 2,
  deepenMaxTurnsPerTopic: 2,
};

type InterviewTier = 'standard' | 'avanzato';

type ScoredSubGoal = {
  id: string;
  label: string;
  editorialOrderIndex: number;
  importanceScore: number;
  importanceBand: ImportanceBand;
  rationale: string;
  enabled: boolean;
};

type ScoredTopic = {
  topicId: string;
  label: string;
  orderIndex: number;
  editorialOrderIndex: number;
  subGoals: string[];
  subGoalPlans: ScoredSubGoal[];
  importanceScore: number;
  importanceBand: ImportanceBand;
  rationale: string;
  configuredMaxTurns: number;
  enabled: boolean;
};

type PlanComputationOptions = {
  maxDurationMins?: number;
  gradingSource?: InterviewPlan['meta']['gradingSource'];
  objectiveSignature?: string;
};

function resolveBudgetConfig(bot: Bot, budgetConfig?: Partial<PlanBudgetConfig>): Partial<PlanBudgetConfig> {
  if (budgetConfig) return budgetConfig;
  const interviewerQuality = getInterviewerQuality(bot);
  return getTierConfig(interviewerQuality).budgets;
}

function getInterviewerQuality(bot: Bot): InterviewTier {
  return ((bot as any).interviewerQuality === 'avanzato') ? 'avanzato' : 'standard';
}

function buildTopicsSignature(topics: TopicBlock[]) {
  return topics
    .map(t => `${t.id}:${t.orderIndex}:${t.maxTurns}:${t.label}:${(t.subGoals || []).join('|')}`)
    .join('||');
}

function buildObjectiveSignature(bot: Partial<Bot>) {
  return [
    String(bot.researchGoal || '').trim(),
    String(bot.targetAudience || '').trim(),
    String(bot.introMessage || '').trim(),
    String(bot.language || '').trim(),
  ].join('||');
}

function buildBudgetSignature(cfg: PlanBudgetConfig) {
  return [
    cfg.planBaseTurnsDivisor,
    cfg.planBaseTurnsMin,
    cfg.planMaxTurnsBonus,
    cfg.deepenFallbackTurns,
    cfg.deepenMaxTurnsPerTopic,
  ].join(':');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length >= 3)
  );
}

function lexicalOverlap(a: string, b: string) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;
  let matches = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) matches++;
  }
  return matches / Math.max(1, Math.min(tokensA.size, tokensB.size));
}

function textRichness(value: string, maxWords: number) {
  const words = normalizeText(value).split(' ').filter(Boolean).length;
  return clamp(words / maxWords, 0, 1);
}

function mapImportanceBand(score: number): ImportanceBand {
  if (score >= 0.82) return 'critical';
  if (score >= 0.64) return 'high';
  if (score >= 0.42) return 'medium';
  return 'low';
}

function buildSubGoalId(topicId: string, index: number) {
  return `${topicId}::${index}`;
}

function buildDeterministicTopicRationale(params: {
  objectiveOverlap: number;
  audienceOverlap: number;
  descriptionRichness: number;
  subGoalRichness: number;
  maxTurnsSignal: number;
}): string {
  if (params.objectiveOverlap >= 0.35) return 'goal_alignment';
  if (params.audienceOverlap >= 0.25) return 'audience_alignment';
  if (params.subGoalRichness >= 0.6) return 'subgoal_density';
  if (params.descriptionRichness >= 0.45) return 'topic_specificity';
  if (params.maxTurnsSignal >= 0.55) return 'configured_depth';
  return 'supporting_context';
}

function buildDeterministicSubGoalRationale(params: {
  objectiveOverlap: number;
  topicOverlap: number;
  richness: number;
}): string {
  if (params.objectiveOverlap >= 0.35) return 'goal_alignment';
  if (params.topicOverlap >= 0.35) return 'topic_alignment';
  if (params.richness >= 0.45) return 'specific_probe';
  return 'supporting_probe';
}

function buildDeterministicScores(bot: Bot, topics: TopicBlock[]): ScoredTopic[] {
  const objectiveText = [
    bot.researchGoal || '',
    bot.targetAudience || '',
    bot.introMessage || '',
  ].filter(Boolean).join(' ');

  const topicsCount = Math.max(1, topics.length);

  return topics.map((topic, index) => {
    const topicText = [
      topic.label || '',
      topic.description || '',
      ...(topic.subGoals || []),
    ].join(' ');

    const objectiveOverlap = lexicalOverlap(topicText, objectiveText);
    const audienceOverlap = lexicalOverlap(topicText, String(bot.targetAudience || ''));
    const descriptionRichness = textRichness(String(topic.description || ''), 24);
    const subGoalRichness = clamp((topic.subGoals || []).length / 5, 0, 1);
    const maxTurnsSignal = clamp((Number(topic.maxTurns || 0) || 1) / 6, 0, 1);
    const editorialSignal = clamp(1 - (index / Math.max(1, topicsCount - 1)) * 0.25, 0.75, 1);
    const importanceScore = round2(clamp(
      0.16 +
      objectiveOverlap * 0.34 +
      audienceOverlap * 0.12 +
      descriptionRichness * 0.12 +
      subGoalRichness * 0.16 +
      maxTurnsSignal * 0.1 +
      editorialSignal * 0.1,
      0.2,
      0.98
    ));

    const subGoalPlans: ScoredSubGoal[] = (topic.subGoals || []).map((subGoal, subIndex) => {
      const objectiveOverlapSubGoal = lexicalOverlap(subGoal, objectiveText);
      const topicOverlap = lexicalOverlap(subGoal, `${topic.label} ${topic.description || ''}`);
      const richness = textRichness(subGoal, 12);
      const editorialSubSignal = clamp(1 - (subIndex / Math.max(1, Math.max((topic.subGoals || []).length - 1, 1))) * 0.18, 0.82, 1);
      const importanceScoreSubGoal = round2(clamp(
        0.14 +
        objectiveOverlapSubGoal * 0.42 +
        topicOverlap * 0.24 +
        richness * 0.12 +
        editorialSubSignal * 0.08 +
        importanceScore * 0.18,
        0.16,
        0.99
      ));

      return {
        id: buildSubGoalId(topic.id, subIndex),
        label: subGoal,
        editorialOrderIndex: subIndex,
        importanceScore: importanceScoreSubGoal,
        importanceBand: mapImportanceBand(importanceScoreSubGoal),
        rationale: buildDeterministicSubGoalRationale({
          objectiveOverlap: objectiveOverlapSubGoal,
          topicOverlap,
          richness,
        }),
        enabled: true,
      };
    });

    return {
      topicId: topic.id,
      label: topic.label,
      orderIndex: topic.orderIndex,
      editorialOrderIndex: topic.orderIndex,
      subGoals: topic.subGoals || [],
      subGoalPlans,
      importanceScore,
      importanceBand: mapImportanceBand(importanceScore),
      rationale: buildDeterministicTopicRationale({
        objectiveOverlap,
        audienceOverlap,
        descriptionRichness,
        subGoalRichness,
        maxTurnsSignal,
      }),
      configuredMaxTurns: Math.max(1, Number(topic.maxTurns || 0) || 1),
      enabled: true,
    };
  });
}

const gradingSchema = z.object({
  topics: z.array(z.object({
    topicId: z.string(),
    importanceScore: z.number().min(0).max(100),
    rationale: z.string().optional(),
    subGoals: z.array(z.object({
      editorialOrderIndex: z.number().int().min(0),
      importanceScore: z.number().min(0).max(100),
      rationale: z.string().optional(),
    })).optional(),
  })),
});

async function resolvePlanGradingApiKey(bot: Bot): Promise<string | null> {
  const botKey = decryptIfNeeded(bot.openaiApiKey);
  if (botKey) return botKey;
  try {
    const globalKey = await getConfigValue('openaiApiKey');
    return decryptIfNeeded(globalKey);
  } catch {
    return null;
  }
}

async function maybeRefineWithLlm(baseTopics: ScoredTopic[], bot: Bot): Promise<{ topics: ScoredTopic[]; gradingSource: InterviewPlan['meta']['gradingSource'] }> {
  const apiKey = await resolvePlanGradingApiKey(bot);
  if (!apiKey) {
    return { topics: baseTopics, gradingSource: 'deterministic' };
  }

  const openai = createOpenAI({ apiKey });
  const topicPayload = baseTopics.map((topic) => ({
    topicId: topic.topicId,
    label: topic.label,
    description: topic.rationale,
    subGoals: topic.subGoalPlans.map((subGoal) => subGoal.label),
  }));

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: gradingSchema,
      prompt: [
        'You are grading an interview plan.',
        'Important: do NOT reorder topics. Editorial order stays fixed.',
        'Assess only relative importance for coverage and deepen decisions.',
        `Interview tier: ${getInterviewerQuality(bot)}`,
        `Interview goal: ${String(bot.researchGoal || '').trim() || 'n/a'}`,
        `Target audience: ${String(bot.targetAudience || '').trim() || 'n/a'}`,
        `Intro message: ${String(bot.introMessage || '').trim() || 'n/a'}`,
        '',
        `Topics: ${JSON.stringify(topicPayload)}`,
        '',
        'Return topic and sub-goal importance scores from 0 to 100.',
        'High scores mean strategically important to cover within limited time.',
        'Prefer interview-objective relevance, decision usefulness, and signal quality over verbosity.',
      ].join('\n'),
      temperature: 0.1,
    });

    const scoredById = new Map(result.object.topics.map((topic) => [topic.topicId, topic]));
    const refinedTopics = baseTopics.map((topic) => {
      const gradedTopic = scoredById.get(topic.topicId);
      if (!gradedTopic) return topic;
      const subGoalsByIndex = new Map((gradedTopic.subGoals || []).map((subGoal) => [subGoal.editorialOrderIndex, subGoal]));
      const importanceScore = round2(clamp((gradedTopic.importanceScore || topic.importanceScore * 100) / 100, 0.1, 0.99));

      return {
        ...topic,
        importanceScore,
        importanceBand: mapImportanceBand(importanceScore),
        rationale: gradedTopic.rationale?.trim() || 'llm_graded',
        subGoalPlans: topic.subGoalPlans.map((subGoal) => {
          const gradedSubGoal = subGoalsByIndex.get(subGoal.editorialOrderIndex);
          if (!gradedSubGoal) return subGoal;
          const subGoalScore = round2(clamp((gradedSubGoal.importanceScore || subGoal.importanceScore * 100) / 100, 0.1, 0.99));
          return {
            ...subGoal,
            importanceScore: subGoalScore,
            importanceBand: mapImportanceBand(subGoalScore),
            rationale: gradedSubGoal.rationale?.trim() || 'llm_graded',
          };
        }),
      };
    });

    return { topics: refinedTopics, gradingSource: 'llm' };
  } catch (error) {
    console.error('[plan-service] LLM grading failed, using deterministic fallback:', error);
    return { topics: baseTopics, gradingSource: 'llm_fallback' };
  }
}

function ensureMinTopicsCoverage(value: number, topicsCount: number) {
  return Math.max(value, Math.min(topicsCount, Math.max(1, topicsCount)));
}

function buildCoverageMetrics(params: {
  topics: PlanTopic[];
  includeStretch: boolean;
  includeOverflow: boolean;
}): PlanCoverageMetrics {
  const enabledTopics = params.topics.filter((topic) => topic.enabled !== false);
  const coveredTopics = enabledTopics.filter((topic) => {
    const enabledSubGoals = topic.subGoalPlans.filter((subGoal) => subGoal.enabled);
    if (enabledSubGoals.length === 0) {
      return params.includeOverflow || params.includeStretch || topic.targetTurns > 0;
    }

    return enabledSubGoals.some((subGoal) => {
      if (subGoal.coverageTier === 'target') return true;
      if (params.includeStretch && subGoal.coverageTier === 'stretch') return true;
      if (params.includeOverflow && subGoal.coverageTier === 'overflow') return true;
      return false;
    });
  }).length;

  const enabledSubGoals = enabledTopics.flatMap((topic) => topic.subGoalPlans.filter((subGoal) => subGoal.enabled));
  const coveredSubGoals = enabledSubGoals.filter((subGoal) => {
    if (subGoal.coverageTier === 'target') return true;
    if (params.includeStretch && subGoal.coverageTier === 'stretch') return true;
    if (params.includeOverflow && subGoal.coverageTier === 'overflow') return true;
    return false;
  }).length;

  const totalTopics = enabledTopics.length;
  const totalSubGoals = enabledSubGoals.length;
  const weightedCoverage = totalSubGoals > 0
    ? coveredSubGoals / totalSubGoals
    : totalTopics > 0 ? coveredTopics / totalTopics : 1;

  return {
    coveredTopics,
    coveredSubGoals,
    totalTopics,
    totalSubGoals,
    coverageRate: round2(clamp(weightedCoverage, 0, 1)),
  };
}

function buildLikelyExcludedWithoutDeepOffer(topics: PlanTopic[]) {
  return topics
    .flatMap((topic) =>
      topic.subGoalPlans
        .filter((subGoal) => subGoal.enabled && subGoal.coverageTier !== 'target')
        .map((subGoal) => ({
          topicId: topic.topicId,
          topicLabel: topic.label,
          subGoalId: subGoal.id,
          subGoalLabel: subGoal.label,
          importanceBand: subGoal.importanceBand,
          coverageTier: subGoal.coverageTier,
        }))
    )
    .sort((a, b) => {
      const bandOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      if (bandOrder[a.importanceBand] !== bandOrder[b.importanceBand]) {
        return bandOrder[a.importanceBand] - bandOrder[b.importanceBand];
      }
      return a.topicLabel.localeCompare(b.topicLabel);
    })
    .slice(0, 12);
}

function assignCoverageTiers(params: {
  subGoals: PlanSubGoal[];
  targetSubGoalCount: number;
  stretchSubGoalCount: number;
  lockedCoverage: Map<string, CoverageTier>;
}): PlanSubGoal[] {
  const locked = params.lockedCoverage;
  const enabledSubGoals = params.subGoals.filter((subGoal) => subGoal.enabled);
  const autoSubGoals = enabledSubGoals.filter((subGoal) => !locked.has(subGoal.id));
  const lockedTargetIds = new Set(
    [...locked.entries()].filter(([, tier]) => tier === 'target').map(([id]) => id)
  );
  const lockedStretchIds = new Set(
    [...locked.entries()].filter(([, tier]) => tier === 'stretch').map(([id]) => id)
  );
  const lockedOverflowIds = new Set(
    [...locked.entries()].filter(([, tier]) => tier === 'overflow').map(([id]) => id)
  );
  const targetSlots = Math.max(0, params.targetSubGoalCount - lockedTargetIds.size);
  const stretchSlots = Math.max(0, params.stretchSubGoalCount - Math.max(params.targetSubGoalCount, lockedTargetIds.size + lockedStretchIds.size));

  const rankedAuto = [...autoSubGoals].sort((a, b) =>
    (b.importanceScore - a.importanceScore) ||
    (a.editorialOrderIndex - b.editorialOrderIndex)
  );
  const targetIds = new Set(rankedAuto.slice(0, targetSlots).map((subGoal) => subGoal.id));
  const stretchIds = new Set(
    rankedAuto
      .filter((subGoal) => !targetIds.has(subGoal.id))
      .slice(0, stretchSlots)
      .map((subGoal) => subGoal.id)
  );

  return params.subGoals.map((subGoal) => {
    if (!subGoal.enabled) {
      return { ...subGoal, coverageTier: 'disabled' };
    }
    const lockedTier = locked.get(subGoal.id);
    if (lockedTier) {
      return { ...subGoal, coverageTier: lockedTier };
    }
    if (targetIds.has(subGoal.id)) {
      return { ...subGoal, coverageTier: 'target' };
    }
    if (stretchIds.has(subGoal.id)) {
      return { ...subGoal, coverageTier: 'stretch' };
    }
    if (lockedOverflowIds.has(subGoal.id)) {
      return { ...subGoal, coverageTier: 'overflow' };
    }
    return { ...subGoal, coverageTier: 'overflow' };
  });
}

function allocateTurns(params: {
  topics: ScoredTopic[];
  totalTurnsBudget: number;
  floorTurns: number;
  capsByTopic: Record<string, number>;
}): Record<string, number> {
  const enabledTopics = params.topics.filter((topic) => topic.enabled !== false);
  const allocation: Record<string, number> = {};
  if (enabledTopics.length === 0) return allocation;

  const initialBudget = Math.max(0, params.totalTurnsBudget);
  const initialTurns = Math.min(params.floorTurns, initialBudget);

  for (const topic of enabledTopics) {
    allocation[topic.topicId] = 0;
  }

  let remaining = initialBudget;
  for (const topic of enabledTopics) {
    if (remaining <= 0) break;
    allocation[topic.topicId] = initialTurns;
    remaining -= initialTurns;
  }

  if (remaining <= 0) {
    return allocation;
  }

  const ranked = [...enabledTopics].sort((a, b) =>
    (b.importanceScore - a.importanceScore) ||
    (a.editorialOrderIndex - b.editorialOrderIndex)
  );

  while (remaining > 0) {
    let allocatedInRound = false;
    for (const topic of ranked) {
      if (remaining <= 0) break;
      const cap = Math.max(1, params.capsByTopic[topic.topicId] || 1);
      const current = allocation[topic.topicId] || 0;
      if (current < cap) {
        allocation[topic.topicId] = current + 1;
        remaining -= 1;
        allocatedInRound = true;
      }
    }
    if (!allocatedInRound) break;
  }

  return allocation;
}

function buildCoverageSummary(params: {
  topics: PlanTopic[];
  targetDurationSec: number;
  stretchDurationSec: number;
  fullCoverageDurationSec: number;
}): PlanCoverageSummary {
  return {
    targetDurationSec: params.targetDurationSec,
    stretchDurationSec: params.stretchDurationSec,
    fullCoverageDurationSec: params.fullCoverageDurationSec,
    target: buildCoverageMetrics({
      topics: params.topics,
      includeStretch: false,
      includeOverflow: false,
    }),
    stretch: buildCoverageMetrics({
      topics: params.topics,
      includeStretch: true,
      includeOverflow: false,
    }),
    full: buildCoverageMetrics({
      topics: params.topics,
      includeStretch: true,
      includeOverflow: true,
    }),
    likelyExcludedWithoutDeepOffer: buildLikelyExcludedWithoutDeepOffer(params.topics),
  };
}

function applyComputation(
  sourceTopics: ScoredTopic[],
  bot: Bot,
  budgetConfig?: Partial<PlanBudgetConfig>,
  options?: PlanComputationOptions,
  overrides?: InterviewPlanOverrides | null
): InterviewPlan {
  const cfg = { ...DEFAULT_BUDGET_CONFIG, ...resolveBudgetConfig(bot, budgetConfig) };
  const interviewerQuality = getInterviewerQuality(bot);
  const targetDurationSec = (options?.maxDurationMins ?? bot.maxDurationMins ?? 10) * 60;
  const stretchMultiplier = interviewerQuality === 'avanzato' ? 1.3 : 1.2;
  const stretchDurationSec = Math.round(targetDurationSec * stretchMultiplier);
  const targetTurnsBudget = Math.max(1, Math.floor(targetDurationSec / cfg.planBaseTurnsDivisor));
  const stretchTurnsBudget = Math.max(targetTurnsBudget, Math.floor(stretchDurationSec / cfg.planBaseTurnsDivisor));

  const enabledTopics = sourceTopics.filter((topic) => topic.enabled !== false);
  const topicsCount = Math.max(1, enabledTopics.length);
  const perTopicTimeSec = targetDurationSec / topicsCount;

  const targetCapsByTopic = Object.fromEntries(enabledTopics.map((topic) => {
    const enabledSubGoals = topic.subGoalPlans.filter((subGoal) => subGoal.enabled).length;
    const suggestedCap = Math.max(1, Math.min(topic.configuredMaxTurns, Math.max(1, enabledSubGoals || 1)));
    return [topic.topicId, suggestedCap];
  }));
  const stretchCapsByTopic = Object.fromEntries(enabledTopics.map((topic) => {
    const enabledSubGoals = topic.subGoalPlans.filter((subGoal) => subGoal.enabled).length;
    const suggestedCap = Math.max(1, Math.min(topic.configuredMaxTurns, Math.max(1, enabledSubGoals || 1) + cfg.planMaxTurnsBonus));
    return [topic.topicId, suggestedCap];
  }));

  const targetTurnsAllocation = allocateTurns({
    topics: enabledTopics,
    totalTurnsBudget: targetTurnsBudget,
    floorTurns: 1,
    capsByTopic: targetCapsByTopic,
  });
  const stretchTurnsAllocation = allocateTurns({
    topics: enabledTopics,
    totalTurnsBudget: stretchTurnsBudget,
    floorTurns: 1,
    capsByTopic: stretchCapsByTopic,
  });

  const mergedTopics: PlanTopic[] = sourceTopics
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((topic) => {
      const topicOverride = overrides?.explore?.topics?.[topic.topicId];
      const lockedCoverage = new Map<string, CoverageTier>();
      for (const subGoal of topic.subGoalPlans) {
        const overrideTier = topicOverride?.subGoals?.[subGoal.id]?.coverageTier;
        if (overrideTier) {
          lockedCoverage.set(subGoal.id, overrideTier);
        }
      }

      const targetTurns = Math.max(
        1,
        topicOverride?.targetTurns ?? targetTurnsAllocation[topic.topicId] ?? 1
      );
      const stretchTurns = Math.max(
        targetTurns,
        topicOverride?.stretchTurns ?? stretchTurnsAllocation[topic.topicId] ?? targetTurns
      );
      const fullCoverageSubGoalCount = topic.subGoalPlans.filter((subGoal) => subGoal.enabled).length;
      const defaultTargetSubGoalCount = Math.min(fullCoverageSubGoalCount, Math.max(0, targetTurns));
      const defaultStretchSubGoalCount = Math.min(fullCoverageSubGoalCount, Math.max(defaultTargetSubGoalCount, stretchTurns));
      const targetSubGoalCount = clamp(
        topicOverride?.targetSubGoalCount ?? defaultTargetSubGoalCount,
        0,
        fullCoverageSubGoalCount
      );
      const stretchSubGoalCount = clamp(
        topicOverride?.stretchSubGoalCount ?? defaultStretchSubGoalCount,
        targetSubGoalCount,
        fullCoverageSubGoalCount
      );
      const subGoalPlans = assignCoverageTiers({
        subGoals: topic.subGoalPlans.map((subGoal) => ({
          ...subGoal,
          coverageTier: subGoal.enabled ? 'overflow' : 'disabled',
        })),
        targetSubGoalCount,
        stretchSubGoalCount,
        lockedCoverage,
      });
      const effectiveTargetCount = subGoalPlans.filter((subGoal) => subGoal.coverageTier === 'target').length;
      const effectiveStretchCount = subGoalPlans.filter((subGoal) =>
        subGoal.coverageTier === 'target' || subGoal.coverageTier === 'stretch'
      ).length;

      return {
        topicId: topic.topicId,
        label: topic.label,
        orderIndex: topic.orderIndex,
        editorialOrderIndex: topic.editorialOrderIndex,
        subGoals: topic.subGoals,
        subGoalPlans,
        baseTurns: Math.max(1, targetTurns),
        minTurns: 1,
        maxTurns: Math.max(Math.max(1, targetTurns), stretchTurns),
        importanceScore: topic.importanceScore,
        importanceBand: topic.importanceBand,
        rationale: topic.rationale,
        enabled: topic.enabled !== false,
        targetTurns,
        stretchTurns,
        fullCoverageTurns: Math.max(1, fullCoverageSubGoalCount || 1),
        targetSubGoalCount: effectiveTargetCount,
        stretchSubGoalCount: effectiveStretchCount,
        fullCoverageSubGoalCount,
        interpretationCues: [],
        significanceSignals: [],
        probeAngles: [],
      };
    });

  const fullCoverageDurationSec = mergedTopics.reduce((sum, topic) => sum + (topic.enabled ? topic.fullCoverageTurns : 0) * cfg.planBaseTurnsDivisor, 0);

  return {
    version: 1,
    meta: {
      generatedAt: new Date().toISOString(),
      planLogicVersion: PLAN_LOGIC_VERSION,
      budgetSignature: buildBudgetSignature(cfg),
      objectiveSignature: options?.objectiveSignature || buildObjectiveSignature(bot),
      maxDurationMins: Math.round(targetDurationSec / 60),
      totalTimeSec: targetDurationSec,
      perTopicTimeSec,
      secondsPerTurn: cfg.planBaseTurnsDivisor,
      topicsSignature: buildTopicsSignature(sourceTopics.map((topic) => ({
        id: topic.topicId,
        orderIndex: topic.orderIndex,
        label: topic.label,
        maxTurns: topic.configuredMaxTurns,
        subGoals: topic.subGoals,
      })) as any),
      interviewerQuality,
      gradingSource: options?.gradingSource || 'deterministic',
    },
    coverage: buildCoverageSummary({
      topics: mergedTopics,
      targetDurationSec,
      stretchDurationSec,
      fullCoverageDurationSec,
    }),
    explore: {
      topics: mergedTopics,
    },
    deepen: {
      maxTurnsPerTopic: cfg.deepenMaxTurnsPerTopic,
      fallbackTurns: cfg.deepenFallbackTurns,
    },
  };
}

export function buildBaseInterviewPlan(bot: Bot, topics: TopicBlock[], budgetConfig?: Partial<PlanBudgetConfig>): InterviewPlan {
  const deterministicTopics = buildDeterministicScores(bot, topics);
  return applyComputation(deterministicTopics, bot, budgetConfig, {
    gradingSource: 'deterministic',
  });
}

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

async function buildStrategicInterviewPlan(bot: Bot, topics: TopicBlock[], budgetConfig?: Partial<PlanBudgetConfig>) {
  const deterministicTopics = buildDeterministicScores(bot, topics);
  const refined = await maybeRefineWithLlm(deterministicTopics, bot);
  return applyComputation(refined.topics, bot, budgetConfig, {
    gradingSource: refined.gradingSource,
  });
}

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

import type { Bot } from '@prisma/client';

export const PLAN_LOGIC_VERSION = '3.0';

import type {
  CoverageTier,
  InterviewPlan,
  InterviewPlanOverrides,
  PlanCoverageMetrics,
  PlanCoverageSummary,
  PlanSubGoal,
  PlanTopic,
} from './plan-types';
import {
  clamp,
  round2,
  mapImportanceBand,
  buildBudgetSignature,
  buildObjectiveSignature,
  buildTopicsSignature,
  getInterviewerQuality,
  resolveBudgetConfig,
  DEFAULT_BUDGET_CONFIG,
  type PlanBudgetConfig,
  type PlanComputationOptions,
  type ScoredTopic,
} from './plan-grading';

// ─── Coverage metrics ────────────────────────────────────────────────────────

function ensureMinTopicsCoverage(value: number, topicsCount: number) {
  return Math.max(value, Math.min(topicsCount, Math.max(1, topicsCount)));
}

export function buildCoverageMetrics(params: {
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

export function buildLikelyExcludedWithoutDeepOffer(topics: PlanTopic[]) {
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

// ─── Coverage tier assignment ─────────────────────────────────────────────────

export function assignCoverageTiers(params: {
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

// ─── Turn allocation ──────────────────────────────────────────────────────────

export function allocateTurns(params: {
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

// ─── Coverage summary ─────────────────────────────────────────────────────────

export function buildCoverageSummary(params: {
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

// ─── Plan computation ─────────────────────────────────────────────────────────

export function applyComputation(
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

  const fullCoverageDurationSec = mergedTopics.reduce(
    (sum, topic) => sum + (topic.enabled ? topic.fullCoverageTurns : 0) * cfg.planBaseTurnsDivisor,
    0
  );

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

// suppress unused import warning for ensureMinTopicsCoverage
void ensureMinTopicsCoverage;

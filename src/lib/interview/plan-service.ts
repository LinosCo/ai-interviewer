import { prisma } from '@/lib/prisma';
import type { Bot, TopicBlock } from '@prisma/client';
import type { InterviewPlan, InterviewPlanOverrides, PlanTopic } from './plan-types';
import { getTierConfig } from '@/config/interview-tiers';

const PLAN_LOGIC_VERSION = '2.1';

export interface PlanBudgetConfig {
  planBaseTurnsDivisor: number;   // seconds per turn (default 45)
  planBaseTurnsMin: number;       // min baseTurns per topic (default 2)
  planMaxTurnsBonus: number;      // added to baseTurns for maxTurns (default 2)
  deepenFallbackTurns: number;    // fallback turns for deepen (default 2)
  deepenMaxTurnsPerTopic: number; // max turns per topic in deepen (default 2)
}

const DEFAULT_BUDGET_CONFIG: PlanBudgetConfig = {
  planBaseTurnsDivisor: 45,
  planBaseTurnsMin: 2,
  planMaxTurnsBonus: 2,
  deepenFallbackTurns: 2,
  deepenMaxTurnsPerTopic: 2,
};

function resolveBudgetConfig(bot: Bot, budgetConfig?: Partial<PlanBudgetConfig>): Partial<PlanBudgetConfig> {
  if (budgetConfig) return budgetConfig;
  const interviewerQuality = ((bot as any).interviewerQuality === 'avanzato') ? 'avanzato' : 'standard';
  return getTierConfig(interviewerQuality).budgets;
}

function buildTopicsSignature(topics: TopicBlock[]) {
  return topics
    .map(t => `${t.id}:${t.orderIndex}:${t.maxTurns}:${t.label}:${(t.subGoals || []).join('|')}`)
    .join('||');
}

export function buildBaseInterviewPlan(bot: Bot, topics: TopicBlock[], budgetConfig?: Partial<PlanBudgetConfig>): InterviewPlan {
  const cfg = { ...DEFAULT_BUDGET_CONFIG, ...resolveBudgetConfig(bot, budgetConfig) };
  const totalTimeSec = (bot.maxDurationMins || 10) * 60;
  const perTopicTimeSec = totalTimeSec / Math.max(1, topics.length);
  const timeBasedMax = Math.max(1, Math.floor(perTopicTimeSec / cfg.planBaseTurnsDivisor));

  const explorTopics: PlanTopic[] = topics.map(t => {
    const topicMaxTurns = Number(t.maxTurns || timeBasedMax);
    const minTurns = 1;
    const baseTurns = Math.max(cfg.planBaseTurnsMin, Math.floor(perTopicTimeSec / cfg.planBaseTurnsDivisor));
    const maxTurns = baseTurns + cfg.planMaxTurnsBonus;

    return {
      topicId: t.id,
      label: t.label,
      orderIndex: t.orderIndex,
      subGoals: t.subGoals || [],
      baseTurns,
      minTurns,
      maxTurns,
      interpretationCues: [],
      significanceSignals: [],
      probeAngles: []
    };
  });

  return {
    version: 1,
    meta: {
      generatedAt: new Date().toISOString(),
      planLogicVersion: PLAN_LOGIC_VERSION,
      maxDurationMins: bot.maxDurationMins || 10,
      totalTimeSec,
      perTopicTimeSec,
      secondsPerTurn: cfg.planBaseTurnsDivisor,
      topicsSignature: buildTopicsSignature(topics)
    },
    explore: {
      topics: explorTopics
    },
    deepen: {
      maxTurnsPerTopic: cfg.deepenMaxTurnsPerTopic,
      fallbackTurns: cfg.deepenFallbackTurns
    }
  };
}

export function sanitizeOverrides(base: InterviewPlan, overrides?: InterviewPlanOverrides | null): InterviewPlanOverrides {
  if (!overrides) return {};
  const exploreTopicIds = new Set(base.explore.topics.map(t => t.topicId));

  const sanitized: InterviewPlanOverrides = {
    explore: {
      topics: {}
    },
    deepen: {
      maxTurnsPerTopic: overrides.deepen?.maxTurnsPerTopic,
      fallbackTurns: overrides.deepen?.fallbackTurns
    }
  };

  if (overrides.explore?.topics) {
    for (const [topicId, topicOverride] of Object.entries(overrides.explore.topics)) {
      if (exploreTopicIds.has(topicId)) {
        const minTurns = typeof topicOverride.minTurns === 'number'
          ? Math.max(1, Math.floor(topicOverride.minTurns))
          : undefined;
        const maxTurns = typeof topicOverride.maxTurns === 'number'
          ? Math.max(1, Math.floor(topicOverride.maxTurns))
          : undefined;
        (sanitized.explore as any).topics[topicId] = {
          ...(minTurns ? { minTurns } : {}),
          ...(maxTurns ? { maxTurns } : {})
        };
      }
    }
  }

  if (typeof sanitized.deepen?.maxTurnsPerTopic === 'number') {
    sanitized.deepen.maxTurnsPerTopic = Math.max(1, Math.floor(sanitized.deepen.maxTurnsPerTopic));
  }
  if (typeof sanitized.deepen?.fallbackTurns === 'number') {
    sanitized.deepen.fallbackTurns = Math.max(1, Math.floor(sanitized.deepen.fallbackTurns));
  }

  return sanitized;
}

export function mergeInterviewPlan(base: InterviewPlan, overrides?: InterviewPlanOverrides | null): InterviewPlan {
  const merged: InterviewPlan = JSON.parse(JSON.stringify(base));
  const safeOverrides = sanitizeOverrides(base, overrides);

  if (safeOverrides.explore?.topics) {
    merged.explore.topics = merged.explore.topics.map(t => {
      const override = safeOverrides.explore?.topics?.[t.topicId];
      if (!override) return t;
      const minTurns = override.minTurns ?? t.minTurns;
      const maxTurns = override.maxTurns ?? t.maxTurns;
      return {
        ...t,
        minTurns: Math.max(1, minTurns),
        maxTurns: Math.max(Math.max(1, minTurns), maxTurns)
      };
    });
  }

  if (safeOverrides.deepen) {
    if (typeof safeOverrides.deepen.maxTurnsPerTopic === 'number') {
      merged.deepen.maxTurnsPerTopic = safeOverrides.deepen.maxTurnsPerTopic;
    }
    if (typeof safeOverrides.deepen.fallbackTurns === 'number') {
      merged.deepen.fallbackTurns = safeOverrides.deepen.fallbackTurns;
    }
  }

  return merged;
}

export async function getOrCreateInterviewPlan(bot: Bot & { topics: TopicBlock[] }, budgetConfig?: Partial<PlanBudgetConfig>) {
  const topics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
  const resolvedBudgetConfig = resolveBudgetConfig(bot, budgetConfig);
  const basePlan = buildBaseInterviewPlan(bot, topics, resolvedBudgetConfig);

  const existing = await prisma.interviewPlan.findUnique({
    where: { botId: bot.id }
  });

  if (!existing) {
    await prisma.interviewPlan.create({
      data: {
        botId: bot.id,
        basePlan: basePlan as any,
        overrides: undefined,
        version: 1
      }
    });
    return basePlan;
  }

  const existingBase = existing.basePlan as InterviewPlan;
  const overrides = existing.overrides as InterviewPlanOverrides | null;

  if (
    !existingBase?.meta?.topicsSignature ||
    existingBase.meta.topicsSignature !== basePlan.meta.topicsSignature ||
    existingBase.meta.maxDurationMins !== basePlan.meta.maxDurationMins ||
    existingBase.meta.planLogicVersion !== basePlan.meta.planLogicVersion
  ) {
    const merged = mergeInterviewPlan(basePlan, overrides);
    await prisma.interviewPlan.update({
      where: { botId: bot.id },
      data: {
        basePlan: basePlan as any,
        overrides: overrides as any,
        version: (existing.version || 1) + 1
      }
    });
    return merged;
  }

  return mergeInterviewPlan(existingBase, overrides);
}

export async function regenerateInterviewPlan(botId: string, budgetConfig?: Partial<PlanBudgetConfig>) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } }
  });
  if (!bot) throw new Error('Bot not found');

  const resolvedBudgetConfig = resolveBudgetConfig(bot, budgetConfig);
  const basePlan = buildBaseInterviewPlan(bot, bot.topics, resolvedBudgetConfig);
  const existing = await prisma.interviewPlan.findUnique({ where: { botId } });
  const overrides = existing?.overrides as InterviewPlanOverrides | null;

  const merged = mergeInterviewPlan(basePlan, overrides);

  await prisma.interviewPlan.upsert({
    where: { botId },
    update: {
      basePlan: basePlan as any,
      overrides: overrides as any,
      version: (existing?.version || 1) + 1
    },
    create: {
      botId,
      basePlan: basePlan as any,
      overrides: overrides as any,
      version: 1
    }
  });

  return merged;
}

export async function updateInterviewPlanOverrides(botId: string, overrides: InterviewPlanOverrides) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } }
  });
  if (!bot) throw new Error('Bot not found');

  const basePlan = buildBaseInterviewPlan(bot, bot.topics);
  const existing = await prisma.interviewPlan.findUnique({ where: { botId } });
  const nextOverrides: InterviewPlanOverrides = {
    explore: {
      topics: overrides.explore?.topics || {}
    },
    deepen: {
      maxTurnsPerTopic: overrides.deepen?.maxTurnsPerTopic,
      fallbackTurns: overrides.deepen?.fallbackTurns
    }
  };

  const merged = mergeInterviewPlan(basePlan, nextOverrides);

  await prisma.interviewPlan.upsert({
    where: { botId },
    update: {
      basePlan: basePlan as any,
      overrides: nextOverrides as any,
      version: (existing?.version || 1) + 1
    },
    create: {
      botId,
      basePlan: basePlan as any,
      overrides: nextOverrides as any,
      version: 1
    }
  });

  return merged;
}

import { prisma } from '@/lib/prisma';
import type { Bot, TopicBlock } from '@prisma/client';
import type { InterviewPlan, InterviewPlanOverrides, PlanTopic } from './plan-types';

const SECONDS_PER_TURN = 45;

function buildTopicsSignature(topics: TopicBlock[]) {
  return topics
    .map(t => `${t.id}:${t.orderIndex}:${t.maxTurns}:${t.label}:${(t.subGoals || []).join('|')}`)
    .join('||');
}

export function buildBaseInterviewPlan(bot: Bot, topics: TopicBlock[]): InterviewPlan {
  const totalTimeSec = (bot.maxDurationMins || 10) * 60;
  const perTopicTimeSec = totalTimeSec / Math.max(1, topics.length);
  const timeBasedMax = Math.max(1, Math.floor(perTopicTimeSec / SECONDS_PER_TURN));

  const scanTopics: PlanTopic[] = topics.map(t => {
    const topicMaxTurns = Number(t.maxTurns || timeBasedMax);
    const minTurns = 1;
    const computedMax = perTopicTimeSec < 60
      ? 1
      : Math.max(1, Math.min(topicMaxTurns, timeBasedMax));
    const maxTurns = Math.max(minTurns, computedMax);

    return {
      topicId: t.id,
      label: t.label,
      orderIndex: t.orderIndex,
      subGoals: t.subGoals || [],
      minTurns,
      maxTurns
    };
  });

  return {
    version: 1,
    meta: {
      generatedAt: new Date().toISOString(),
      maxDurationMins: bot.maxDurationMins || 10,
      totalTimeSec,
      perTopicTimeSec,
      secondsPerTurn: SECONDS_PER_TURN,
      topicsSignature: buildTopicsSignature(topics)
    },
    scan: {
      topics: scanTopics
    },
    deep: {
      strategy: 'uncovered_subgoals_first',
      maxTurnsPerTopic: 2,
      fallbackTurns: 2,
      topics: scanTopics.map(t => ({
        ...t,
        maxTurns: 2
      }))
    }
  };
}

export function sanitizeOverrides(base: InterviewPlan, overrides?: InterviewPlanOverrides | null): InterviewPlanOverrides {
  if (!overrides) return {};
  const scanTopicIds = new Set(base.scan.topics.map(t => t.topicId));
  const deepTopicIds = new Set(base.deep.topics.map(t => t.topicId));

  const sanitized: InterviewPlanOverrides = {
    scan: {
      topics: {}
    },
    deep: {
      maxTurnsPerTopic: overrides.deep?.maxTurnsPerTopic,
      fallbackTurns: overrides.deep?.fallbackTurns,
      topics: {}
    }
  };

  if (overrides.scan?.topics) {
    for (const [topicId, topicOverride] of Object.entries(overrides.scan.topics)) {
      if (scanTopicIds.has(topicId)) {
        const minTurns = typeof topicOverride.minTurns === 'number'
          ? Math.max(1, Math.floor(topicOverride.minTurns))
          : undefined;
        const maxTurns = typeof topicOverride.maxTurns === 'number'
          ? Math.max(1, Math.floor(topicOverride.maxTurns))
          : undefined;
        (sanitized.scan as any).topics[topicId] = {
          ...(minTurns ? { minTurns } : {}),
          ...(maxTurns ? { maxTurns } : {})
        };
      }
    }
  }

  if (overrides.deep?.topics) {
    for (const [topicId, topicOverride] of Object.entries(overrides.deep.topics)) {
      if (deepTopicIds.has(topicId)) {
        const maxTurns = typeof topicOverride.maxTurns === 'number'
          ? Math.max(1, Math.floor(topicOverride.maxTurns))
          : undefined;
        (sanitized.deep as any).topics[topicId] = {
          ...(maxTurns ? { maxTurns } : {})
        };
      }
    }
  }

  if (typeof sanitized.deep?.maxTurnsPerTopic === 'number') {
    sanitized.deep.maxTurnsPerTopic = Math.max(1, Math.floor(sanitized.deep.maxTurnsPerTopic));
  }
  if (typeof sanitized.deep?.fallbackTurns === 'number') {
    sanitized.deep.fallbackTurns = Math.max(1, Math.floor(sanitized.deep.fallbackTurns));
  }

  return sanitized;
}

export function mergeInterviewPlan(base: InterviewPlan, overrides?: InterviewPlanOverrides | null): InterviewPlan {
  const merged: InterviewPlan = JSON.parse(JSON.stringify(base));
  const safeOverrides = sanitizeOverrides(base, overrides);

  if (safeOverrides.scan?.topics) {
    merged.scan.topics = merged.scan.topics.map(t => {
      const override = safeOverrides.scan?.topics?.[t.topicId];
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

  if (safeOverrides.deep) {
    if (typeof safeOverrides.deep.maxTurnsPerTopic === 'number') {
      merged.deep.maxTurnsPerTopic = safeOverrides.deep.maxTurnsPerTopic;
    }
    if (typeof safeOverrides.deep.fallbackTurns === 'number') {
      merged.deep.fallbackTurns = safeOverrides.deep.fallbackTurns;
    }

    if (safeOverrides.deep.topics) {
      merged.deep.topics = merged.deep.topics.map(t => {
        const override = safeOverrides.deep?.topics?.[t.topicId];
        if (!override) return t;
        return {
          ...t,
          maxTurns: Math.max(1, override.maxTurns ?? t.maxTurns)
        };
      });
    }
  }

  return merged;
}

export async function getOrCreateInterviewPlan(bot: Bot & { topics: TopicBlock[] }) {
  const topics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
  const basePlan = buildBaseInterviewPlan(bot, topics);

  const existing = await prisma.interviewPlan.findUnique({
    where: { botId: bot.id }
  });

  if (!existing) {
    await prisma.interviewPlan.create({
      data: {
        botId: bot.id,
        basePlan: basePlan as any,
        overrides: null,
        version: 1
      }
    });
    return basePlan;
  }

  const existingBase = existing.basePlan as InterviewPlan;
  const overrides = existing.overrides as InterviewPlanOverrides | null;

  if (!existingBase?.meta?.topicsSignature || existingBase.meta.topicsSignature !== basePlan.meta.topicsSignature || existingBase.meta.maxDurationMins !== basePlan.meta.maxDurationMins) {
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

export async function regenerateInterviewPlan(botId: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } } }
  });
  if (!bot) throw new Error('Bot not found');

  const basePlan = buildBaseInterviewPlan(bot, bot.topics);
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
    scan: {
      topics: overrides.scan?.topics || {}
    },
    deep: {
      maxTurnsPerTopic: overrides.deep?.maxTurnsPerTopic,
      fallbackTurns: overrides.deep?.fallbackTurns,
      topics: overrides.deep?.topics || {}
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

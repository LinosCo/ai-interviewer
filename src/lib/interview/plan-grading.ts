import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import type { Bot, TopicBlock } from '@prisma/client';
import { z } from 'zod';
import { getTierConfig } from '@/config/interview-tiers';
import { getConfigValue } from '@/lib/config';
import { decryptIfNeeded } from '@/lib/encryption';
import type { ImportanceBand, InterviewPlan } from './plan-types';

export interface PlanBudgetConfig {
  planBaseTurnsDivisor: number;
  planBaseTurnsMin: number;
  planMaxTurnsBonus: number;
  deepenFallbackTurns: number;
  deepenMaxTurnsPerTopic: number;
}

export const DEFAULT_BUDGET_CONFIG: PlanBudgetConfig = {
  planBaseTurnsDivisor: 45,
  planBaseTurnsMin: 2,
  planMaxTurnsBonus: 2,
  deepenFallbackTurns: 2,
  deepenMaxTurnsPerTopic: 2,
};

export type InterviewTier = 'standard' | 'avanzato';

export type ScoredSubGoal = {
  id: string;
  label: string;
  editorialOrderIndex: number;
  importanceScore: number;
  importanceBand: ImportanceBand;
  rationale: string;
  enabled: boolean;
};

export type ScoredTopic = {
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

export type PlanComputationOptions = {
  maxDurationMins?: number;
  gradingSource?: InterviewPlan['meta']['gradingSource'];
  objectiveSignature?: string;
};

// ─── Utility helpers ────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function mapImportanceBand(score: number): ImportanceBand {
  if (score >= 0.82) return 'critical';
  if (score >= 0.64) return 'high';
  if (score >= 0.42) return 'medium';
  return 'low';
}

export function buildSubGoalId(topicId: string, index: number) {
  return `${topicId}::${index}`;
}

export function buildTopicsSignature(topics: TopicBlock[]) {
  return topics
    .map(t => `${t.id}:${t.orderIndex}:${t.maxTurns}:${t.label}:${(t.subGoals || []).join('|')}`)
    .join('||');
}

export function buildObjectiveSignature(bot: Partial<Bot>) {
  return [
    String(bot.researchGoal || '').trim(),
    String(bot.targetAudience || '').trim(),
    String(bot.introMessage || '').trim(),
    String(bot.language || '').trim(),
  ].join('||');
}

export function buildBudgetSignature(cfg: PlanBudgetConfig) {
  return [
    cfg.planBaseTurnsDivisor,
    cfg.planBaseTurnsMin,
    cfg.planMaxTurnsBonus,
    cfg.deepenFallbackTurns,
    cfg.deepenMaxTurnsPerTopic,
  ].join(':');
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

// ─── Tier / budget helpers ───────────────────────────────────────────────────

export function getInterviewerQuality(bot: Bot): InterviewTier {
  return ((bot as any).interviewerQuality === 'avanzato') ? 'avanzato' : 'standard';
}

export function resolveBudgetConfig(bot: Bot, budgetConfig?: Partial<PlanBudgetConfig>): Partial<PlanBudgetConfig> {
  if (budgetConfig) return budgetConfig;
  const interviewerQuality = getInterviewerQuality(bot);
  return getTierConfig(interviewerQuality).budgets;
}

// ─── Deterministic scoring ───────────────────────────────────────────────────

export function buildDeterministicScores(bot: Bot, topics: TopicBlock[]): ScoredTopic[] {
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

// ─── LLM refinement ──────────────────────────────────────────────────────────

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

export async function maybeRefineWithLlm(
  baseTopics: ScoredTopic[],
  bot: Bot
): Promise<{ topics: ScoredTopic[]; gradingSource: InterviewPlan['meta']['gradingSource'] }> {
  const apiKey = await resolvePlanGradingApiKey(bot);
  if (!apiKey) {
    return { topics: baseTopics, gradingSource: 'deterministic' };
  }

  const openai = createOpenAI({ apiKey });
  const topicPayload = baseTopics.map((topic) => ({
    topicId: topic.topicId,
    label: topic.label,
    description: topic.rationale,
    subGoals: (topic.subGoalPlans ?? []).map((subGoal) => subGoal.label),
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
        subGoalPlans: (topic.subGoalPlans ?? []).map((subGoal) => {
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
    console.error('[plan-grading] LLM grading failed, using deterministic fallback:', error);
    return { topics: baseTopics, gradingSource: 'llm_fallback' };
  }
}

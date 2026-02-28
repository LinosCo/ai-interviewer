// src/lib/training/training-supervisor.ts
import type {
  TrainingSupervisorState,
  TrainingPhaseType,
  TopicResult,
  DetectedCompetenceLevel,
} from './training-types'

interface BotConfig {
  passScoreThreshold: number
  maxRetries: number
  failureMode: 'STRICT' | 'PERMISSIVE'
}

interface TopicConfig {
  id: string
  label: string
  learningObjectives: string[]
  passScoreOverride?: number | null
  maxRetriesOverride?: number | null
}

export function buildInitialState(): TrainingSupervisorState {
  return {
    currentTopicIndex: 0,
    phase: 'EXPLAINING',
    retryCount: 0,
    detectedCompetenceLevel: 'INTERMEDIATE',
    adaptationDepth: 0,
    topicResults: [],
    pendingQuizzes: undefined,
    pendingCheckQuestion: undefined,
    pendingRetryGaps: undefined,
  }
}

export function getNextPhase(current: TrainingPhaseType): TrainingPhaseType {
  const flow: Record<string, TrainingPhaseType> = {
    EXPLAINING: 'CHECKING',
    CHECKING: 'QUIZZING',
    QUIZZING: 'EVALUATING',
    RETRYING: 'CHECKING',
  }
  return flow[current] ?? 'EXPLAINING'
}

export function shouldRetry(bot: BotConfig, retryCount: number): boolean {
  if (bot.failureMode === 'STRICT') return false
  return retryCount < bot.maxRetries
}

export function getPassThreshold(bot: BotConfig, topic: TopicConfig): number {
  return topic.passScoreOverride ?? bot.passScoreThreshold
}

export function getMaxRetries(bot: BotConfig, topic: TopicConfig): number {
  return topic.maxRetriesOverride ?? bot.maxRetries
}

/**
 * Advance state after EVALUATING phase result.
 * Returns updated state and whether to move to next topic.
 */
export function advanceAfterEvaluation(
  state: TrainingSupervisorState,
  result: TopicResult,
  bot: BotConfig,
  topic: TopicConfig,
  totalTopics: number
): { newState: TrainingSupervisorState; moveToNextTopic: boolean } {
  const threshold = getPassThreshold(bot, topic)
  const maxRetriesForTopic = getMaxRetries(bot, topic)

  if (result.score >= threshold) {
    // Passed — commit result and advance
    const withResult = { ...state, topicResults: [...state.topicResults, result] }
    const nextIndex = state.currentTopicIndex + 1
    if (nextIndex >= totalTopics) {
      return { newState: { ...withResult, phase: 'COMPLETE' }, moveToNextTopic: false }
    }
    return {
      newState: {
        ...withResult,
        currentTopicIndex: nextIndex,
        phase: 'EXPLAINING',
        retryCount: 0,
        adaptationDepth: 0,
        pendingQuizzes: undefined,
        pendingCheckQuestion: undefined,
        pendingRetryGaps: undefined,
      },
      moveToNextTopic: true,
    }
  }

  // Failed
  const canRetry = bot.failureMode === 'PERMISSIVE' && state.retryCount < maxRetriesForTopic

  if (canRetry) {
    // Don't commit failed result yet — retry with deeper adaptation
    return {
      newState: {
        ...state,
        phase: 'RETRYING',
        retryCount: state.retryCount + 1,
        adaptationDepth: Math.min(state.adaptationDepth + 1, 2),
        pendingRetryGaps: result.gaps,
        pendingQuizzes: undefined,
        pendingCheckQuestion: undefined,
      },
      moveToNextTopic: false,
    }
  }

  // No more retries — commit failed result and advance
  const withResult = { ...state, topicResults: [...state.topicResults, result] }
  const nextIndex = state.currentTopicIndex + 1
  if (nextIndex >= totalTopics) {
    return { newState: { ...withResult, phase: 'COMPLETE' }, moveToNextTopic: false }
  }
  return {
    newState: {
      ...withResult,
      currentTopicIndex: nextIndex,
      phase: 'EXPLAINING',
      retryCount: 0,
      adaptationDepth: 0,
      pendingQuizzes: undefined,
      pendingCheckQuestion: undefined,
    },
    moveToNextTopic: true,
  }
}

export function computeOverallScore(topicResults: TopicResult[]): number {
  if (topicResults.length === 0) return 0
  const sum = topicResults.reduce((acc, r) => acc + r.score, 0)
  return Math.round(sum / topicResults.length)
}

export function computeSessionPassed(
  topicResults: TopicResult[],
  threshold: number
): boolean {
  return computeOverallScore(topicResults) >= threshold
}

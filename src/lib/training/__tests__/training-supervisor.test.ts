// src/lib/training/__tests__/training-supervisor.test.ts
import { getNextPhase, shouldRetry, buildInitialState, advanceAfterEvaluation, computeOverallScore, computeSessionPassed } from '../training-supervisor'
import type { TrainingSupervisorState, TopicResult } from '../training-types'

const mockTopic = {
  id: 't1',
  label: 'Topic 1',
  learningObjectives: ['obj1'],
  passScoreOverride: null as number | null,
  maxRetriesOverride: null as number | null,
}
const mockBot = {
  passScoreThreshold: 70,
  maxRetries: 2,
  failureMode: 'PERMISSIVE' as const,
}

describe('buildInitialState', () => {
  it('starts at index 0, EXPLAINING phase, depth 0', () => {
    const state = buildInitialState()
    expect(state.currentTopicIndex).toBe(0)
    expect(state.phase).toBe('EXPLAINING')
    expect(state.adaptationDepth).toBe(0)
    expect(state.retryCount).toBe(0)
    expect(state.topicResults).toEqual([])
  })
})

describe('shouldRetry', () => {
  it('allows retry in PERMISSIVE mode under maxRetries', () => {
    expect(shouldRetry(mockBot, 1)).toBe(true)
    expect(shouldRetry(mockBot, 2)).toBe(false) // at max
  })

  it('never retries in STRICT mode', () => {
    expect(shouldRetry({ ...mockBot, failureMode: 'STRICT' }, 0)).toBe(false)
  })
})

describe('getNextPhase', () => {
  it('advances EXPLAINING → CHECKING', () => {
    expect(getNextPhase('EXPLAINING')).toBe('CHECKING')
  })
  it('advances CHECKING → QUIZZING', () => {
    expect(getNextPhase('CHECKING')).toBe('QUIZZING')
  })
  it('advances QUIZZING → EVALUATING', () => {
    expect(getNextPhase('QUIZZING')).toBe('EVALUATING')
  })
  it('advances RETRYING → CHECKING', () => {
    expect(getNextPhase('RETRYING')).toBe('CHECKING')
  })
})

describe('advanceAfterEvaluation', () => {
  const baseState: TrainingSupervisorState = {
    currentTopicIndex: 0,
    phase: 'EVALUATING',
    retryCount: 0,
    detectedCompetenceLevel: 'INTERMEDIATE',
    adaptationDepth: 0,
    topicResults: [],
  }

  const passedResult: TopicResult = {
    topicId: 't1',
    topicLabel: 'Topic 1',
    status: 'PASSED',
    score: 80,
    openAnswerScore: 80,
    quizScore: 80,
    retries: 0,
    gaps: [],
    feedback: 'Good',
  }

  const failedResult: TopicResult = {
    topicId: 't1',
    topicLabel: 'Topic 1',
    status: 'FAILED',
    score: 40,
    openAnswerScore: 40,
    quizScore: 40,
    retries: 0,
    gaps: ['gap1'],
    feedback: 'Needs work',
  }

  it('moves to next topic when passed and more topics remain', () => {
    const { newState, moveToNextTopic } = advanceAfterEvaluation(baseState, passedResult, mockBot, mockTopic, 3)
    expect(newState.currentTopicIndex).toBe(1)
    expect(newState.phase).toBe('EXPLAINING')
    expect(moveToNextTopic).toBe(true)
    expect(newState.retryCount).toBe(0)
  })

  it('sets phase to COMPLETE when passed on last topic', () => {
    const { newState, moveToNextTopic } = advanceAfterEvaluation(baseState, passedResult, mockBot, mockTopic, 1)
    expect(newState.phase).toBe('COMPLETE')
    expect(moveToNextTopic).toBe(false)
  })

  it('sets phase to RETRYING when failed in PERMISSIVE mode with retries remaining', () => {
    const { newState, moveToNextTopic } = advanceAfterEvaluation(baseState, failedResult, mockBot, mockTopic, 3)
    expect(newState.phase).toBe('RETRYING')
    expect(newState.retryCount).toBe(1)
    expect(newState.adaptationDepth).toBe(1)
    expect(moveToNextTopic).toBe(false)
  })

  it('advances to next topic when failed with no retries left in PERMISSIVE mode', () => {
    const stateAtMaxRetry = { ...baseState, retryCount: 2 }
    const { newState, moveToNextTopic } = advanceAfterEvaluation(stateAtMaxRetry, failedResult, mockBot, mockTopic, 3)
    expect(newState.currentTopicIndex).toBe(1)
    expect(newState.phase).toBe('EXPLAINING')
    expect(moveToNextTopic).toBe(true)
  })

  it('advances immediately to next topic when failed in STRICT mode', () => {
    const strictBot = { ...mockBot, failureMode: 'STRICT' as const }
    const { newState, moveToNextTopic } = advanceAfterEvaluation(baseState, failedResult, strictBot, mockTopic, 3)
    expect(newState.currentTopicIndex).toBe(1)
    expect(newState.phase).toBe('EXPLAINING')
    expect(moveToNextTopic).toBe(true)
  })
})

describe('computeOverallScore', () => {
  it('averages topic scores', () => {
    const results: TopicResult[] = [
      { topicId: '1', topicLabel: 'A', status: 'PASSED', score: 80, openAnswerScore: 80, quizScore: 80, retries: 0, gaps: [], feedback: '' },
      { topicId: '2', topicLabel: 'B', status: 'FAILED', score: 60, openAnswerScore: 60, quizScore: 60, retries: 0, gaps: [], feedback: '' },
    ]
    expect(computeOverallScore(results)).toBe(70)
  })

  it('returns 0 for empty results', () => {
    expect(computeOverallScore([])).toBe(0)
  })
})

describe('computeSessionPassed', () => {
  const results: TopicResult[] = [
    { topicId: '1', topicLabel: 'A', status: 'PASSED', score: 80, openAnswerScore: 80, quizScore: 80, retries: 0, gaps: [], feedback: '' },
    { topicId: '2', topicLabel: 'B', status: 'PASSED', score: 70, openAnswerScore: 70, quizScore: 70, retries: 0, gaps: [], feedback: '' },
  ]

  it('returns true when overall score meets threshold', () => {
    // average of 80+70 = 75, threshold 70 → pass
    expect(computeSessionPassed(results, 70)).toBe(true)
  })

  it('returns false when overall score is below threshold', () => {
    // average of 80+70 = 75, threshold 80 → fail
    expect(computeSessionPassed(results, 80)).toBe(false)
  })
})

// src/lib/training/__tests__/training-types.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type {
  TrainingPhaseType,
  QuizQuestion,
  ComprehensionEntry,
  DialogueTopicResult,
  TrainingSupervisorState,
} from '../training-types'

describe('TrainingPhaseType', () => {
  it('includes DIALOGUING and FINAL_QUIZZING', () => {
    const phase: TrainingPhaseType = 'DIALOGUING'
    expectTypeOf(phase).toMatchTypeOf<TrainingPhaseType>()
    const phase2: TrainingPhaseType = 'FINAL_QUIZZING'
    expectTypeOf(phase2).toMatchTypeOf<TrainingPhaseType>()
  })
})

describe('QuizQuestion', () => {
  it('accepts OPEN_ANSWER type with expectedKeyPoints', () => {
    const q: QuizQuestion = {
      id: '1',
      type: 'OPEN_ANSWER',
      question: 'Explain X',
      expectedKeyPoints: ['point A', 'point B'],
    }
    expectTypeOf(q).toMatchTypeOf<QuizQuestion>()
  })

  it('accepts MULTIPLE_CHOICE with options and correctIndex', () => {
    const q: QuizQuestion = {
      id: '2',
      type: 'MULTIPLE_CHOICE',
      question: 'What is X?',
      options: ['A', 'B', 'C'],
      correctIndex: 1,
    }
    expectTypeOf(q).toMatchTypeOf<QuizQuestion>()
  })
})

describe('TrainingSupervisorState', () => {
  it('has dialogueTurns and comprehensionHistory fields', () => {
    const state: TrainingSupervisorState = {
      currentTopicIndex: 0,
      phase: 'DIALOGUING',
      retryCount: 0,
      detectedCompetenceLevel: 'INTERMEDIATE',
      adaptationDepth: 0,
      topicResults: [],
      dialogueTurns: 2,
      comprehensionHistory: [],
      dialogueTopicResults: [],
    }
    expectTypeOf(state.dialogueTurns).toBeNumber()
    expectTypeOf(state.comprehensionHistory).toBeArray()
  })
})

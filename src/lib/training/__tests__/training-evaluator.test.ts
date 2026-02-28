// src/lib/training/__tests__/training-evaluator.test.ts
import { describe, it, expect } from 'vitest'
import { computeTopicScore, evaluateQuizAnswers } from '../training-evaluator'
import type { QuizQuestion } from '../training-types'

describe('computeTopicScore', () => {
  it('weights open answer at 40% and quiz at 60%', () => {
    expect(computeTopicScore(100, 100)).toBe(100)
    expect(computeTopicScore(0, 100)).toBe(60)
    expect(computeTopicScore(100, 0)).toBe(40)
    expect(computeTopicScore(50, 50)).toBe(50)
  })
})

describe('evaluateQuizAnswers', () => {
  const questions: QuizQuestion[] = [
    { id: '1', type: 'TRUE_FALSE', question: 'Q1', options: ['Vero', 'Falso'], correctIndex: 0 },
    { id: '2', type: 'MULTIPLE_CHOICE', question: 'Q2', options: ['A', 'B', 'C'], correctIndex: 1 },
    { id: '3', type: 'TRUE_FALSE', question: 'Q3', options: ['Vero', 'Falso'], correctIndex: 1 },
  ]

  it('returns 100 when all answers correct', () => {
    const result = evaluateQuizAnswers(questions, [0, 1, 1])
    expect(result.score).toBe(100)
    expect(result.wrongAnswers).toHaveLength(0)
  })

  it('returns 0 when all answers wrong', () => {
    const result = evaluateQuizAnswers(questions, [1, 0, 0])
    expect(result.score).toBe(0)
    expect(result.wrongAnswers).toHaveLength(3)
  })

  it('returns partial score for mixed answers', () => {
    const result = evaluateQuizAnswers(questions, [0, 0, 1]) // 2/3 correct
    expect(result.score).toBe(67)
    expect(result.wrongAnswers).toHaveLength(1)
  })

  it('returns 100 for empty questions array', () => {
    const result = evaluateQuizAnswers([], [])
    expect(result.score).toBe(100)
    expect(result.wrongAnswers).toHaveLength(0)
  })
})

// src/lib/training/__tests__/training-prompts.test.ts
import { describe, it, expect } from 'vitest'
import { buildDialoguePrompt, buildFinalQuizSystemPrompt } from '../training-prompts'
import type { ComprehensionEntry, DialogueTopicResult } from '../training-types'

const baseCtx = {
  topicLabel: 'Gestione del Conflitto',
  learningObjectives: ['Identificare le cause del conflitto', 'Applicare tecniche di mediazione'],
  educationLevel: 'PROFESSIONAL',
  competenceLevel: 'BEGINNER',
  adaptationDepth: 0,
  language: 'it',
  dialogueTurns: 1,
  minCheckingTurns: 2,
  maxCheckingTurns: 5,
}

describe('buildDialoguePrompt', () => {
  it('includes topic label and turn counter', () => {
    const prompt = buildDialoguePrompt(baseCtx, [], [])
    expect(prompt).toContain('Gestione del Conflitto')
    expect(prompt).toContain('1')   // dialogueTurns
    expect(prompt).toContain('5')   // maxCheckingTurns
  })

  it('includes comprehension history when provided', () => {
    const entry: ComprehensionEntry = {
      topicIndex: 0,
      turn: 1,
      comprehensionLevel: 45,
      engagementLevel: 'low',
      gaps: ['tecnica di mediazione'],
      understoodConcepts: [],
      suggestedApproach: 'simpler',
    }
    const prompt = buildDialoguePrompt(baseCtx, [], [entry])
    expect(prompt).toContain('45')
    expect(prompt).toContain('simpler')
  })

  it('includes KB content when provided', () => {
    const ctx = { ...baseCtx, kbContent: 'Guida interna alla mediazione' }
    const prompt = buildDialoguePrompt(ctx, [], [])
    expect(prompt).toContain('Guida interna alla mediazione')
  })

  it('falls back to general knowledge when no KB', () => {
    const prompt = buildDialoguePrompt(baseCtx, [], [])
    expect(prompt).toContain('conoscenza generale')
  })
})

describe('buildFinalQuizSystemPrompt', () => {
  it('includes topic labels and comprehension levels', () => {
    const results: DialogueTopicResult[] = [
      { topicId: '1', topicLabel: 'Conflitto', finalComprehension: 45, gaps: ['mediazione'], understoodConcepts: [], turnsUsed: 4 },
      { topicId: '2', topicLabel: 'Leadership', finalComprehension: 85, gaps: [], understoodConcepts: ['stili'], turnsUsed: 3 },
    ]
    const prompt = buildFinalQuizSystemPrompt(['Conflitto', 'Leadership'], results, 'it')
    expect(prompt).toContain('Conflitto')
    expect(prompt).toContain('45')
    expect(prompt).toContain('OPEN_ANSWER')
    expect(prompt).toContain('TRUE_FALSE')
  })
})

import { describe, it, expect } from 'vitest'
import { computeCILBonusCap, applyCILBudgetSignal } from '../../explore-deepen-machine'
import type { InterviewState } from '@/app/api/chat/route'

const makeState = (overrides: Partial<InterviewState> = {}): InterviewState => ({
    phase: 'EXPLORE',
    topicIndex: 0,
    turnInTopic: 2,
    deepAccepted: null,
    consentGiven: null,
    lastAskedField: null,
    dataCollectionAttempts: 0,
    fieldAttemptCounts: {},
    closureAttempts: 0,
    topicBudgets: {
        't1': { baseTurns: 4, minTurns: 2, maxTurns: 6, turnsUsed: 2, bonusTurnsGranted: 0 },
        't2': { baseTurns: 4, minTurns: 2, maxTurns: 6, turnsUsed: 0, bonusTurnsGranted: 0 },
        't3': { baseTurns: 4, minTurns: 2, maxTurns: 6, turnsUsed: 0, bonusTurnsGranted: 0 },
    },
    turnsUsedTotal: 2,
    turnsBudgetTotal: 18,
    uncoveredTopics: ['t2', 't3'],
    topicEngagementScores: {},
    topicKeyInsights: {},
    lastSignalScore: 0,
    runtimeInterviewKnowledge: null,
    runtimeInterviewKnowledgeSignature: null,
    ...overrides
})

describe('computeCILBonusCap', () => {
    it('returns 1 when many topics remain and little budget', () => {
        const state = makeState({ turnsUsedTotal: 16, turnsBudgetTotal: 18, uncoveredTopics: ['t2', 't3', 't4', 't5'] })
        expect(computeCILBonusCap(state, null)).toBe(1)
    })

    it('returns up to 4 when few topics remain and plenty of budget', () => {
        const state = makeState({ turnsUsedTotal: 4, turnsBudgetTotal: 30, uncoveredTopics: [] })
        const cap = computeCILBonusCap(state, null)
        expect(cap).toBeGreaterThanOrEqual(2)
        expect(cap).toBeLessThanOrEqual(4)
    })

    it('uses manual override when provided', () => {
        const state = makeState()
        expect(computeCILBonusCap(state, 3)).toBe(3)
    })
})

describe('applyCILBudgetSignal', () => {
    it('extends maxTurns by 1 when signal says extend and cap not reached', () => {
        const state = makeState()
        const signal = { extend: true, topicId: 't1', reason: 'high thread detected' }
        const result = applyCILBudgetSignal(state, signal, 2)
        expect(result.topicBudgets['t1'].maxTurns).toBe(7)
        expect(result.topicBudgets['t1'].cilBonusApplied).toBe(1)
    })

    it('does not extend when cap already reached', () => {
        const state = makeState({
            topicBudgets: {
                't1': { baseTurns: 4, minTurns: 2, maxTurns: 6, turnsUsed: 2, bonusTurnsGranted: 0, cilBonusApplied: 2 }
            }
        })
        const signal = { extend: true, topicId: 't1', reason: 'thread' }
        const result = applyCILBudgetSignal(state, signal, 2)
        expect(result.topicBudgets['t1'].maxTurns).toBe(6)  // unchanged
    })

    it('does not extend when extend is false', () => {
        const state = makeState()
        const signal = { extend: false, topicId: 't1', reason: '' }
        const result = applyCILBudgetSignal(state, signal, 2)
        expect(result.topicBudgets['t1'].maxTurns).toBe(6)  // unchanged
    })

    it('returns state unchanged when topicId not found', () => {
        const state = makeState()
        const signal = { extend: true, topicId: 'nonexistent', reason: 'x' }
        const result = applyCILBudgetSignal(state, signal, 2)
        expect(result).toEqual(state)
    })
})

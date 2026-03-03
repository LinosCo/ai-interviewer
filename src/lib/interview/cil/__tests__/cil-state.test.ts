import { describe, it, expect } from 'vitest'
import { mergeCILState, EMPTY_CIL_STATE } from '../cil-state'
import type { CILAnalysis, CILState } from '../types'

const makeAnalysis = (overrides: Partial<CILAnalysis> = {}): CILAnalysis => ({
    openThreads: [],
    emergingThemes: [],
    lastResponseAnalysis: { keySignals: [], emotionalCues: [], interruptedThoughts: [], activeHypotheses: [], contradictionFlags: [] },
    suggestedMove: 'probe_deeper',
    budgetSignal: null,
    ...overrides
})

describe('mergeCILState', () => {
    it('adds new threads from analysis', () => {
        const result = mergeCILState(EMPTY_CIL_STATE, makeAnalysis({
            openThreads: [{ description: 'used obbligato twice', sourceTopicId: 't1', strength: 'high', turnIndex: 3 }]
        }), 3)
        expect(result.openThreads).toHaveLength(1)
        expect(result.openThreads[0].description).toBe('used obbligato twice')
    })

    it('deduplicates threads with same description', () => {
        const existing: CILState = {
            ...EMPTY_CIL_STATE,
            openThreads: [{ description: 'used obbligato twice', sourceTopicId: 't1', strength: 'high', turnIndex: 3 }]
        }
        const result = mergeCILState(existing, makeAnalysis({
            openThreads: [{ description: 'used obbligato twice', sourceTopicId: 't1', strength: 'high', turnIndex: 5 }]
        }), 5)
        expect(result.openThreads).toHaveLength(1)
    })

    it('caps openThreads at 6', () => {
        const threads = Array.from({ length: 5 }, (_, i) => ({
            description: `thread ${i}`, sourceTopicId: 't1', strength: 'medium' as const, turnIndex: i
        }))
        const existing: CILState = { ...EMPTY_CIL_STATE, openThreads: threads }
        const result = mergeCILState(existing, makeAnalysis({
            openThreads: [
                { description: 'thread 5', sourceTopicId: 't1', strength: 'high', turnIndex: 6 },
                { description: 'thread 6', sourceTopicId: 't1', strength: 'medium', turnIndex: 6 },
            ]
        }), 6)
        expect(result.openThreads.length).toBeLessThanOrEqual(6)
    })

    it('accumulates emergingThemes, deduped, max 5', () => {
        const existing: CILState = { ...EMPTY_CIL_STATE, emergingThemes: ['theme A', 'theme B'] }
        const result = mergeCILState(existing, makeAnalysis({ emergingThemes: ['theme B', 'theme C'] }), 4)
        expect(result.emergingThemes).toEqual(['theme A', 'theme B', 'theme C'])
    })

    it('replaces lastResponseAnalysis with latest', () => {
        const analysis = makeAnalysis({
            lastResponseAnalysis: { keySignals: ['new signal'], emotionalCues: [], interruptedThoughts: [], activeHypotheses: [], contradictionFlags: [] }
        })
        const result = mergeCILState(EMPTY_CIL_STATE, analysis, 7)
        expect(result.lastResponseAnalysis?.keySignals).toEqual(['new signal'])
    })
})

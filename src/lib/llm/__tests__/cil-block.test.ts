import { describe, it, expect } from 'vitest'
import { buildCILContextBlock } from '../prompt-builder'
import type { CILAnalysis } from '@/lib/interview/cil/types'

const baseAnalysis: CILAnalysis = {
    openThreads: [
        { description: 'used obbligato twice', sourceTopicId: 't1', strength: 'high', turnIndex: 3 }
    ],
    emergingThemes: ['autonomia vs controllo'],
    lastResponseAnalysis: {
        keySignals: ['obbligato', 'risorse'],
        emotionalCues: ['ha minimizzato'],
        interruptedThoughts: ['ha iniziato a parlare di X'],
        activeHypotheses: ['tensione autonomia'],
        contradictionFlags: []
    },
    suggestedMove: 'probe_deeper',
    budgetSignal: null
}

describe('buildCILContextBlock', () => {
    it('returns empty string for non-avanzato tiers', () => {
        expect(buildCILContextBlock(baseAnalysis, null, 'quantitativo')).toBe('')
        expect(buildCILContextBlock(baseAnalysis, null, 'intermedio')).toBe('')
    })

    it('returns block for avanzato with open threads', () => {
        const block = buildCILContextBlock(baseAnalysis, null, 'avanzato')
        expect(block).toContain('CONVERSATIONAL INTELLIGENCE')
        expect(block).toContain('obbligato twice')
        expect(block).toContain('autonomia vs controllo')
    })

    it('treats CIL as historical memory and prioritizes the latest user message', () => {
        const block = buildCILContextBlock(baseAnalysis, { openThreads: [], emergingThemes: [], lastResponseAnalysis: null, lastUpdatedTurnIndex: 12 }, 'avanzato', {
            latestUserMessage: 'In realta il problema non e il controllo, ma la mancanza di tempo operativo.',
            freshness: 'stale'
        })
        expect(block).toContain('Treat this CIL block as historical memory')
        expect(block).toContain('prioritize that angle and follow up on it')
        expect(block).toContain('follow the supervisor/micro-planner progression')
        expect(block).toContain('Latest participant message to evaluate now')
        expect(block).toContain('mancanza di tempo operativo')
        expect(block).toContain('last merged turn: 12')
    })

    it('returns empty string when analysis has no material to show', () => {
        const empty: CILAnalysis = {
            ...baseAnalysis,
            openThreads: [],
            emergingThemes: [],
            lastResponseAnalysis: { keySignals: [], emotionalCues: [], interruptedThoughts: [], activeHypotheses: [], contradictionFlags: [] }
        }
        expect(buildCILContextBlock(empty, null, 'avanzato')).toBe('')
    })

    it('includes anchoredHypothesis in the thread output when present', () => {
        const withHypothesis: CILAnalysis = {
            ...baseAnalysis,
            openThreads: [
                { description: 'used obbligato twice', sourceTopicId: 't1', strength: 'high', turnIndex: 3, anchoredHypothesis: 'autonomia vs controllo' }
            ]
        }
        const block = buildCILContextBlock(withHypothesis, null, 'avanzato')
        expect(block).toContain('→ autonomia vs controllo')
    })
})

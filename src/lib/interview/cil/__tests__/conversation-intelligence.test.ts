// src/lib/interview/cil/__tests__/conversation-intelligence.test.ts
import { describe, it, expect } from 'vitest'
import { generateCILAnalysis } from '../conversation-intelligence'

describe('generateCILAnalysis', () => {
    it('returns empty analysis when recentTurns is empty', async () => {
        const result = await generateCILAnalysis({
            recentTurns: [],
            currentTopicId: 't1',
            cilState: { openThreads: [], emergingThemes: [], lastResponseAnalysis: null, lastUpdatedTurnIndex: 0 },
            topicKnowledge: null,
            model: {} as any,
            language: 'it'
        })
        expect(result.budgetSignal).toBeNull()
        expect(result.openThreads).toEqual([])
    })
})

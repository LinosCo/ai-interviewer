// src/lib/interview/cil/types.ts

export interface CILThread {
    description: string
    sourceTopicId: string
    strength: 'high' | 'medium'
    turnIndex: number
    anchoredHypothesis?: string
}

export interface CILLastResponseAnalysis {
    keySignals: string[]
    emotionalCues: string[]
    interruptedThoughts: string[]
    activeHypotheses: string[]
    contradictionFlags: string[]
}

export interface CILAnalysis {
    openThreads: CILThread[]
    emergingThemes: string[]
    lastResponseAnalysis: CILLastResponseAnalysis
    suggestedMove: 'probe_deeper' | 'follow_thread' | 'bridge' | 'synthesize'
    budgetSignal: {
        extend: boolean
        topicId: string
        reason: string
    } | null
}

export interface CILState {
    openThreads: CILThread[]       // merged across turns, max 6
    emergingThemes: string[]       // accumulated, max 5
    lastResponseAnalysis: CILLastResponseAnalysis | null
    lastUpdatedTurnIndex: number
}

export const EMPTY_CIL_STATE: CILState = {
    openThreads: [],
    emergingThemes: [],
    lastResponseAnalysis: null,
    lastUpdatedTurnIndex: 0
}

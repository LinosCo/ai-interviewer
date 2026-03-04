# Avanzato CIL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Conversation Intelligence Layer (CIL) to the Avanzato interview tier that enables genuine qualitative conversation — following unexpected threads, testing hypotheses, and bridging naturally from candidate responses.

**Architecture:** A lightweight gpt-4.1-mini pre-pass runs in parallel with the supervisor, anchored to an enhanced per-tier RuntimeKnowledge, and produces a `CILAnalysis` injected as prompt Block 6.5. When a high-strength thread is detected, the supervisor extends the current topic's turn budget (budget stealing) using a dynamic cap based on remaining topics and time.

**Tech Stack:** TypeScript, Vitest, Zod, Vercel AI SDK (`generateObject`), Prisma, Next.js App Router

**Design doc:** `docs/plans/2026-03-03-avanzato-qualitative-interview-design.md`

---

## Key Files Reference

| File | Role |
|------|------|
| `src/lib/interview/runtime-knowledge.ts` | RuntimeKnowledge generation + cache |
| `src/lib/chat/context-helpers.ts` | `TopicBudget` type |
| `src/app/api/chat/route.ts` | `InterviewState`, main chat handler |
| `src/lib/interview/explore-deepen-machine.ts` | Phase supervisor, budget logic |
| `src/lib/llm/prompt-builder.ts` | 7-block prompt builder |
| `prisma/schema.prisma` | Bot model |

---

## Task 1: Extend `TopicBudget` and Prisma `Bot` model

### Files
- Modify: `src/lib/chat/context-helpers.ts` (TopicBudget interface)
- Modify: `prisma/schema.prisma` (Bot model)

### Step 1: Add `cilBonusApplied` to TopicBudget

In `src/lib/chat/context-helpers.ts`, update the `TopicBudget` interface:

```typescript
export interface TopicBudget {
    baseTurns: number;
    minTurns: number;
    maxTurns: number;
    turnsUsed: number;
    bonusTurnsGranted: number;
    cilBonusApplied?: number;   // NEW: tracks how many CIL bonus turns used on this topic
}
```

### Step 2: Add `cilBonusTurnCapOverride` to Prisma Bot model

In `prisma/schema.prisma`, add to the `Bot` model (after `interviewerQuality`):

```prisma
cilBonusTurnCapOverride Int?    // null = dynamic formula; set to override CIL budget stealing cap
```

### Step 3: Create migration

```bash
npx prisma migrate dev --name add_cil_bonus_turn_cap_override
```

Expected: migration file created, schema pushed to DB.

### Step 4: Commit

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/chat/context-helpers.ts
git commit -m "feat(cil): add cilBonusTurnCapOverride to Bot and cilBonusApplied to TopicBudget"
```

---

## Task 2: RuntimeKnowledge — add tier to cache signature

The current signature ignores `interviewerQuality`, so all tiers share the same generated knowledge.

### Files
- Modify: `src/lib/interview/runtime-knowledge.ts`
- Test: `src/lib/interview/__tests__/runtime-knowledge.test.ts` (already exists)

### Step 1: Write failing test

In `src/lib/interview/__tests__/runtime-knowledge.test.ts`, add to the existing test suite:

```typescript
it('produces different signatures for different quality tiers', () => {
    const base = {
        language: 'it',
        researchGoal: 'understand decision-making',
        targetAudience: 'product managers',
        plan: {
            meta: { topicsSignature: 'abc123', maxDurationMins: 30 }
        } as any
    }
    const sigQuantitativo = buildRuntimeInterviewKnowledgeSignature({ ...base, interviewerQuality: 'quantitativo' })
    const sigAvanzato = buildRuntimeInterviewKnowledgeSignature({ ...base, interviewerQuality: 'avanzato' })
    expect(sigQuantitativo).not.toBe(sigAvanzato)
})
```

### Step 2: Run test to confirm it fails

```bash
npx vitest run src/lib/interview/__tests__/runtime-knowledge.test.ts -t "different signatures"
```

Expected: FAIL — signatures are currently identical.

### Step 3: Update `buildRuntimeInterviewKnowledgeSignature`

In `src/lib/interview/runtime-knowledge.ts`, find `buildRuntimeInterviewKnowledgeSignature` and update its params + basis:

```typescript
export function buildRuntimeInterviewKnowledgeSignature(params: {
    language: string;
    researchGoal?: string | null;
    targetAudience?: string | null;
    plan: InterviewPlan;
    interviewerQuality?: string | null;   // NEW
}): string {
    const basis = [
        params.language || 'en',
        params.researchGoal || '',
        params.targetAudience || '',
        params.plan?.meta?.topicsSignature || '',
        params.plan?.meta?.maxDurationMins || '',
        params.interviewerQuality || 'quantitativo'   // NEW
    ].join('|');
    return `rk-v1-${hashString(basis)}`;
}
```

### Step 4: Run test to confirm it passes

```bash
npx vitest run src/lib/interview/__tests__/runtime-knowledge.test.ts -t "different signatures"
```

Expected: PASS.

### Step 5: Update the call site in `chat/route.ts`

Find `buildRuntimeInterviewKnowledgeSignature(` in `src/app/api/chat/route.ts` and add the tier:

```typescript
const runtimeKnowledgeSignature = buildRuntimeInterviewKnowledgeSignature({
    language: bot.language || 'it',
    researchGoal: bot.researchGoal,
    targetAudience: bot.targetAudience,
    plan,
    interviewerQuality: (bot as any).interviewerQuality || 'quantitativo'   // NEW
});
```

### Step 6: Commit

```bash
git add src/lib/interview/runtime-knowledge.ts src/lib/interview/__tests__/runtime-knowledge.test.ts src/app/api/chat/route.ts
git commit -m "feat(cil): add interviewerQuality to RuntimeKnowledge cache signature"
```

---

## Task 3: RuntimeKnowledge — extend schema for Avanzato

For `interviewerQuality === 'avanzato'`, generate 4 additional fields per topic: `hypotheses`, `narrativeThreads`, `contradictionFlags`, `emotionalSignals`.

### Files
- Modify: `src/lib/interview/runtime-knowledge.ts`

### Step 1: Extend `RuntimeTopicKnowledge` type

```typescript
export interface RuntimeTopicKnowledge {
    topicId: string;
    topicLabel: string;
    // Existing — all tiers
    interpretationCues: string[];
    significanceSignals: string[];
    probeAngles: string[];
    // New — avanzato only (optional so existing code doesn't break)
    hypotheses?: string[];         // Testable patterns: "Potrebbe esserci tensione tra X e Y"
    narrativeThreads?: string[];   // Typical story arcs for this topic/audience
    contradictionFlags?: string[]; // "Se afferma X ma anche Y → approfondire"
    emotionalSignals?: string[];   // Engagement vs defence cues
}
```

### Step 2: Add Zod schema for avanzato fields

Inside `generateRuntimeInterviewKnowledge`, find the existing Zod schema for topics and create a tier-conditional version:

```typescript
// Base schema used for all tiers
const baseTopicSchema = z.object({
    topicId: z.string().min(1),
    topicLabel: z.string().min(1),
    interpretationCues: z.array(z.string().min(4).max(140)).min(1).max(3),
    significanceSignals: z.array(z.string().min(4).max(140)).min(1).max(3),
    probeAngles: z.array(z.string().min(4).max(140)).min(1).max(3),
});

// Extended schema for avanzato
const avanzatoTopicSchema = baseTopicSchema.extend({
    hypotheses: z.array(z.string().min(4).max(140)).min(1).max(3),
    narrativeThreads: z.array(z.string().min(4).max(140)).min(1).max(2),
    contradictionFlags: z.array(z.string().min(4).max(140)).min(1).max(3),
    emotionalSignals: z.array(z.string().min(4).max(140)).min(1).max(3),
});

const topicSchema = isAvanzato ? avanzatoTopicSchema : baseTopicSchema;
```

Note: `isAvanzato` is a boolean derived from the new `interviewerQuality` param that `generateRuntimeInterviewKnowledge` now receives.

### Step 3: Add `interviewerQuality` param to `generateRuntimeInterviewKnowledge`

Add to the function signature:

```typescript
export async function generateRuntimeInterviewKnowledge(params: {
    topics: RuntimeKnowledgeTopicInput[];
    language: string;
    researchGoal?: string | null;
    targetAudience?: string | null;
    model: LanguageModelV1;
    interviewerQuality?: string | null;   // NEW
}): Promise<RuntimeInterviewKnowledge>
```

### Step 4: Extend the LLM prompt for avanzato

In the function, derive `isAvanzato` and conditionally append to the prompt:

```typescript
const isAvanzato = params.interviewerQuality === 'avanzato';

const avanzatoInstructions = isAvanzato ? `
For each topic also provide (avanzato qualitative mode):
4) hypotheses -> 1-3 testable patterns to watch for during the conversation (e.g. "Potrebbe esserci tensione tra autonomia e controllo esterno")
5) narrativeThreads -> 1-2 typical story arcs for this audience on this topic (e.g. "Partono dal sintomo tecnico, poi rivelano un problema organizzativo")
6) contradictionFlags -> 1-3 pairs of statements that, if both said, signal unexplored tension (e.g. "Afferma indipendenza ma descrive ogni decisione come richiesta dall'alto")
7) emotionalSignals -> 1-3 cues distinguishing genuine engagement from defensive deflection (e.g. "Entusiasmo su processi = area di valore; minimizzazione su impatti = zona sensibile")
` : '';

// Append avanzatoInstructions to the existing prompt string
```

### Step 5: Update call site in `chat/route.ts`

Find `generateRuntimeInterviewKnowledge(` and pass the tier:

```typescript
generateRuntimeInterviewKnowledge({
    topics: ...,
    language: ...,
    researchGoal: ...,
    targetAudience: ...,
    model: ...,
    interviewerQuality: (bot as any).interviewerQuality || 'quantitativo'   // NEW
})
```

### Step 6: Commit

```bash
git add src/lib/interview/runtime-knowledge.ts src/app/api/chat/route.ts
git commit -m "feat(cil): extend RuntimeKnowledge schema with qualitative fields for avanzato tier"
```

---

## Task 4: CIL types and incremental state merge

### Files
- Create: `src/lib/interview/cil/types.ts`
- Create: `src/lib/interview/cil/cil-state.ts`
- Create: `src/lib/interview/cil/__tests__/cil-state.test.ts`

### Step 1: Create `src/lib/interview/cil/types.ts`

```typescript
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
```

### Step 2: Write failing tests for state merge

Create `src/lib/interview/cil/__tests__/cil-state.test.ts`:

```typescript
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
```

### Step 3: Run tests to confirm they fail

```bash
npx vitest run src/lib/interview/cil/__tests__/cil-state.test.ts
```

Expected: FAIL — module not found.

### Step 4: Create `src/lib/interview/cil/cil-state.ts`

```typescript
import type { CILAnalysis, CILState } from './types'
export { EMPTY_CIL_STATE } from './types'

const MAX_THREADS = 6
const MAX_THEMES = 5

export function mergeCILState(
    existing: CILState,
    analysis: CILAnalysis,
    currentTurnIndex: number
): CILState {
    // Merge threads — deduplicate by lowercased description, prefer higher strength
    const threadMap = new Map<string, CILState['openThreads'][0]>()
    for (const t of [...existing.openThreads, ...analysis.openThreads]) {
        const key = t.description.toLowerCase().trim()
        const prev = threadMap.get(key)
        if (!prev || (t.strength === 'high' && prev.strength !== 'high')) {
            threadMap.set(key, t)
        }
    }
    // Sort: high first, then by turnIndex desc; keep max 6
    const mergedThreads = Array.from(threadMap.values())
        .sort((a, b) => (a.strength === 'high' ? -1 : 1) - (b.strength === 'high' ? -1 : 1) || b.turnIndex - a.turnIndex)
        .slice(0, MAX_THREADS)

    // Merge themes — deduplicate, preserve order, max 5
    const themeSet = new Set<string>()
    const mergedThemes: string[] = []
    for (const theme of [...existing.emergingThemes, ...analysis.emergingThemes]) {
        const key = theme.toLowerCase().trim()
        if (!themeSet.has(key) && mergedThemes.length < MAX_THEMES) {
            themeSet.add(key)
            mergedThemes.push(theme)
        }
    }

    return {
        openThreads: mergedThreads,
        emergingThemes: mergedThemes,
        lastResponseAnalysis: analysis.lastResponseAnalysis,
        lastUpdatedTurnIndex: currentTurnIndex
    }
}
```

### Step 5: Run tests to confirm they pass

```bash
npx vitest run src/lib/interview/cil/__tests__/cil-state.test.ts
```

Expected: All PASS.

### Step 6: Commit

```bash
git add src/lib/interview/cil/
git commit -m "feat(cil): add CIL types and incremental state merge logic"
```

---

## Task 5: CIL budget stealing — `computeCILBonusCap` and `applyCILBudgetSignal`

### Files
- Modify: `src/lib/interview/explore-deepen-machine.ts`
- Create: `src/lib/interview/cil/__tests__/cil-budget.test.ts`

### Step 1: Write failing tests

Create `src/lib/interview/cil/__tests__/cil-budget.test.ts`:

```typescript
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
    uncoveredTopics: ['t2', 't3'],
    topicEngagementScores: {},
    topicKeyInsights: {},
    lastSignalScore: 0,
    totalMaxTurns: 18,
    runtimeInterviewKnowledge: null,
    runtimeInterviewKnowledgeSignature: null,
    ...overrides
})

describe('computeCILBonusCap', () => {
    it('returns 1 when many topics remain and little budget', () => {
        const state = makeState({ turnsUsedTotal: 16, totalMaxTurns: 18, uncoveredTopics: ['t2', 't3', 't4', 't5'] })
        expect(computeCILBonusCap(state, null)).toBe(1)
    })

    it('returns up to 4 when few topics remain and plenty of budget', () => {
        const state = makeState({ turnsUsedTotal: 4, totalMaxTurns: 30, uncoveredTopics: [] })
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
```

### Step 2: Run tests to confirm they fail

```bash
npx vitest run src/lib/interview/cil/__tests__/cil-budget.test.ts
```

Expected: FAIL — functions not exported.

### Step 3: Add functions to `explore-deepen-machine.ts`

At the bottom of `src/lib/interview/explore-deepen-machine.ts`, add:

```typescript
import type { InterviewState } from '@/app/api/chat/route'
import type { TopicBudget } from '@/lib/chat/context-helpers'

// Helper: how many topics come after the current one
function topicsAfterCurrent(state: InterviewState): number {
    return Math.max(0, Object.keys(state.topicBudgets).length - state.topicIndex - 1)
}

/**
 * Compute the maximum number of CIL bonus turns for the current topic.
 * Uses manual override if set, otherwise derives from remaining budget and topics.
 */
export function computeCILBonusCap(
    state: InterviewState,
    manualOverride: number | null | undefined
): number {
    if (manualOverride != null) return manualOverride
    const remainingTopics = state.uncoveredTopics.length + topicsAfterCurrent(state)
    const remainingBudget = state.totalMaxTurns - state.turnsUsedTotal
    const sharePerTopic = remainingBudget / Math.max(remainingTopics, 1)
    return Math.min(Math.max(Math.floor(sharePerTopic * 0.5), 1), 4)
}

/**
 * Extend the current topic's turn budget by 1 if a CIL high-strength thread
 * is detected and the per-topic cap has not been reached.
 */
export function applyCILBudgetSignal(
    state: InterviewState,
    signal: { extend: boolean; topicId: string; reason: string },
    cap: number
): InterviewState {
    if (!signal.extend) return state
    const budget = state.topicBudgets[signal.topicId]
    if (!budget) return state
    const alreadyApplied = budget.cilBonusApplied ?? 0
    if (alreadyApplied >= cap) return state
    return {
        ...state,
        topicBudgets: {
            ...state.topicBudgets,
            [signal.topicId]: {
                ...budget,
                maxTurns: budget.maxTurns + 1,
                cilBonusApplied: alreadyApplied + 1
            }
        }
    }
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run src/lib/interview/cil/__tests__/cil-budget.test.ts
```

Expected: All PASS.

### Step 5: Commit

```bash
git add src/lib/interview/explore-deepen-machine.ts src/lib/interview/cil/__tests__/cil-budget.test.ts
git commit -m "feat(cil): add computeCILBonusCap and applyCILBudgetSignal to explore-deepen-machine"
```

---

## Task 6: CIL pre-pass generation

### Files
- Create: `src/lib/interview/cil/conversation-intelligence.ts`
- Create: `src/lib/interview/cil/__tests__/conversation-intelligence.test.ts`

### Step 1: Write failing test

```typescript
// src/lib/interview/cil/__tests__/conversation-intelligence.test.ts
import { describe, it, expect, vi } from 'vitest'
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
```

### Step 2: Run to confirm it fails

```bash
npx vitest run src/lib/interview/cil/__tests__/conversation-intelligence.test.ts
```

Expected: FAIL — module not found.

### Step 3: Create `src/lib/interview/cil/conversation-intelligence.ts`

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'
import type { LanguageModelV1 } from '@ai-sdk/provider'
import type { CILAnalysis, CILState } from './types'
import type { RuntimeTopicKnowledge } from '@/lib/interview/runtime-knowledge'

export interface GenerateCILAnalysisParams {
    recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>
    currentTopicId: string
    cilState: CILState
    topicKnowledge: RuntimeTopicKnowledge | null
    model: LanguageModelV1
    language: string
}

const CIL_TIMEOUT_MS = 4000

const cilAnalysisSchema = z.object({
    openThreads: z.array(z.object({
        description: z.string().max(200),
        sourceTopicId: z.string(),
        strength: z.enum(['high', 'medium']),
        turnIndex: z.number(),
        anchoredHypothesis: z.string().optional()
    })).max(4),
    emergingThemes: z.array(z.string().max(100)).max(3),
    lastResponseAnalysis: z.object({
        keySignals: z.array(z.string().max(100)).max(5),
        emotionalCues: z.array(z.string().max(100)).max(3),
        interruptedThoughts: z.array(z.string().max(100)).max(3),
        activeHypotheses: z.array(z.string().max(100)).max(3),
        contradictionFlags: z.array(z.string().max(100)).max(3),
    }),
    suggestedMove: z.enum(['probe_deeper', 'follow_thread', 'bridge', 'synthesize']),
    budgetSignal: z.object({
        extend: z.boolean(),
        topicId: z.string(),
        reason: z.string().max(200),
    }).nullable()
})

function buildCILPrompt(params: GenerateCILAnalysisParams): string {
    const { topicKnowledge, cilState, recentTurns, currentTopicId, language } = params
    const lang = language === 'it' ? 'Italian' : 'English'

    const knowledgeSection = topicKnowledge ? `
== TOPIC INTELLIGENCE (pre-computed) ==
Topic: ${topicKnowledge.topicLabel}
Hypotheses: ${(topicKnowledge.hypotheses || []).join(' | ') || 'none'}
Narrative threads: ${(topicKnowledge.narrativeThreads || []).join(' | ') || 'none'}
Contradiction flags: ${(topicKnowledge.contradictionFlags || []).join(' | ') || 'none'}
Emotional signals: ${(topicKnowledge.emotionalSignals || []).join(' | ') || 'none'}
Probe angles: ${topicKnowledge.probeAngles.join(' | ')}
Significance signals: ${topicKnowledge.significanceSignals.join(' | ')}
` : '== NO TOPIC INTELLIGENCE AVAILABLE =='

    const accumulatedSection = cilState.openThreads.length > 0 ? `
== ACCUMULATED THREADS ==
${cilState.openThreads.map(t => `[${t.strength.toUpperCase()}] ${t.description}`).join('\n')}

Emerging themes: ${cilState.emergingThemes.join(', ') || 'none'}
` : ''

    const conversationSection = `
== RECENT CONVERSATION (last ${recentTurns.length} turns) ==
${recentTurns.map(t => `${t.role === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.content}`).join('\n\n')}
`

    return `You are a qualitative interview analyst. Language: ${lang}.
Current topic ID: ${currentTopicId}
${knowledgeSection}
${accumulatedSection}
${conversationSection}

Analyze the CANDIDATE's latest message and return a JSON analysis:
- openThreads: new threads worth following (max 4; strength=high only if genuinely surprising or hypothesis-confirming)
- emergingThemes: new cross-topic patterns (max 3)
- lastResponseAnalysis: key signals, emotional cues, interrupted thoughts, active hypotheses, contradiction flags from the latest candidate message
- suggestedMove: probe_deeper (follow current thread) | follow_thread (pursue open thread) | bridge (natural transition) | synthesize (connect patterns)
- budgetSignal: set extend=true + topicId only if a HIGH-strength thread justifies staying longer on this topic; otherwise null

Be specific, non-generic, grounded in what was actually said.`
}

const EMPTY_ANALYSIS: CILAnalysis = {
    openThreads: [],
    emergingThemes: [],
    lastResponseAnalysis: { keySignals: [], emotionalCues: [], interruptedThoughts: [], activeHypotheses: [], contradictionFlags: [] },
    suggestedMove: 'probe_deeper',
    budgetSignal: null
}

export async function generateCILAnalysis(params: GenerateCILAnalysisParams): Promise<CILAnalysis> {
    if (params.recentTurns.length === 0) return EMPTY_ANALYSIS

    try {
        const result = await Promise.race([
            generateObject({
                model: params.model,
                schema: cilAnalysisSchema,
                prompt: buildCILPrompt(params),
                temperature: 0.2
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('CIL timeout')), CIL_TIMEOUT_MS)
            )
        ])
        return (result as any).object as CILAnalysis
    } catch {
        // CIL failure is non-fatal — return empty analysis, interview continues
        return EMPTY_ANALYSIS
    }
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run src/lib/interview/cil/__tests__/conversation-intelligence.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add src/lib/interview/cil/
git commit -m "feat(cil): add CIL pre-pass generation (conversation-intelligence.ts)"
```

---

## Task 7: Prompt Block 6.5 — inject CIL context

### Files
- Modify: `src/lib/llm/prompt-builder.ts`
- Create: `src/lib/llm/__tests__/cil-block.test.ts`

### Step 1: Write failing test

```typescript
// src/lib/llm/__tests__/cil-block.test.ts
import { describe, it, expect } from 'vitest'
import { buildCILContextBlock } from '../prompt-builder'
import type { CILAnalysis, CILState } from '@/lib/interview/cil/types'

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

    it('returns minimal block when analysis is empty', () => {
        const empty: CILAnalysis = {
            ...baseAnalysis,
            openThreads: [],
            emergingThemes: [],
            lastResponseAnalysis: { keySignals: [], emotionalCues: [], interruptedThoughts: [], activeHypotheses: [], contradictionFlags: [] }
        }
        const block = buildCILContextBlock(empty, null, 'avanzato')
        expect(block).toBe('')  // no block if nothing to show
    })
})
```

### Step 2: Run to confirm it fails

```bash
npx vitest run src/lib/llm/__tests__/cil-block.test.ts
```

Expected: FAIL — `buildCILContextBlock` not exported.

### Step 3: Add `buildCILContextBlock` to `prompt-builder.ts`

At the end of `src/lib/llm/prompt-builder.ts`, add:

```typescript
import type { CILAnalysis, CILState } from '@/lib/interview/cil/types'

/**
 * Build CIL context block (Block 6.5) — avanzato only.
 * Returns empty string for other tiers or when nothing meaningful to show.
 */
export function buildCILContextBlock(
    analysis: CILAnalysis,
    cilState: CILState | null,
    interviewerQuality: string
): string {
    if (interviewerQuality !== 'avanzato') return ''

    const highThreads = analysis.openThreads.filter(t => t.strength === 'high')
    const mediumThreads = analysis.openThreads.filter(t => t.strength === 'medium')
    const themes = analysis.emergingThemes
    const lra = analysis.lastResponseAnalysis
    const hasMaterial = highThreads.length > 0 || themes.length > 0 ||
        lra.activeHypotheses.length > 0 || lra.contradictionFlags.length > 0 ||
        lra.interruptedThoughts.length > 0

    if (!hasMaterial) return ''

    const lines: string[] = ['=== CONVERSATIONAL INTELLIGENCE ===']

    if (highThreads.length > 0 || mediumThreads.length > 0) {
        lines.push('\nOpen threads:')
        for (const t of highThreads) {
            const hyp = t.anchoredHypothesis ? ` → ${t.anchoredHypothesis}` : ''
            lines.push(`• [FORTE] "${t.description}"${hyp}`)
        }
        for (const t of mediumThreads) {
            lines.push(`• [MEDIO] "${t.description}"`)
        }
    }

    if (themes.length > 0) {
        lines.push(`\nEmerging themes: ${themes.join(' · ')}`)
    }

    const signals = [
        ...lra.activeHypotheses.map(h => `Hypothesis taking shape: ${h}`),
        ...lra.contradictionFlags.map(f => `Contradiction: ${f}`),
        ...lra.emotionalCues,
        ...lra.interruptedThoughts.map(t => `Interrupted: ${t}`)
    ].slice(0, 4)

    if (signals.length > 0) {
        lines.push('\nLast response — signals:')
        for (const s of signals) lines.push(`• ${s}`)
    }

    lines.push(`\nSuggested move: ${analysis.suggestedMove}`)
    lines.push('(You are free to ignore this if the conversation suggests a better direction)')
    lines.push('===')

    return lines.join('\n')
}
```

### Step 4: Run tests to confirm they pass

```bash
npx vitest run src/lib/llm/__tests__/cil-block.test.ts
```

Expected: All PASS.

### Step 5: Commit

```bash
git add src/lib/llm/prompt-builder.ts src/lib/llm/__tests__/cil-block.test.ts
git commit -m "feat(cil): add buildCILContextBlock (prompt Block 6.5) to prompt-builder"
```

---

## Task 8: Wire CIL into `chat/route.ts`

This is the integration step. The CIL pre-pass starts as early as possible (parallel with supervisor sync), then its result is applied before prompt building.

### Files
- Modify: `src/app/api/chat/route.ts`

### Step 1: Add `cilState` to `InterviewState`

Find the `InterviewState` type definition in `src/app/api/chat/route.ts` and add:

```typescript
// existing fields...
runtimeInterviewKnowledge?: RuntimeInterviewKnowledge | null;
runtimeInterviewKnowledgeSignature?: string | null;
cilState?: CILState | null;   // NEW
```

### Step 2: Rehydrate `cilState` from metadata

Find the block where state fields are read from `rawMetadata` (around line 570) and add:

```typescript
cilState: rawMetadata.cilState ?? null,
```

### Step 3: Start CIL promise early (parallel with supervisor)

Find the section after RuntimeKnowledge is resolved and the supervisor state machine runs (after lines ~640). Add the CIL promise start:

```typescript
// --- CIL PRE-PASS (avanzato only, parallel with remaining sync work) ---
const isAvanzato = ((bot as any).interviewerQuality || 'quantitativo') === 'avanzato'
const AVANZATO_CIL_RECENT_TURNS = 6

const cilPromise: Promise<CILAnalysis | null> = isAvanzato
    ? (async () => {
        const rk = await runtimeInterviewKnowledgePromise
        const topicKnowledge = rk?.topics.find(t => t.topicId === currentTopicId) ?? null
        const recentTurns = canonicalMessages
            .slice(-AVANZATO_CIL_RECENT_TURNS)
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        return generateCILAnalysis({
            recentTurns,
            currentTopicId,
            cilState: state.cilState ?? EMPTY_CIL_STATE,
            topicKnowledge,
            model: modelRegistry.fastModel,   // gpt-4.1-mini
            language: bot.language || 'it'
        })
    })()
    : Promise.resolve(null)
```

### Step 4: Await CIL and apply budget signal before prompt building

Just before `buildSystemPrompt` (or the equivalent prompt construction block), add:

```typescript
const cilAnalysis = await cilPromise

// Apply budget stealing if CIL detected a high thread
if (cilAnalysis?.budgetSignal && isAvanzato) {
    const cap = computeCILBonusCap(nextState, (bot as any).cilBonusTurnCapOverride ?? null)
    nextState = applyCILBudgetSignal(nextState, cilAnalysis.budgetSignal, cap)
}
```

### Step 5: Inject Block 6.5 into system prompt

After all existing blocks are built (find where the system prompt string is assembled), add:

```typescript
const cilBlock = cilAnalysis
    ? buildCILContextBlock(cilAnalysis, state.cilState ?? null, (bot as any).interviewerQuality || 'quantitativo')
    : ''

// Insert between block 6 (micro-planner) and block 7 (guards)
const systemPrompt = [block1, block2, block3, block4, block5, block6, cilBlock, block7]
    .filter(Boolean)
    .join('\n\n')
```

Note: the exact assembly code varies — find the join/concatenation of prompt blocks and insert `cilBlock` in the right position.

### Step 6: Persist updated `cilState` after response

After the response is generated and before saving to DB, merge the CIL state:

```typescript
if (cilAnalysis && isAvanzato) {
    nextState.cilState = mergeCILState(
        state.cilState ?? EMPTY_CIL_STATE,
        cilAnalysis,
        canonicalMessages.length
    )
}
```

### Step 7: Add required imports at top of `chat/route.ts`

```typescript
import { generateCILAnalysis } from '@/lib/interview/cil/conversation-intelligence'
import { mergeCILState, EMPTY_CIL_STATE } from '@/lib/interview/cil/cil-state'
import { computeCILBonusCap, applyCILBudgetSignal } from '@/lib/interview/explore-deepen-machine'
import { buildCILContextBlock } from '@/lib/llm/prompt-builder'
import type { CILAnalysis, CILState } from '@/lib/interview/cil/types'
```

### Step 8: Smoke test

Start the dev server and run a short avanzato interview. Check server logs for:
- CIL pre-pass completing within 400ms
- `cilState` appearing in conversation metadata after first turn
- No errors in non-avanzato tiers

```bash
npm run dev
```

### Step 9: Run full test suite

```bash
npx vitest run
```

Expected: All existing tests pass, no regressions.

### Step 10: Commit

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(cil): wire CIL pre-pass into chat route — parallel execution, budget stealing, Block 6.5"
```

---

## Task 9: Bot settings UI — `cilBonusTurnCapOverride`

### Files
- Modify: `src/app/dashboard/bots/[botId]/bot-config-form.tsx`
- Modify: `src/app/api/bots/[botId]/route.ts`

### Step 1: Add field to bot-config-form

In `src/app/dashboard/bots/[botId]/bot-config-form.tsx`, find the avanzato-specific UI section (where `interviewerQuality` is shown/hidden). Add after it:

```tsx
{interviewerQuality === 'avanzato' && (
    <div className="space-y-2">
        <Label htmlFor="cilBonusTurnCapOverride">
            CIL Bonus Turn Cap
            <span className="text-muted-foreground text-xs ml-2">(lascia vuoto per formula automatica)</span>
        </Label>
        <Input
            id="cilBonusTurnCapOverride"
            type="number"
            min={0}
            max={10}
            placeholder="Auto"
            value={form.cilBonusTurnCapOverride ?? ''}
            onChange={e => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                form.setValue('cilBonusTurnCapOverride', isNaN(val as number) ? null : val)
            }}
        />
        <p className="text-xs text-muted-foreground">
            Numero massimo di turni bonus che il CIL può aggiungere per topic.
            Automatico = calcolato su tempo e topic rimanenti.
        </p>
    </div>
)}
```

### Step 2: Add to form schema (Zod)

In the same file, find the Zod schema and add:

```typescript
cilBonusTurnCapOverride: z.number().int().min(0).max(10).nullable().optional(),
```

### Step 3: Update API route to persist the field

In `src/app/api/bots/[botId]/route.ts`, find the PATCH handler and ensure `cilBonusTurnCapOverride` is included in the data passed to Prisma:

```typescript
cilBonusTurnCapOverride: body.cilBonusTurnCapOverride ?? null,
```

### Step 4: Manual test

1. Open a bot in settings → change `interviewerQuality` to Avanzato
2. Verify "CIL Bonus Turn Cap" field appears
3. Set it to `3`, save
4. Change back to Intermedio — verify field hides
5. Verify the value persists in the DB after save

### Step 5: Run tests

```bash
npx vitest run
```

Expected: All PASS.

### Step 6: Commit all pending changes

```bash
git add src/app/dashboard/bots/[botId]/bot-config-form.tsx src/app/api/bots/[botId]/route.ts
git commit -m "feat(cil): add cilBonusTurnCapOverride setting to bot config UI (avanzato only)"
```

---

## Final verification

### Run full test suite

```bash
npx vitest run
```

Expected: All existing tests pass + all new CIL tests pass.

### TypeScript check

```bash
node --max-old-space-size=4096 node_modules/.bin/tsc --noEmit --skipLibCheck
```

Expected: No new errors (4 pre-existing unrelated errors are acceptable).

### Commit all uncommitted work

```bash
git add -A && git commit -m "feat(avanzato): Conversation Intelligence Layer — qualitative interview mode"
```

---

## Implementation order summary

| Task | Core change | Tests |
|------|-------------|-------|
| 1 | Prisma + TopicBudget types | Manual migration test |
| 2 | RuntimeKnowledge signature | Unit (existing test file) |
| 3 | RuntimeKnowledge avanzato schema | Manual (LLM output) |
| 4 | CIL types + state merge | Unit (pure functions) |
| 5 | Budget stealing functions | Unit (pure functions) |
| 6 | CIL pre-pass generation | Unit (empty input) |
| 7 | Prompt Block 6.5 | Unit (output format) |
| 8 | Chat route wiring | Integration (dev server) |
| 9 | Bot settings UI | Manual |

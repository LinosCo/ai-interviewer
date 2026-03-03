# Avanzato — Qualitative Interview Design

**Date:** 2026-03-03
**Status:** Approved
**Scope:** `interviewerQuality === 'avanzato'` only

---

## Problem

The current Avanzato tier uses a more capable model (claude-sonnet-4-5) and a qualitative system prompt, but the conversation logic is identical to the other tiers: the supervisor drives topic transitions via signal scores and turn budgets, and the LLM receives structured instructions ("you are on topic 2, sub-goal: identify constraints"). The LLM has permission to deviate but lacks the material and mechanism to do so. The result is a smarter executor of a structured script, not a genuine qualitative interviewer.

A professional qualitative interview is bottom-up: the candidate's responses determine where the conversation goes. Topic objectives serve as orientation, not rails. The interviewer listens actively, follows unexpected threads, tests hypotheses, and bridges naturally from what was just said — not from a checklist.

---

## Chosen Approach: C Elevated — Conversation Intelligence Layer

**Rejected: A (overlay)**
The supervisor state would diverge from the actual conversation, creating drift that is hard to debug.

**Rejected: B (separate engine)**
Too invasive — full architectural rewrite of a working system.

**Chosen: C elevated**
Keep the existing supervisor as a safety net (coverage tracking, data collection, closure). Add a lightweight pre-pass that produces curated qualitative intelligence, injected into the prompt as a new block. Claude Sonnet has full conversation history *plus* concrete, domain-specific observations to act on.

The key insight: the problem is not that the LLM lacks capability — it is that it lacks *material*. With specific hypotheses to test, narrative threads to follow, and contradiction flags to watch for, Claude Sonnet makes genuinely qualitative decisions.

---

## Architecture Overview

```
request arrives
    │
    ├─ Supervisor: rehydrate state, phase decision (sync ~100ms)
    │
    ├─ CIL pre-pass (gpt-4.1-mini, parallel) ←── NEW
    │     └─ anchored to enhanced RuntimeKnowledge
    │     └─ ~300ms, incremental
    │
    ├─ applyCILBudgetSignal() ←── NEW
    │     └─ extends topicBudgets if high-strength thread detected
    │
    ├─ Build prompt blocks 1–7 + Block 6.5 (CIL context) ←── MODIFIED
    │
    └─ Claude Sonnet generates natural response
         └─ receives full messages[] + curated CIL context
```

---

## Component 1: RuntimeKnowledge Enhancement

### Problem with current system

`RuntimeKnowledge` cache signature does not include `interviewerQuality`. All tiers share identical generated knowledge, even though Avanzato requires qualitatively richer guidance.

### Fix 1 — Add tier to cache signature

```typescript
// src/lib/interview/runtime-knowledge.ts
const basis = [
  params.language || 'en',
  params.researchGoal || '',
  params.targetAudience || '',
  params.plan?.meta?.topicsSignature || '',
  params.plan?.meta?.maxDurationMins || '',
  params.interviewerQuality || 'quantitativo'   // NEW
].join('|')
```

### Fix 2 — Extend schema for Avanzato

```typescript
interface RuntimeTopicKnowledge {
  topicId: string
  topicLabel: string

  // Existing fields — all tiers
  interpretationCues: string[]     // how to read candidate answers
  significanceSignals: string[]    // signs that deserve deeper probing
  probeAngles: string[]            // concrete follow-up directions

  // New fields — avanzato only
  hypotheses?: string[]            // "Potrebbe esserci tensione tra autonomia e controllo"
  narrativeThreads?: string[]      // Story arcs typical of this topic/audience
  contradictionFlags?: string[]    // "Se afferma X ma anche Y → approfondire"
  emotionalSignals?: string[]      // "Entusiasmo su X = area di valore; difensività su Y = zona sensibile"
}
```

### Fix 3 — Tier-specific generation prompt

The LLM prompt for avanzato includes additional instructions:

```
For each topic, in addition to the standard fields, provide:
4) hypotheses   -> 1-3 testable patterns the interviewer should watch for
5) narrativeThreads -> 1-2 story arcs typical of this audience on this topic
6) contradictionFlags -> statements that, if combined, signal unexplored tension
7) emotionalSignals -> cues distinguishing genuine engagement from defensive deflection

Keep all items short (max 140 chars), non-generic, tied to the specific research goal.
```

**Cost:** RuntimeKnowledge is generated once per conversation (cached by signature). The extended schema adds ~30–50% more output tokens to a one-time call. Per-turn cost is zero.

---

## Component 2: Conversation Intelligence Layer (CIL)

### CILAnalysis type

```typescript
interface CILAnalysis {
  // Threads worth following — candidates for budget extension
  openThreads: Array<{
    description: string       // "Ha usato 'obbligato' due volte senza spiegare"
    sourceTopicId: string
    strength: 'high' | 'medium'  // only 'high' triggers budget stealing
    turnIndex: number
    anchoredHypothesis?: string  // which RuntimeKnowledge hypothesis this matches
  }>

  // Patterns emerging across multiple topics
  emergingThemes: string[]        // ["autonomia vs controllo", "paura del giudizio"]

  // Analysis of the most recent candidate message
  lastResponseAnalysis: {
    keySignals: string[]          // salient words and concepts
    emotionalCues: string[]       // "ha minimizzato poi si è corretto"
    interruptedThoughts: string[] // things started and not finished
    activeHypotheses: string[]    // which RuntimeKnowledge hypotheses are gaining support
    contradictionFlags: string[]  // which contradictionFlags appeared
  }

  // Suggested next move — NOT prescriptive, input to LLM
  suggestedMove: 'probe_deeper' | 'follow_thread' | 'bridge' | 'synthesize'

  // Signal to supervisor for budget extension
  budgetSignal: {
    extend: boolean
    topicId: string
    reason: string
  } | null
}
```

### Pre-pass prompt (gpt-4.1-mini)

The CIL does not analyze the conversation in the abstract. It checks the last 4–6 turns against the pre-computed RuntimeKnowledge hypotheses, narrative threads, and contradiction flags:

```
You are a qualitative interview analyst.

== TOPIC INTELLIGENCE (pre-computed) ==
Topic: {topicLabel}
Hypotheses to test: {hypotheses}
Narrative threads: {narrativeThreads}
Contradiction flags: {contradictionFlags}
Emotional signals: {emotionalSignals}

== RECENT CONVERSATION (last 4–6 turns) ==
{recent_turns}

== ACCUMULATED STATE ==
{cilState.openThreads}
{cilState.emergingThemes}

Analyze the latest candidate response and return:
- Which hypotheses are gaining/losing support
- Which narrative threads are appearing
- Which contradiction flags were triggered
- Whether any open thread is strong enough to extend the current topic budget
- Suggested next move
```

**Input size:** ~500–700 tokens (anchored, not free-form NLP over the full history).
**Latency:** ~250–350ms, runs in parallel with supervisor sync.

### Incremental cilState

`CILAnalysis` is stored incrementally in `conversation.metadata`:

```typescript
// Stored alongside interviewState in Conversation.metadata
cilState: {
  openThreads: CILThread[]     // merged across turns, deduped
  emergingThemes: string[]     // accumulated, max 5
  lastResponseAnalysis: {...}  // replaced each turn
  lastUpdatedTurnIndex: number
}
```

Per-turn: only the delta (new exchange + 2 turns context) is analyzed. The accumulated state is merged. Claude Sonnet always receives full `messages[]` — the cilState is a curated distillation, not a replacement for conversation history.

---

## Component 3: Budget Stealing

When `budgetSignal.extend === true`, the supervisor extends the current topic's budget before generating the response.

### Dynamic cap formula

```typescript
function computeCILBonusCap(state: InterviewState, botSettings: BotSettings): number {
  // Manual override takes precedence
  if (botSettings.cilBonusTurnCapOverride != null) {
    return botSettings.cilBonusTurnCapOverride
  }

  const remainingTopics = state.uncoveredTopics.length + topicsAfterCurrent(state)
  const remainingBudget = state.totalMaxTurns - state.turnsUsedTotal

  // Share available per remaining topic, capped between 1 and 4
  const sharePerTopic = remainingBudget / Math.max(remainingTopics, 1)
  return Math.min(Math.max(Math.floor(sharePerTopic * 0.5), 1), 4)
}
```

This ensures:
- Many topics remaining + little time → cap low (0–1 extra turns)
- Last topic + time available → cap high (up to 4 extra turns)

### Application

```typescript
// src/lib/interview/explore-deepen-machine.ts
function applyCILBudgetSignal(
  state: InterviewState,
  signal: CILBudgetSignal,
  cap: number
): InterviewState {
  const budget = state.topicBudgets[signal.topicId]
  if (!budget) return state

  // Guard: total bonus turns per topic capped, not per-signal
  const alreadyBorrowed = (budget.cilBonusApplied ?? 0)
  if (alreadyBorrowed >= cap) return state

  return {
    ...state,
    topicBudgets: {
      ...state.topicBudgets,
      [signal.topicId]: {
        ...budget,
        max: budget.max + 1,
        cilBonusApplied: alreadyBorrowed + 1
      }
    }
  }
}
```

### Manual override

Bot settings (visible only when `interviewerQuality === 'avanzato'`):

```typescript
cilBonusTurnCapOverride?: number | null  // null = use dynamic formula
```

---

## Component 4: Prompt Block 6.5

Inserted between Block 6 (turn guidance) and Block 7 (guards), avanzato only:

```
=== CONVERSATIONAL INTELLIGENCE ===

Open threads:
• [FORTE] "Ha usato 'obbligato' due volte senza contestualizzarlo" → hypothesis: autonomia vs controllo
• [MEDIO] "Ha iniziato a parlare della decisione X e si è fermato"

Emerging themes: autonomia vs controllo · paura del giudizio

Last response — signals:
• Ha minimizzato, poi si è corretto
• Hypothesis #2 (controllo esterno) sta prendendo forma
• Contradiction flag: afferma indipendenza ma descrive tutti i passi come richiesti dall'alto

Suggested move: probe_deeper
(You are free to ignore this if the conversation suggests a better direction)
===
```

---

## Tier Comparison (updated)

| | Quantitativo | Intermedio | Avanzato |
|---|---|---|---|
| Model | gpt-4.1-mini | gpt-4.1 | claude-sonnet-4-5 |
| Script adherence | Strict | Balanced | Objectives only |
| RuntimeKnowledge | Standard (3 fields) | Standard (3 fields) | Extended (7 fields) |
| CIL pre-pass | No | No | Yes |
| Budget stealing | No | No | Yes (dynamic cap) |
| Prompt block 6.5 | No | No | Yes |
| Credit cost | 1× | 2× | 3× |

---

## Latency Impact

| Step | Timing |
|---|---|
| Supervisor sync (existing) | ~100ms |
| CIL pre-pass (parallel) | ~300ms |
| Net CIL overhead | ~200ms |
| Claude Sonnet response (existing) | ~2–4s TTFB |
| **Total delta** | **+200–400ms** |

The CIL runs in parallel with the supervisor state computation. The additional latency to TTFB is ~200–400ms — within the expected "thinking" window of a conversational interview.

---

## Files to Create / Modify

### New
- `src/lib/interview/cil/conversation-intelligence.ts` — CILAnalysis type + pre-pass generation
- `src/lib/interview/cil/cil-state.ts` — incremental state merge logic

### Modified
- `src/lib/interview/runtime-knowledge.ts` — add tier to signature, extend schema + prompt for avanzato
- `src/lib/interview/explore-deepen-machine.ts` — `applyCILBudgetSignal()`
- `src/lib/llm/prompt-builder.ts` — Block 6.5 injection (avanzato only)
- `src/app/api/chat/route.ts` — wire CIL pre-pass into request handler (parallel with supervisor)
- `src/app/dashboard/bots/[botId]/bot-config-form.tsx` — `cilBonusTurnCapOverride` field (avanzato only)
- `src/app/api/bots/[botId]/route.ts` — persist `cilBonusTurnCapOverride`
- Prisma schema — add `cilBonusTurnCapOverride Int?` to `Bot` model

---

## What This Does NOT Change

- Phase machine (EXPLORE / DEEPEN / DEEP_OFFER / DATA_COLLECTION) — unchanged for all tiers
- Signal scoring — unchanged
- Memory manager — unchanged
- Quantitativo and Intermedio behavior — unchanged
- RuntimeKnowledge for non-avanzato tiers — unchanged (cache signature differs by tier)

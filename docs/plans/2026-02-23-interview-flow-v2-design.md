# Interview Flow v2 — Design Document

**Date**: 2026-02-23
**Status**: Approved
**Branch**: TBD (feature branch from main)

---

## 1. Executive Summary

Complete redesign of the interview conversation flow to achieve natural, adaptive conversations while maintaining deterministic safety guarantees.

### Core Changes
- **SCAN elastico + DEEP residuale**: single adaptive pass with inline deepening, DEEP only for coverage gaps
- **Prompt consolidato**: from 15 instruction blocks to 7, zero redundancies
- **Post-processing ridotto**: from 15+ layers (up to 27 LLM calls) to 5 essential safety nets (max 3 LLM calls)
- **Piano potenziato**: pre-generated topic intelligence saved in plan (eliminates per-interview LLM call)
- **Memoria arricchita**: key insights per topic tracked and surfaced in prompt

### Key Metrics (Expected)
| Metric | Current | v2 | Delta |
|--------|---------|-----|-------|
| Prompt tokens (input) | ~4,100 | ~2,300 | -44% |
| LLM calls per turn | 1 + 2-5 extra | 1 + 0-1 extra | -60/80% |
| Latency per turn | 5-14s | 3-10s | -30/40% |
| Post-processing layers | 15+ (half disabled) | 5 | -67% |
| Instruction blocks in prompt | 15 | 7 | -53% |

---

## 2. Design Principles

1. **Trust the LLM, guard the edges**: invest in prompt quality, not in post-processing corrections
2. **Say it once**: every instruction appears exactly once in the prompt
3. **Deterministic skeleton, adaptive muscles**: state machine controls phase transitions; signal scores control depth
4. **Pre-compute what you can**: move intelligence generation to plan creation time, not interview runtime
5. **Latency is UX**: fewer LLM calls = better user experience

---

## 3. Phase Model

### 3.1 Phase Definitions

```
EXPLORE → DEEP_OFFER → DEEPEN → DATA_COLLECTION → END
```

#### EXPLORE (replaces SCAN)

Primary interview phase. Topics covered in configured order with **elastic turn budgets**.

**Turn Budget per Topic**:
- `minTurns = 1` — guaranteed minimum coverage
- `baseTurns = 2` — default allocation
- `maxTurns = baseTurns + 2` — ceiling with bonus turns

**Signal-Driven Adaptation** (after each user response):

| Signal Score | Range | Action |
|-------------|-------|--------|
| LOW | < 0.3 | If `turnsUsed >= minTurns` → advance to next topic. Prompt: lighter, more direct question |
| MEDIUM | 0.3–0.6 | Continue normally until `baseTurns`. Prompt: deepen one specific detail |
| HIGH | > 0.6 | Expand budget +1 turn (up to `maxTurns`). Prompt: deep probing on richest element |

**Budget Stealing**: when a topic takes a bonus turn, it's subtracted from the topic with highest remaining `maxTurns` among unexplored topics. If no topic has margin, bonus is not granted.

**SubGoal Consumption**: each turn consumes the next uncovered subgoal. If a topic advances with remaining subgoals, they're marked for DEEPEN.

#### DEEP_OFFER (unchanged logic, simplified implementation)

Gate before DEEPEN when time budget is exhausted.

- Triggered when `remainingTime <= 0` at end of any EXPLORE topic
- Max 2 attempts (ACCEPT/REFUSE/NEUTRAL handling unchanged)
- ACCEPT → DEEPEN on uncovered topics
- REFUSE → DATA_COLLECTION

#### DEEPEN (replaces DEEP)

Residual phase for coverage gaps only.

- Only topics with uncovered subgoals from EXPLORE
- Turn allocation: engagement score from EXPLORE + number of remaining subgoals
- **Key difference from current DEEP**: prompt includes recap of EXPLORE context ("you previously mentioned X about this topic")
- If EXPLORE covered everything well, DEEPEN may have zero topics → skip to DATA_COLLECTION

#### DATA_COLLECTION (unchanged)

Consent → Field collection loop. Working well, no changes needed.

#### END (unchanged)

Interview completion with reward delivery.

### 3.2 Phase Transition Map

```
EXPLORE[topicN] ──(signal LOW + turnsUsed >= min)──→ EXPLORE[topicN+1]
EXPLORE[topicN] ──(signal HIGH + turnsUsed < max)──→ EXPLORE[topicN] (bonus turn)
EXPLORE[topicN] ──(normal + turnsUsed >= base)─────→ EXPLORE[topicN+1]
EXPLORE[last]   ──(uncoveredTopics.length > 0 && remainingTime > 0)──→ DEEPEN
EXPLORE[last]   ──(uncoveredTopics.length > 0 && remainingTime <= 0)─→ DEEP_OFFER
EXPLORE[last]   ──(uncoveredTopics.length === 0)───→ DATA_COLLECTION
EXPLORE[any]    ──(remainingTime <= 0 mid-topic)───→ finish current turn → DEEP_OFFER
EXPLORE[any]    ──(user explicit closure)──────────→ DATA_COLLECTION

DEEP_OFFER ──(ACCEPT)──→ DEEPEN
DEEP_OFFER ──(REFUSE)──→ DATA_COLLECTION
DEEP_OFFER ──(2 NEUTRAL)→ DATA_COLLECTION

DEEPEN[topicN] ──(turnsUsed >= limit)──→ DEEPEN[topicN+1]
DEEPEN[last]   ──→ DATA_COLLECTION

DATA_COLLECTION ──(complete/refused/exhausted)──→ END
```

---

## 4. Interview Plan v2

### 4.1 Structure

The interview plan is pre-generated when the bot configuration changes (topics, duration, logic version) and saved to DB.

```typescript
interface InterviewPlanV2 {
  version: number;
  meta: {
    generatedAt: string;
    planLogicVersion: string;
    maxDurationMins: number;
    totalTimeSec: number;
    secondsPerTurn: number;      // 45
    topicsSignature: string;
  };
  explore: {
    topics: PlanTopicV2[];
  };
  deepen: {
    maxTurnsPerTopic: number;    // 2
    fallbackTurns: number;       // 1
  };
}

interface PlanTopicV2 {
  topicId: string;
  label: string;
  orderIndex: number;
  subGoals: string[];
  minTurns: number;              // 1
  baseTurns: number;             // 2
  maxTurns: number;              // baseTurns + 2

  // Pre-generated intelligence (NEW - eliminates per-interview LLM call)
  interpretationCues: string[];  // How to read user answers
  significanceSignals: string[]; // Signs worth deepening
  probeAngles: string[];         // Follow-up directions
}
```

### 4.2 Plan Generation

**When**: on bot creation or update (topics, duration, research goal changes).

**Intelligence generation**: one LLM call per plan generation (not per interview). Uses existing `generateRuntimeInterviewKnowledge()` logic but saves output into the plan.

**Budget calculation**:

```
totalTurns = floor(totalTimeSec / SECONDS_PER_TURN)
perTopicBase = max(2, floor(totalTurns / numTopics))
perTopicMax = perTopicBase + 2
perTopicMin = 1
```

### 4.3 Manual Knowledge Override

If a manual interview guide exists (uploaded by user), it takes priority over pre-generated intelligence. The plan still contains the generated intelligence as fallback, but the prompt builder selects the manual guide when available.

---

## 5. Prompt Architecture

### 5.1 Consolidated Blocks (from 15 to 7)

| # | Block | Source | Content | Approx Tokens |
|---|-------|--------|---------|---------------|
| 1 | **Identity** | PromptBuilder | Persona + base rules (one question, no contacts, no CTA, question mark) — stated ONCE | ~400 |
| 2 | **Interview Context** | PromptBuilder | Time status, pacing, topic roadmap overview (merges old Context Prompt + Plan Summary) | ~350 |
| 3 | **Topic Focus** | PromptBuilder | Current topic, subgoal target, phase, hard constraints (merges old Topic Prompt + Status Banner) | ~300 |
| 4 | **Memory** | MemoryManager | Facts collected, topics explored with coverage + key insights, fatigue, comm style | ~300 |
| 5 | **Knowledge** | Plan or Manual | Topic intelligence (interpretation cues, significance signals, probe angles) OR manual guide | ~250 |
| 6 | **Turn Guidance** | route.ts | Signal score, response depth, opening style, stems to avoid, diagnostic lens hint (merges old Runtime Semantic Context + Micro-Planner) | ~300 |
| 7 | **Guards** | route.ts | Clarification or off-topic handler (conditional, only when detected) | ~100 |
| | **Total** | | | **~2,000-2,100** |

### 5.2 Eliminated Blocks

| Old Block | Disposition |
|-----------|------------|
| Methodology Prompt | Absorbed into Identity + Turn Guidance |
| Plan Summary (separate) | Merged into Interview Context |
| Status Banner (separate) | Merged into Topic Focus |
| Question Mark Enforcement | Single line in Identity |
| Intro Message (separate block) | First-turn special case in Topic Focus |
| Redundant rules (5x "one question", 4x "no contacts") | Stated once in Identity |

### 5.3 Key Rule: Zero Redundancy

Every rule appears in exactly ONE block:

| Rule | Single Location |
|------|----------------|
| One question per turn | Identity |
| No contacts outside DATA_COLLECTION | Identity |
| No CTA/promo | Identity |
| Response must end with '?' | Identity |
| Acknowledge user content specifically | Turn Guidance |
| Avoid generic openers | Turn Guidance |
| Current topic focus | Topic Focus |
| Time pressure / pacing | Interview Context |

---

## 6. Memory System v2

### 6.1 Current State (preserved)
- Facts collected (confidence >= 0.6) with "do not re-ask" warning
- Topics explored with coverage level
- Fatigue score and signals
- Communication style (formal/casual/brief/verbose)

### 6.2 New: Key Insights per Topic

After each EXPLORE turn, if signal score >= 0.5, the best user snippet is stored:

```typescript
interface TopicMemory {
  topicId: string;
  coverage: 'none' | 'partial' | 'full';
  turnsUsed: number;
  engagementScore: number;        // 0-1
  keyInsight?: string;            // Best snippet from highest-scoring turn (max ~20 words)
  uncoveredSubGoals: string[];
}
```

**Prompt format** (in Memory block):

```
## TOPICS EXPLORED
- Budget Process (3/4 subgoals, engagement: HIGH)
  Key insight: "il processo di approvazione richiede tre livelli di firma"
- Workflow (1/3 subgoals, engagement: LOW)
  No notable insights yet.
```

**Use in DEEPEN**: the key insight provides natural conversation context ("Earlier you mentioned that the approval process requires three levels of signature — let's explore that further").

**Cost**: ~100 extra tokens vs current memory. No additional LLM calls — snippet extracted from signal score computation already happening.

---

## 7. Signal Score

### 7.1 Computation (refined from existing `computeEngagementScore`)

**Inputs**:
- `wordCount`: raw word count of user response
- `hasExamples`: presence of numbers, proper nouns, dates, specific details
- `hasImpactKeywords`: "problema", "importante", "criticità", "impatto", "sfida", etc.
- `hasEmotions`: strong opinions, emotional language markers

**Formula**:

```typescript
function computeSignalScore(userMessage: string, language: string): number {
  const words = userMessage.split(/\s+/).length;

  // Length component (0-0.4)
  const lengthScore = Math.min(0.4, words / 100);

  // Content richness (0-0.3)
  const hasExamples = /\d|[A-Z][a-z]{2,}/.test(userMessage) ? 0.15 : 0;
  const hasImpact = IMPACT_KEYWORDS[language].test(userMessage) ? 0.15 : 0;
  const richnessScore = hasExamples + hasImpact;

  // Engagement markers (0-0.3)
  const hasEmotions = EMOTION_MARKERS[language].test(userMessage) ? 0.15 : 0;
  const hasDetail = words > 30 ? 0.15 : 0;
  const engagementScore = hasEmotions + hasDetail;

  return Math.min(1, lengthScore + richnessScore + engagementScore);
}
```

### 7.2 Bands and Actions

| Band | Score | Topic Budget Effect | Prompt Guidance |
|------|-------|-------------------|-----------------|
| LOW | < 0.3 | Cut to `minTurns` if possible | "Use a simpler, more direct question. Keep it brief." |
| MEDIUM | 0.3–0.6 | Normal (`baseTurns`) | "Deepen one specific detail that just emerged." |
| HIGH | > 0.6 | Expand +1 (up to `maxTurns`) | "Pick the richest element and probe deeply. Reference the specific detail." |

---

## 8. Post-Processing Pipeline v2

### 8.1 Layer Inventory (5 layers)

| # | Layer | Phase | Trigger | Action | Max LLM Calls |
|---|-------|-------|---------|--------|---------------|
| 1 | **Closure Guard** | EXPLORE, DEEPEN | No '?' OR goodbye pattern OR completion tag OR premature contact | Single regeneration with enforced topic question | 0-1 |
| 2 | **Duplicate Detector** | EXPLORE, DEEPEN | Semantic similarity > threshold vs last 60 questions | `generateQuestionOnly()` | 0-1 |
| 3 | **DEEP_OFFER Enforcer** | DEEP_OFFER | Response is not an extension offer question | `enforceDeepOfferQuestion()` | 0-1 |
| 4 | **DATA_COLLECTION Enforcer** | DATA_COLLECTION | Consent/field question validation | Force-generate consent or field question | 0-1 |
| 5 | **Completion Guard** | All | `INTERVIEW_COMPLETED` tag present | Verify consent + fields via `getCompletionGuardAction()` | 0 (deterministic) |

### 8.2 Eliminated Layers

| Old Layer | Reason for Removal |
|-----------|-------------------|
| Quality Gates (10 checks) | Disabled in production, caused problems. Prompt quality replaces this. |
| Anchor Drift Detection | Disabled, keyword matching unreliable. Topic Focus in prompt handles this. |
| Clarification Regeneration | Disabled. Guards block (conditional) in prompt handles this. |
| Off-Topic Regeneration | Disabled. Guards block in prompt handles this. |
| Triple DEEP_OFFER validation | Redundant. Single enforcer sufficient. |
| Triple Closure detection | Redundant. Single guard sufficient. |
| Double DATA_COLLECTION validation | Redundant. Single enforcer with fresh DB read. |
| Additive fix approach | Conflicts with regeneration. Removed entirely. |
| Promo/CTA detection | Absorbed into Closure Guard pattern matching. |

### 8.3 Execution Order

```
LLM Response Generated (temp 0.7)
    ↓
[1] Closure Guard → if fail: regenerate (temp 0.3) → if still fail: generateQuestionOnly() → hardcoded fallback
    ↓
[2] Duplicate Detector → if duplicate: generateQuestionOnly()
    ↓
[3] DEEP_OFFER Enforcer (only in DEEP_OFFER phase) → if fail: enforceDeepOfferQuestion()
    ↓
[4] DATA_COLLECTION Enforcer (only in DATA_COLLECTION phase) → if fail: force-generate
    ↓
[5] Completion Guard (if INTERVIEW_COMPLETED present) → verify legitimacy → complete or block
    ↓
Final Response → Save State → Return to User
```

**Worst case**: 1 (initial) + 1 (closure) + 1 (duplicate) = **3 LLM calls**.
**Typical case**: 1 (initial) + 0 = **1 LLM call**.

---

## 9. State Model

### 9.1 InterviewState v2

```typescript
interface InterviewStateV2 {
  // Phase tracking
  phase: 'EXPLORE' | 'DEEP_OFFER' | 'DEEPEN' | 'DATA_COLLECTION';
  topicIndex: number;
  turnInTopic: number;

  // Budget tracking
  topicBudgets: Record<string, {
    minTurns: number;
    baseTurns: number;
    maxTurns: number;
    turnsUsed: number;
    bonusTurnsGranted: number;
  }>;
  turnsUsedTotal: number;
  turnsBudgetTotal: number;

  // Coverage tracking
  topicSubGoalHistory: Record<string, string[]>;
  uncoveredTopics: string[];  // Topic IDs with remaining subgoals → for DEEPEN

  // Signal tracking
  topicEngagementScores: Record<string, number>;
  topicKeyInsights: Record<string, string>;  // Best snippet per topic
  lastSignalScore: number;

  // Extension
  deepAccepted: boolean | null;
  extensionOfferAttempts: number;

  // Data collection (unchanged)
  consentGiven: boolean | null;
  dataCollectionRefused: boolean;
  forceConsentQuestion: boolean;
  fieldAttemptCounts: Record<string, number>;
  dataCollectionAttempts: number;

  // Safety
  recentBridgeStems: string[];
  closureAttempts: number;
  clarificationTurnsByTopic: Record<string, number>;

  // Early exit
  forceEarlyClosureFromUser: boolean;
}
```

### 9.2 Supervisor Insight v2

Simplified status set:

```typescript
type SupervisorStatusV2 =
  | 'EXPLORING'                 // Normal EXPLORE turn
  | 'EXPLORING_DEEP'            // Bonus turn (high signal)
  | 'TRANSITION'                // Moving to next topic
  | 'DEEPENING'                 // DEEPEN phase turn
  | 'DEEP_OFFER_ASK'            // Asking extension consent
  | 'DATA_COLLECTION_CONSENT'   // Asking data consent
  | 'DATA_COLLECTION'           // Requesting specific field
  | 'COMPLETE_WITHOUT_DATA'     // Closing without data
  | 'FINAL_GOODBYE';            // All done

// Removed: SCANNING (renamed EXPLORING), START_DEEP (absorbed into DEEPENING),
// START_DEEP_BRIEF (unused), CONFIRM_STOP (unused)
```

---

## 10. Migration Strategy

### 10.1 What Changes

| Component | Action |
|-----------|--------|
| `route.ts` (state machine) | Rewrite phase logic: EXPLORE with elastic turns, signal-driven budget |
| `route.ts` (post-processing) | Remove 10+ layers, consolidate to 5 |
| `route.ts` (prompt assembly) | Remove 8 runtime blocks, replace with 2 consolidated blocks |
| `prompt-builder.ts` | Rewrite: 7 blocks instead of 6+7 runtime. Zero redundancy. |
| `plan-service.ts` | Add intelligence fields to plan generation |
| `plan-types.ts` | Update `PlanTopic` with intelligence fields |
| `interview-supervisor.ts` | Simplify status set, remove unused statuses |
| `micro-planner.ts` | Merge into Turn Guidance prompt block (simpler logic) |
| `memory-manager.ts` | Add key insights per topic |
| `qualitative-evaluator.ts` | Remove (replaced by prompt quality) |
| `quality-pipeline.ts` | Remove (replaced by prompt quality) |
| `topic-anchors.ts` | Remove anchor drift logic (keep `buildMessageAnchors` for duplicate detection only) |
| `runtime-knowledge.ts` | Simplify: only manual knowledge formatting. Runtime generation moves to plan-service. |

### 10.2 What Stays Unchanged

| Component | Reason |
|-----------|--------|
| DATA_COLLECTION flow | Working well, well-tested |
| Reward system | Frontend + backend working |
| `interview-chat.tsx` (frontend) | No changes needed |
| `detectExplicitClosureIntent()` | User closure detection stays |
| `checkUserIntent()` | Intent classification stays |
| `findDuplicateQuestionMatch()` | Duplicate detection stays |
| Database schema | No schema changes (plan stored as JSON) |

### 10.3 Implementation Phases

**Phase 1: Foundation** (plan + state + prompt)
- Update `plan-types.ts` with v2 schema
- Update `plan-service.ts` with intelligence generation
- Rewrite `prompt-builder.ts` with 7 consolidated blocks
- Update `InterviewState` to v2
- Update supervisor status set

**Phase 2: EXPLORE Phase** (core flow)
- Rewrite EXPLORE logic in `route.ts` with elastic turns
- Implement signal score computation
- Implement budget stealing
- Wire up new prompt builder

**Phase 3: DEEPEN Phase + DEEP_OFFER**
- Implement DEEPEN as residual phase
- Adapt DEEP_OFFER transition logic
- Add EXPLORE context recap in DEEPEN prompts

**Phase 4: Post-Processing Cleanup**
- Remove 10+ old layers
- Implement 5 consolidated safety nets
- Remove dead code (quality-pipeline.ts, qualitative-evaluator.ts, etc.)

**Phase 5: Memory Enhancement**
- Add key insights tracking per topic
- Update memory formatting for prompt
- Wire into DEEPEN context

**Phase 6: Testing & Validation**
- End-to-end interview testing
- Edge case validation (time boundaries, empty topics, user closure)
- Latency benchmarking

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prompt quality regression without quality gates | AI produces worse responses | Invest in prompt consolidation quality; monitor first 50 interviews |
| Budget stealing creates topic starvation | Last topics never explored | Floor: every topic gets `minTurns = 1` guaranteed |
| Signal score too aggressive | Skips topics the user cared about | Conservative thresholds (< 0.3 for LOW is very brief) |
| DEEPEN feels like a reset | User confused by topic revisit | Prompt includes explicit context recap from EXPLORE |
| Pre-generated intelligence stale | Plan intelligence doesn't match actual conversation | Intelligence is guidance, not prescription; prompt says "use naturally" |
| Fewer post-processing layers miss edge cases | Rare bad responses slip through | Closure Guard catches the critical cases; monitor and add layers only if data shows need |

---

## 12. Success Criteria

1. **Naturalness**: conversations feel like talking to a skilled interviewer, not a form
2. **Coverage**: all topics get at least `minTurns` coverage
3. **Depth on interesting topics**: topics with HIGH signal get demonstrably more exploration
4. **Latency**: p95 response time < 8s (vs current ~12s)
5. **Token efficiency**: average input tokens per turn < 2,500 (vs current ~4,100)
6. **No regressions**: DATA_COLLECTION flow works identically
7. **No premature closure**: interviews don't end before time budget
8. **No infinite loops**: all loop prevention mechanisms preserved

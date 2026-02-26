# Interview Flow v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the interview conversation flow from rigid turn-based to adaptive elastic exploration with consolidated prompts and minimal post-processing.

**Architecture:** Deterministic state machine with adaptive turn budgets driven by signal scores. EXPLORE phase covers topics with elastic depth (1-4 turns per topic), DEEPEN handles coverage gaps. Prompt consolidated from 15 to 7 blocks. Post-processing reduced from 15+ to 5 safety nets.

**Tech Stack:** TypeScript, Next.js API routes, Vercel AI SDK (`generateObject`/`generateText`), Prisma ORM, OpenAI/Anthropic LLM providers

**Design Doc:** `docs/plans/2026-02-23-interview-flow-v2-design.md`

---

## Task 1: Create Feature Branch

**Files:**
- None (git operation only)

**Step 1: Create and push feature branch**

```bash
git checkout main
git pull origin main
git checkout -b feat/interview-flow-v2
git push -u origin feat/interview-flow-v2
```

**Step 2: Commit**

No commit needed — branch creation only.

---

## Task 2: Update Plan Types (InterviewPlanV2)

**Files:**
- Modify: `src/lib/interview/plan-types.ts` (42 lines — full rewrite)

**Step 1: Read current plan-types.ts**

Read `src/lib/interview/plan-types.ts` to understand current `InterviewPlan`, `PlanTopic`, `InterviewPlanOverrides` types.

**Step 2: Update PlanTopic with intelligence fields and baseTurns**

Add `baseTurns` field and pre-generated intelligence fields to `PlanTopic`:

```typescript
// In PlanTopic type, add these fields:
baseTurns: number;              // NEW: default turn allocation (2)
interpretationCues: string[];   // NEW: how to read user answers
significanceSignals: string[];  // NEW: signs worth deepening
probeAngles: string[];          // NEW: follow-up directions
```

**Step 3: Update InterviewPlan structure**

Rename `scan` → `explore`, `deep` → `deepen` in the plan structure:

```typescript
// OLD:
scan: { topics: PlanTopic[] };
deep: { strategy: string; maxTurnsPerTopic: number; fallbackTurns: number; topics: PlanTopic[] };

// NEW:
explore: { topics: PlanTopic[] };
deepen: { maxTurnsPerTopic: number; fallbackTurns: number; };
```

Note: `deepen.topics` is removed — DEEPEN topics are computed at runtime from EXPLORE coverage gaps. The plan only needs to know max turns per topic.

Update `InterviewPlanOverrides` similarly (rename `scan` → `explore`, `deep` → `deepen`).

Bump `planLogicVersion` to `'2.0'` in meta.

**Step 4: Commit**

```bash
git add src/lib/interview/plan-types.ts
git commit -m "feat(interview-v2): update plan types with intelligence fields and explore/deepen phases"
```

---

## Task 3: Update Plan Service (Intelligence Pre-Generation)

**Files:**
- Modify: `src/lib/interview/plan-service.ts` (274 lines)
- Read: `src/lib/interview/runtime-knowledge.ts:206` (`generateRuntimeInterviewKnowledge` — logic to reuse)

**Step 1: Read current plan-service.ts and runtime-knowledge.ts**

Read both files fully. Understand:
- `buildBaseInterviewPlan()` at line 14: current budget calculation
- `generateRuntimeInterviewKnowledge()` at runtime-knowledge.ts:206: LLM call that generates per-topic intelligence

**Step 2: Update buildBaseInterviewPlan() with baseTurns and intelligence**

In `buildBaseInterviewPlan()`:

1. Add `baseTurns` calculation:
```typescript
const baseTurns = Math.max(2, Math.floor(perTopicTimeSec / SECONDS_PER_TURN));
const maxTurns = baseTurns + 2;
const minTurns = 1;
```

2. Rename `scan` → `explore` in return object, remove `deep.topics` (topics computed at runtime).

3. Set intelligence fields to empty arrays initially (filled in step 3).

**Step 3: Add generatePlanIntelligence() function**

Create a new function that calls the LLM once to generate intelligence for all topics. Reuse the schema and prompt from `generateRuntimeInterviewKnowledge()` in `runtime-knowledge.ts:206-316`.

```typescript
async function generatePlanIntelligence(
  topics: { id: string; label: string; subGoals: string[] }[],
  researchGoal: string,
  language: string
): Promise<Record<string, { interpretationCues: string[]; significanceSignals: string[]; probeAngles: string[] }>>
```

This is called during `getOrCreateInterviewPlan()` after building the base plan.

**Step 4: Update getOrCreateInterviewPlan() to include intelligence**

After `buildBaseInterviewPlan()`, call `generatePlanIntelligence()` and merge results into `plan.explore.topics[].interpretationCues/significanceSignals/probeAngles`.

Update `planLogicVersion` check to `'2.0'` so existing plans get regenerated.

**Step 5: Update mergeInterviewPlan() and sanitizeOverrides()**

Rename `scan` → `explore`, `deep` → `deepen` in merge logic and override sanitization.

**Step 6: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors (or only pre-existing ones unrelated to our changes).

**Step 7: Commit**

```bash
git add src/lib/interview/plan-service.ts
git commit -m "feat(interview-v2): plan service with intelligence pre-generation and explore/deepen phases"
```

---

## Task 4: Update Supervisor Types

**Files:**
- Modify: `src/lib/interview/interview-supervisor.ts:3-27` (types only, keep runDeepOfferPhase)

**Step 1: Read current interview-supervisor.ts**

Read the full file (214 lines). Note `SupervisorStatus` at line 3, `SupervisorInsight` at line 16.

**Step 2: Update SupervisorStatus type**

Replace the current status set with v2:

```typescript
type SupervisorStatus =
  | 'EXPLORING'                 // Normal EXPLORE turn
  | 'EXPLORING_DEEP'            // Bonus turn (high signal)
  | 'TRANSITION'                // Moving to next topic
  | 'DEEPENING'                 // DEEPEN phase turn
  | 'DEEP_OFFER_ASK'            // Asking extension consent
  | 'DATA_COLLECTION_CONSENT'   // Asking data consent
  | 'DATA_COLLECTION'           // Requesting specific field
  | 'COMPLETE_WITHOUT_DATA'     // Closing without data
  | 'FINAL_GOODBYE';            // All done
```

Removed: `SCANNING`, `START_DEEP`, `START_DEEP_BRIEF`, `CONFIRM_STOP`.

**Step 3: Update createDefaultSupervisorInsight()**

Change default status from `'SCANNING'` to `'EXPLORING'`.

**Step 4: Update runDeepOfferPhase()**

Keep logic intact — only update status references if any used removed statuses. The function at line 97 should work as-is since it uses `DEEP_OFFER_ASK` which is preserved.

**Step 5: Commit**

```bash
git add src/lib/interview/interview-supervisor.ts
git commit -m "feat(interview-v2): simplify supervisor status set for v2 phases"
```

---

## Task 5: Implement Signal Score

**Files:**
- Create: `src/lib/interview/signal-score.ts`

**Step 1: Read existing computeEngagementScore()**

Read `src/app/api/chat/route.ts:155-188` to understand the current engagement score logic.

**Step 2: Create signal-score.ts**

Create a dedicated module with the refined signal score computation:

```typescript
// src/lib/interview/signal-score.ts

const IMPACT_KEYWORDS_IT = /\b(problema|importante|critico|criticità|impatto|sfida|difficoltà|fondamentale|essenziale|urgente|grave|complesso)\b/i;
const IMPACT_KEYWORDS_EN = /\b(problem|important|critical|impact|challenge|difficulty|fundamental|essential|urgent|serious|complex)\b/i;

const EMOTION_MARKERS_IT = /\b(amo|odio|frustrante|fantastico|terribile|incredibile|assurdo|pazzesco|entusiasta|deluso|soddisfatto|arrabbiato)\b/i;
const EMOTION_MARKERS_EN = /\b(love|hate|frustrating|amazing|terrible|incredible|absurd|crazy|excited|disappointed|satisfied|angry)\b/i;

export type SignalBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SignalResult {
  score: number;       // 0-1
  band: SignalBand;    // LOW (<0.3), MEDIUM (0.3-0.6), HIGH (>0.6)
  snippet: string;     // Best ~20 word snippet for key insight tracking
}

export function computeSignalScore(userMessage: string, language: string): SignalResult {
  const words = userMessage.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const isItalian = language.toLowerCase().startsWith('it');

  // Length component (0-0.4)
  const lengthScore = Math.min(0.4, wordCount / 100);

  // Content richness (0-0.3)
  const hasExamples = /\d|[A-Z][a-z]{2,}/.test(userMessage) ? 0.15 : 0;
  const impactPattern = isItalian ? IMPACT_KEYWORDS_IT : IMPACT_KEYWORDS_EN;
  const hasImpact = impactPattern.test(userMessage) ? 0.15 : 0;
  const richnessScore = hasExamples + hasImpact;

  // Engagement markers (0-0.3)
  const emotionPattern = isItalian ? EMOTION_MARKERS_IT : EMOTION_MARKERS_EN;
  const hasEmotions = emotionPattern.test(userMessage) ? 0.15 : 0;
  const hasDetail = wordCount > 30 ? 0.15 : 0;
  const engagementScore = hasEmotions + hasDetail;

  const score = Math.min(1, lengthScore + richnessScore + engagementScore);
  const band: SignalBand = score < 0.3 ? 'LOW' : score <= 0.6 ? 'MEDIUM' : 'HIGH';

  // Extract best snippet (~20 words from the richest sentence)
  const sentences = userMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const bestSentence = sentences.length > 0
    ? sentences.reduce((best, s) => s.split(/\s+/).length > best.split(/\s+/).length ? s : best)
    : userMessage;
  const snippet = bestSentence.trim().split(/\s+/).slice(0, 20).join(' ');

  return { score, band, snippet };
}

export function computeBudgetAction(
  signalBand: SignalBand,
  turnsUsed: number,
  budget: { minTurns: number; baseTurns: number; maxTurns: number; bonusTurnsGranted: number }
): 'continue' | 'advance' | 'bonus' {
  if (signalBand === 'LOW' && turnsUsed >= budget.minTurns) {
    return 'advance';
  }
  if (signalBand === 'HIGH' && turnsUsed < budget.maxTurns && budget.bonusTurnsGranted < 2) {
    return 'bonus';
  }
  if (turnsUsed >= budget.baseTurns) {
    return 'advance';
  }
  return 'continue';
}

export function stealBonusTurn(
  currentTopicId: string,
  topicBudgets: Record<string, { maxTurns: number; turnsUsed: number; bonusTurnsGranted: number }>
): string | null {
  // Find the unexplored topic with the highest maxTurns to steal from
  let donorId: string | null = null;
  let donorMax = 0;
  for (const [id, budget] of Object.entries(topicBudgets)) {
    if (id === currentTopicId) continue;
    if (budget.turnsUsed > 0) continue; // Already explored, can't steal from it
    if (budget.maxTurns > donorMax) {
      donorMax = budget.maxTurns;
      donorId = id;
    }
  }
  if (donorId && donorMax > 1) {
    // Can steal: donor still has margin above minTurns=1
    return donorId;
  }
  return null; // No donor available
}
```

**Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/interview/signal-score.ts
git commit -m "feat(interview-v2): add signal score module with budget adaptation logic"
```

---

## Task 6: Rewrite Prompt Builder (7 Consolidated Blocks)

**Files:**
- Modify: `src/lib/llm/prompt-builder.ts` (663 lines — major rewrite)

This is the largest single task. The prompt builder goes from 9 methods + `build()` to 7 focused blocks with zero redundancy.

**Step 1: Read current prompt-builder.ts fully**

Read all 663 lines. Map which old methods map to which new blocks:
- `buildPersonaPrompt()` (L66) → Block 1: Identity
- `buildMethodologyPrompt()` (L105) → ABSORBED into Identity + Turn Guidance
- `buildContextPrompt()` (L169) → Block 2: Interview Context (merged with Plan Summary)
- `buildPlanSummary()` (L234) → ABSORBED into Interview Context
- `buildTopicPrompt()` (L277) → Block 3: Topic Focus (merged with Status Banner)
- `buildTransitionPrompt()` (L459) → DEAD CODE (never called) → DELETE
- `buildBridgePrompt()` (L527) → DEAD CODE → DELETE
- `buildSoftOfferPrompt()` (L556) → ABSORBED into Topic Focus for DEEP_OFFER status
- `build()` (L601) → Rewrite to assemble 7 blocks

**Step 2: Rewrite buildIdentityBlock() (replaces buildPersonaPrompt + rules from methodology)**

New block 1. Contains:
- Persona definition (name, role, tone)
- ALL base rules — stated ONCE:
  - One question per turn
  - No contacts outside DATA_COLLECTION
  - No CTA/promo/links
  - Every response ends with '?'
  - Language matching
- Anti-assumptions from current persona

**Step 3: Rewrite buildInterviewContextBlock() (replaces buildContextPrompt + buildPlanSummary)**

New block 2. Contains:
- Time status (elapsed / budget / remaining)
- Pacing status (ON_TRACK / BEHIND_SCHEDULE / LOW_TIME / TIME_BUDGET_REACHED)
- Topic roadmap overview (list of topics with current position marker)

**Step 4: Rewrite buildTopicFocusBlock() (replaces buildTopicPrompt + Status Banner)**

New block 3. Phase-dependent:
- EXPLORING / EXPLORING_DEEP: current topic, subgoal target, exploration instructions
- TRANSITION: next topic with natural bridge hint
- DEEPENING: topic + context recap from EXPLORE (key insight reference)
- DEEP_OFFER_ASK: extension offer instructions
- DATA_COLLECTION_CONSENT: consent request instructions
- DATA_COLLECTION: field collection instructions
- COMPLETE_WITHOUT_DATA / FINAL_GOODBYE: closure instructions with INTERVIEW_COMPLETED tag
- First turn special case: intro message injection

**Step 5: Keep buildMemoryBlock() (update formatForPrompt call)**

Block 4 — delegates to `MemoryManager.formatForPrompt()`. Will be updated in Task 9 when memory is enhanced.

**Step 6: Rewrite buildKnowledgeBlock() (replaces manual/runtime knowledge)**

New block 5. Reads from plan intelligence fields OR manual guide:
- If manual guide exists → format as prioritized guidance
- Else → format plan intelligence (interpretationCues, significanceSignals, probeAngles) for current topic

**Step 7: Rewrite build() method to assemble 7 blocks**

The `build()` method assembles blocks 1-5. Blocks 6 (Turn Guidance) and 7 (Guards) are added in route.ts at runtime since they depend on the current user message.

```typescript
async build(params): Promise<string> {
  const parts: string[] = [];
  parts.push(this.buildIdentityBlock(params));
  parts.push(this.buildInterviewContextBlock(params));
  parts.push(this.buildTopicFocusBlock(params));
  const memory = await this.buildMemoryBlock(params);
  if (memory) parts.push(memory);
  parts.push(this.buildKnowledgeBlock(params));
  return parts.join('\n\n');
}
```

**Step 8: Delete dead methods**

Remove: `buildMethodologyPrompt()`, `buildPlanSummary()`, `buildTransitionPrompt()`, `buildBridgePrompt()`, `buildSoftOfferPrompt()`.

**Step 9: Verify build compiles**

```bash
npx tsc --noEmit
```

Expect type errors in `route.ts` — that's OK, route.ts will be updated in Task 7/8.

**Step 10: Commit**

```bash
git add src/lib/llm/prompt-builder.ts
git commit -m "feat(interview-v2): rewrite prompt builder with 7 consolidated blocks, zero redundancy"
```

---

## Task 7: Update InterviewState and Route — State Model

**Files:**
- Modify: `src/app/api/chat/route.ts:70-95` (InterviewState interface)
- Modify: `src/app/api/chat/route.ts:1848` (state initialization)

**Step 1: Read current InterviewState interface at route.ts:70-95**

**Step 2: Update InterviewState to v2**

Replace the interface with `InterviewStateV2` from the design doc (section 9.1). Key changes:
- `phase` type: `'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'DATA_COLLECTION'` → `'EXPLORE' | 'DEEP_OFFER' | 'DEEPEN' | 'DATA_COLLECTION'`
- Add `topicBudgets`, `turnsUsedTotal`, `turnsBudgetTotal`
- Add `uncoveredTopics`, `topicEngagementScores`, `topicKeyInsights`, `lastSignalScore`
- Keep all DATA_COLLECTION fields unchanged

**Step 3: Update state initialization**

At the state initialization block (~line 1848), update defaults:
- `phase: 'EXPLORE'` (was `'SCAN'`)
- Initialize `topicBudgets` from plan.explore.topics
- Initialize `turnsUsedTotal: 0`, `turnsBudgetTotal` from plan
- Initialize `uncoveredTopics: []`
- Initialize signal tracking fields

**Step 4: Add backward compatibility for existing conversations**

Add a state migration function for conversations started before v2:

```typescript
function migrateStateV1ToV2(state: any): InterviewStateV2 {
  if (state.phase === 'SCAN') state.phase = 'EXPLORE';
  if (state.phase === 'DEEP') state.phase = 'DEEPEN';
  // Initialize missing v2 fields with sensible defaults
  if (!state.topicBudgets) state.topicBudgets = {};
  if (!state.uncoveredTopics) state.uncoveredTopics = [];
  // ... etc
  return state as InterviewStateV2;
}
```

**Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(interview-v2): update InterviewState to v2 with elastic budgets and signal tracking"
```

---

## Task 8: Rewrite Phase Machine (EXPLORE + DEEPEN)

**Files:**
- Modify: `src/app/api/chat/route.ts:2002-2605` (phase machine logic — major rewrite)

This is the most complex task. The SCAN+DEEP phase machine is replaced with EXPLORE+DEEPEN.

**Step 1: Read current phase machine in route.ts**

Read lines 2002-2605 carefully. Map the flow:
- L2002: `if (state.phase === 'SCAN')` — SCAN logic
- L2173: `else if (state.phase === 'DEEP_OFFER')` — DEEP_OFFER logic
- L2223: `else if (state.phase === 'DEEP')` — DEEP logic
- L2421: `else if (state.phase === 'DATA_COLLECTION')` — DATA_COLLECTION logic

**Step 2: Rewrite EXPLORE phase (replaces SCAN)**

Replace the SCAN block at L2002 with EXPLORE logic:

1. After receiving user message, compute signal score:
```typescript
import { computeSignalScore, computeBudgetAction, stealBonusTurn } from '@/lib/interview/signal-score';

const signal = computeSignalScore(lastUserMessage, language);
nextState.lastSignalScore = signal.score;
nextState.topicEngagementScores[currentTopic.id] = Math.max(
  nextState.topicEngagementScores[currentTopic.id] || 0,
  signal.score
);
if (signal.score >= 0.5 && signal.snippet) {
  nextState.topicKeyInsights[currentTopic.id] = signal.snippet;
}
```

2. Determine budget action:
```typescript
const topicBudget = nextState.topicBudgets[currentTopic.id];
const action = computeBudgetAction(signal.band, topicBudget.turnsUsed, topicBudget);
```

3. Handle actions:
- `'continue'` → increment `turnInTopic`, consume next subgoal, set `EXPLORING` status
- `'advance'` → mark uncovered subgoals, increment `topicIndex`, reset `turnInTopic`, set `TRANSITION` status
- `'bonus'` → attempt budget steal, if donor found: grant bonus turn, set `EXPLORING_DEEP` status; if no donor: treat as `'advance'`

4. At end of all topics: check `uncoveredTopics.length` and `remainingTime` to decide DEEPEN vs DEEP_OFFER vs DATA_COLLECTION.

**Step 3: Rewrite DEEPEN phase (replaces DEEP)**

Replace the DEEP block at L2223 with DEEPEN logic:

1. Topic order: iterate `uncoveredTopics` (topic IDs with remaining subgoals, ordered by engagement score desc)
2. Turn limit per topic: based on remaining subgoals count, capped by `plan.deepen.maxTurnsPerTopic`
3. Supervisor status: `DEEPENING` with key insight from EXPLORE as context
4. At end of all DEEPEN topics → DATA_COLLECTION

**Step 4: Update DEEP_OFFER transitions**

In DEEP_OFFER block (~L2173):
- On ACCEPT: transition to `DEEPEN` (was `DEEP`)
- Everything else unchanged

**Step 5: Keep DATA_COLLECTION block unchanged**

The block at L2421 stays as-is except for phase name references (`'DEEP'` → `'DEEPEN'`, `'SCAN'` → `'EXPLORE'`).

**Step 6: Remove old helper functions**

Delete:
- `buildDeepTopicOrder()` (L278) — replaced by `uncoveredTopics` ordering
- `buildDeepPlan()` (L339) — replaced by runtime DEEPEN allocation
- `selectDeepFocusPoint()` (L415) — replaced by subgoal-based focus
- `computeEngagementScore()` (L155) — replaced by signal-score.ts module

**Step 7: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(interview-v2): rewrite phase machine with EXPLORE elastic turns and DEEPEN residual"
```

---

## Task 9: Rewrite Prompt Assembly in Route (Turn Guidance + Guards)

**Files:**
- Modify: `src/app/api/chat/route.ts:2830-2964` (runtime prompt augmentation)

**Step 1: Read current runtime augmentation at route.ts:2830-2964**

This is where 8 runtime blocks are appended to the base prompt. We replace with 2 blocks.

**Step 2: Rewrite runtime prompt assembly**

Replace the 8 runtime blocks with:

**Block 6: Turn Guidance** (merges Runtime Semantic Context + Micro-Planner):
```typescript
function buildTurnGuidanceBlock(params: {
  language: string;
  phase: string;
  signalResult: SignalResult;
  lastUserMessage: string;
  previousAssistantMessage: string | null;
  recentBridgeStems: string[];
  targetTopicLabel: string;
  knowledgeCues?: { interpretationCues: string[]; significanceSignals: string[]; probeAngles: string[] };
}): string
```

Contains:
- User signal summary and depth assessment
- Opening style guidance (avoid recent stems)
- Question strategy based on signal band
- Diagnostic lens hint (optional)
- Anti-pattern list (avoid generic openers)

**Block 7: Guards** (conditional):
```typescript
function buildGuardsBlock(params: {
  userTurnSignal: 'clarification' | 'off_topic_question' | null;
  language: string;
}): string | null
```

Only included when `userTurnSignal` is detected. Returns null otherwise.

**Step 3: Remove deleted runtime blocks**

Delete from route.ts:
- `buildRuntimeSemanticContextPrompt()` (L997) — absorbed into Turn Guidance
- Intro message injection block — moved to prompt builder Topic Focus
- Status Banner block — merged into prompt builder Topic Focus
- Question Mark Enforcement block — moved to prompt builder Identity
- Old knowledge block wiring — prompt builder handles via Knowledge block

**Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(interview-v2): consolidate runtime prompt to Turn Guidance + Guards blocks"
```

---

## Task 10: Rewrite Post-Processing Pipeline (5 Safety Nets)

**Files:**
- Modify: `src/app/api/chat/route.ts:3099-3886` (post-processing pipeline — major cleanup)

**Step 1: Read current post-processing pipeline at route.ts:3099-3886**

Map all 15+ layers. Identify which stay and which are removed.

**Step 2: Implement 5 consolidated safety nets**

Replace the entire post-processing section with:

```typescript
// ═══════ POST-PROCESSING v2 (5 Safety Nets) ═══════

// Layer 1: Closure Guard (EXPLORE, DEEPEN)
if (isTopicPhase) {
  const hasQuestion = responseText.includes('?');
  const hasGoodbye = GOODBYE_PATTERNS[language].test(responseText);
  const hasCompletionTag = /INTERVIEW_COMPLETED/i.test(responseText);
  const hasPrematureContact = CONTACT_PATTERNS[language].test(responseText);
  const hasPromo = PROMO_PATTERNS.test(responseText);

  if (!hasQuestion || hasGoodbye || hasCompletionTag || hasPrematureContact || hasPromo) {
    // Single regeneration attempt
    responseText = await regenerateWithTopicFocus(/* ... temp 0.3 */);
    // If still invalid: generateQuestionOnly() fallback
    // If still invalid: hardcoded fallback
  }
}

// Layer 2: Duplicate Detector (EXPLORE, DEEPEN)
if (isTopicPhase) {
  const duplicate = findDuplicateQuestionMatch(responseText, recentQuestions);
  if (duplicate) {
    responseText = await generateQuestionOnly(/* ... */);
  }
}

// Layer 3: DEEP_OFFER Enforcer (DEEP_OFFER only)
if (nextState.phase === 'DEEP_OFFER') {
  if (!isExtensionOfferQuestion(responseText, language)) {
    responseText = await enforceDeepOfferQuestion(/* ... */);
  }
}

// Layer 4: DATA_COLLECTION Enforcer (DATA_COLLECTION only)
if (nextState.phase === 'DATA_COLLECTION') {
  // Single pass: validate consent OR field question
  // Fresh DB read for profile
  // Force-generate if invalid
}

// Layer 5: Completion Guard (all phases)
if (/INTERVIEW_COMPLETED/i.test(responseText)) {
  const action = getCompletionGuardAction(/* ... */);
  if (action === 'ask_consent') { /* block, force consent */ }
  else if (action === 'ask_missing_field') { /* block, force field */ }
  else { /* allow completion */ }
}
```

**Step 3: Delete removed layers**

Remove all code between the old post-processing markers:
- Quality gates evaluation (`evaluateInterviewQuestionQuality` calls)
- Anchor drift detection
- Clarification/off-topic regeneration
- Triple DEEP_OFFER validation (keep only single enforcer)
- Triple closure detection (keep only single guard)
- Double DATA_COLLECTION validation
- Additive fix approach (`buildAdditiveQuestionPrompt` calls)

**Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(interview-v2): consolidate post-processing to 5 safety nets, remove 10+ redundant layers"
```

---

## Task 11: Update Memory Manager with Key Insights

**Files:**
- Modify: `src/lib/memory/memory-manager.ts:158` (`formatForPrompt` method)

**Step 1: Read current memory-manager.ts**

Read the full file (210 lines). Focus on `formatForPrompt()` at line 158.

**Step 2: Update formatForPrompt() to include key insights**

Add a "Topics Explored" section that includes:
- Topic name with subgoal coverage (e.g., "3/4 subgoals")
- Engagement level (LOW/MEDIUM/HIGH based on score bands)
- Key insight snippet if available

```typescript
// In formatForPrompt(), after "Facts already collected" section:

// NEW: Topics with key insights
if (topicsExplored && topicsExplored.length > 0) {
  const isItalian = language.startsWith('it');
  parts.push(isItalian ? '## TOPICS ESPLORATI' : '## TOPICS EXPLORED');
  for (const topic of topicsExplored) {
    const engLabel = topic.engagementScore > 0.6 ? 'HIGH' : topic.engagementScore > 0.3 ? 'MEDIUM' : 'LOW';
    const coverage = `${topic.coveredSubGoals}/${topic.totalSubGoals} subgoals`;
    let line = `- ${topic.label} (${coverage}, engagement: ${engLabel})`;
    if (topic.keyInsight) {
      line += `\n  Key insight: "${topic.keyInsight}"`;
    }
    parts.push(line);
  }
}
```

**Step 3: Add TopicMemory parameter to formatForPrompt**

Update the method signature to accept topic memory data from InterviewState:

```typescript
formatForPrompt(memory: InterviewMemory, options?: {
  language?: string;
  topicMemories?: Array<{
    label: string;
    engagementScore: number;
    keyInsight?: string;
    coveredSubGoals: number;
    totalSubGoals: number;
  }>;
}): string
```

**Step 4: Commit**

```bash
git add src/lib/memory/memory-manager.ts
git commit -m "feat(interview-v2): add key insights per topic to memory prompt formatting"
```

---

## Task 12: Remove Dead Code

**Files:**
- Delete: `src/lib/interview/qualitative-evaluator.ts` (175 lines)
- Delete: `src/lib/interview/quality-pipeline.ts` (71 lines)
- Modify: `src/lib/interview/topic-anchors.ts` — remove `responseMentionsAnchors()` and anchor drift helpers (keep `buildMessageAnchors` for duplicate detection)
- Modify: `src/lib/interview/runtime-knowledge.ts` — remove `generateRuntimeInterviewKnowledge()` and `buildRuntimeKnowledgePromptBlock()` (keep `buildManualKnowledgePromptBlock`)
- Modify: `src/lib/interview/micro-planner.ts` — simplify or remove (logic absorbed into Turn Guidance block)

**Step 1: Delete qualitative-evaluator.ts and quality-pipeline.ts**

```bash
rm src/lib/interview/qualitative-evaluator.ts
rm src/lib/interview/quality-pipeline.ts
```

**Step 2: Clean up topic-anchors.ts**

Remove `responseMentionsAnchors()` and `buildTopicAnchors()`. Keep `buildMessageAnchors()` (used by duplicate detection).

**Step 3: Clean up runtime-knowledge.ts**

Remove:
- `generateRuntimeInterviewKnowledge()` (moved to plan-service.ts)
- `buildRuntimeKnowledgePromptBlock()` (replaced by Knowledge block in prompt builder)
- Related types and helpers for runtime generation

Keep:
- `buildManualKnowledgePromptBlock()` (still used for manual interview guides)
- `extractManualInterviewGuideSource()` (helper for manual guide)

**Step 4: Simplify or remove micro-planner.ts**

If Turn Guidance block in route.ts fully replaces micro-planner logic, delete the file.
If some utility functions are still useful (e.g., `determineQuestionMode`), extract them to signal-score.ts or route.ts.

**Step 5: Search for broken imports**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Fix any import errors from deleted files.

**Step 6: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(interview-v2): remove dead code — quality gates, anchor drift, runtime knowledge generation"
```

---

## Task 13: Wire Everything Together

**Files:**
- Modify: `src/app/api/chat/route.ts` (multiple sections — final wiring)

**Step 1: Update PromptBuilder.build() call site**

At the prompt assembly section (~L2830), update the `PromptBuilder.build()` call to pass v2 parameters:
- `supervisorInsight` with v2 status types
- Plan intelligence from `interviewPlan.explore.topics`
- Signal result for Turn Guidance block

**Step 2: Wire signal score into state updates**

After the phase machine section, ensure signal score results are persisted to state:
```typescript
nextState.topicEngagementScores[currentTopic.id] = signal.score;
if (signal.score >= 0.5) {
  nextState.topicKeyInsights[currentTopic.id] = signal.snippet;
}
nextState.lastSignalScore = signal.score;
```

**Step 3: Wire topic memory into MemoryManager.formatForPrompt()**

When calling `formatForPrompt`, pass topic memories from state:

```typescript
const topicMemories = botTopics.map(t => ({
  label: t.label,
  engagementScore: state.topicEngagementScores[t.id] || 0,
  keyInsight: state.topicKeyInsights[t.id],
  coveredSubGoals: (state.topicSubGoalHistory[t.id] || []).length,
  totalSubGoals: t.subGoals?.length || 0,
}));
const memoryBlock = memoryManager.formatForPrompt(memory, { language, topicMemories });
```

**Step 4: Wire plan intelligence into prompt builder Knowledge block**

Pass `plan.explore.topics[currentTopicIndex]` intelligence fields to prompt builder.

**Step 5: Update all phase name string comparisons**

Global search-and-replace in route.ts:
- `'SCAN'` → `'EXPLORE'` (in string comparisons for phase)
- `'DEEP'` → `'DEEPEN'` (in string comparisons for phase — careful not to hit `'DEEP_OFFER'`)
- `'SCANNING'` → `'EXPLORING'` (supervisor status)
- `'START_DEEP'` → `'DEEPENING'` (supervisor status)

**Step 6: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(interview-v2): wire signal score, topic memory, and plan intelligence into prompt pipeline"
```

---

## Task 14: Update Phase Flow Guards

**Files:**
- Modify: `src/lib/interview/phase-flow.ts` (59 lines)

**Step 1: Read current phase-flow.ts**

**Step 2: Update phase name references**

- `shouldInterceptTopicPhaseClosure()`: change `'SCAN' || 'DEEP'` → `'EXPLORE' || 'DEEPEN'`
- `shouldInterceptDeepOfferClosure()`: keep `'DEEP_OFFER'` (unchanged)
- `getCompletionGuardAction()`: no changes needed (phase-independent)

**Step 3: Commit**

```bash
git add src/lib/interview/phase-flow.ts
git commit -m "feat(interview-v2): update phase-flow guards with v2 phase names"
```

---

## Task 15: End-to-End Smoke Test

**Files:**
- None (testing only)

**Step 1: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Verify Next.js build**

```bash
npm run build
```

Expected: successful build.

**Step 3: Start dev server and test manually**

```bash
npm run dev
```

Test with a real interview:
1. Create a bot with 3 topics, 5 min duration
2. Start an interview
3. Verify: first message is intro greeting
4. Give a brief answer → verify topic advances faster (LOW signal)
5. Give a rich answer → verify topic gets bonus turn (HIGH signal)
6. Complete EXPLORE → verify DEEP_OFFER appears if time exceeded
7. Verify DATA_COLLECTION works unchanged
8. Verify interview completes with INTERVIEW_COMPLETED

**Step 4: Check latency in browser network tab**

Measure response times. Expected: p50 < 5s, p95 < 8s.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(interview-v2): address smoke test findings"
```

---

## Task 16: Final Cleanup and PR

**Files:**
- Modify: `docs/plans/2026-02-23-interview-flow-v2-design.md` (update branch name)

**Step 1: Update design doc branch name**

Change `Branch: TBD` → `Branch: feat/interview-flow-v2`

**Step 2: Push and create PR**

```bash
git push origin feat/interview-flow-v2
gh pr create --title "feat: interview flow v2 — adaptive EXPLORE + consolidated prompt" --body "$(cat <<'EOF'
## Summary
- Replace rigid SCAN+DEEP with adaptive EXPLORE+DEEPEN phases
- Elastic turn budgets driven by signal scores (LOW/MEDIUM/HIGH)
- Consolidate prompt from 15 to 7 instruction blocks (zero redundancy)
- Reduce post-processing from 15+ layers to 5 essential safety nets
- Pre-generate topic intelligence in interview plan (saves 1 LLM call per interview)
- Add key insight tracking per topic in memory

## Key Metrics
- Prompt tokens: ~4,100 → ~2,300 (-44%)
- LLM calls per turn: 3-6 → 1-2 (-60/80%)
- Latency: 5-14s → 3-10s (-30/40%)

## Design Doc
See `docs/plans/2026-02-23-interview-flow-v2-design.md`

## Test Plan
- [ ] TypeScript compilation passes
- [ ] Next.js build succeeds
- [ ] Manual interview test with 3 topics, 5 min duration
- [ ] Verify LOW signal advances topic quickly
- [ ] Verify HIGH signal grants bonus turns
- [ ] Verify DEEP_OFFER appears when time exceeded
- [ ] Verify DATA_COLLECTION works unchanged
- [ ] Verify interview completes correctly
- [ ] Latency check: p50 < 5s, p95 < 8s

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Dependency Graph

```
Task 1: Branch
  ↓
Task 2: Plan Types ──→ Task 3: Plan Service
  ↓                        ↓
Task 4: Supervisor Types   Task 5: Signal Score
  ↓                        ↓
Task 6: Prompt Builder ←───┘
  ↓
Task 7: InterviewState
  ↓
Task 8: Phase Machine ←── Task 5: Signal Score
  ↓
Task 9: Prompt Assembly (Turn Guidance + Guards)
  ↓
Task 10: Post-Processing
  ↓
Task 11: Memory Manager
  ↓
Task 12: Dead Code Removal
  ↓
Task 13: Wire Everything Together
  ↓
Task 14: Phase Flow Guards
  ↓
Task 15: Smoke Test
  ↓
Task 16: Cleanup + PR
```

**Parallelizable groups:**
- Tasks 2, 4, 5 can run in parallel (no dependencies on each other)
- Task 3 depends on Task 2
- Task 6 depends on Tasks 2, 4, 5
- Tasks 7-14 are sequential (each builds on previous)

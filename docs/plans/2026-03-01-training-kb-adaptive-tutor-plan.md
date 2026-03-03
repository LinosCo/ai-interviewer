# Training KB + Adaptive Socratic Tutor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the linear CHECKING→QUIZZING per-topic loop with a multi-turn Socratic DIALOGUING phase, add a FINAL_QUIZZING phase at course end, and add a knowledge base upload UI for TrainingBot.

**Architecture:** New `DIALOGUING` phase runs configurable min/max Socratic turns per topic with silent comprehension evaluation after each turn. After all topics, `FINAL_QUIZZING` generates a weighted quiz across all topics. KB sources for training bots are stored in `KnowledgeSource` (via `trainingBotId`) and aggregated into prompts. All new phases are backward compatible — old sessions remain readable.

**Tech Stack:** Prisma (PostgreSQL + enum ALTER), Next.js App Router (API Routes + Server Components), AI SDK (`generateText`/`generateObject`), Zod, Vitest, React + Tailwind.

---

## Task 1: DB Migration — new enum values + topic turn fields + nullable botId

**Files:**
- Create: `prisma/migrations/20260301_training_dialogue_kb/migration.sql`
- Modify: `prisma/schema.prisma`

### Step 1: Create migration SQL

```sql
-- prisma/migrations/20260301_training_dialogue_kb/migration.sql
-- Idempotent migration for training dialogue + KB features

-- 1. Make KnowledgeSource.botId nullable
--    (training bot KB sources have trainingBotId but no regular botId)
ALTER TABLE "KnowledgeSource" ALTER COLUMN "botId" DROP NOT NULL;

-- 2. Add dialogue turn limits to TrainingTopicBlock
ALTER TABLE "TrainingTopicBlock"
  ADD COLUMN IF NOT EXISTS "minCheckingTurns" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "maxCheckingTurns" INTEGER NOT NULL DEFAULT 6;

-- 3. Add new TrainingPhase enum values
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'DIALOGUING';
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'FINAL_QUIZZING';
```

### Step 2: Update Prisma schema

In `prisma/schema.prisma`, make these three changes:

**Change A** — `KnowledgeSource.botId` → nullable:
```prisma
model KnowledgeSource {
  id        String                       @id @default(cuid())
  botId     String?                      // WAS: String (NOT NULL)
  type      String
  title     String?
  content   String
  embedding Unsupported("vector(1536)")?
  createdAt DateTime                     @default(now())
  bot       Bot?                         @relation(fields: [botId], references: [id], onDelete: Cascade)
  // ... trainingBotId, trainingBot unchanged
}
```

**Change B** — `TrainingTopicBlock` new fields (add after `maxRetriesOverride`):
```prisma
  minCheckingTurns   Int     @default(2)
  maxCheckingTurns   Int     @default(6)
```

**Change C** — `TrainingPhase` enum (add after `DATA_COLLECTION`):
```prisma
enum TrainingPhase {
  EXPLAINING
  CHECKING
  QUIZZING
  EVALUATING
  RETRYING
  DATA_COLLECTION
  DIALOGUING
  FINAL_QUIZZING
  COMPLETE
}
```

### Step 3: Register migration + regenerate client

```bash
cd /Users/tommycinti/Documents/ai-interviewer/ai-interviewer
npx prisma migrate resolve --applied 20260301_training_dialogue_kb
npm run db:generate
```

Expected: Prisma client regenerated with new enum values and model fields.

### Step 4: Verify Prisma client has new types

```bash
node -e "const {TrainingPhase} = require('@prisma/client'); console.log(Object.keys(TrainingPhase))"
```

Expected output includes: `DIALOGUING`, `FINAL_QUIZZING`.

### Step 5: Commit

```bash
git add prisma/schema.prisma prisma/migrations/20260301_training_dialogue_kb/
git commit -m "feat(db): add DIALOGUING/FINAL_QUIZZING phases, topic turn limits, nullable KB botId"
```

---

## Task 2: Extend training-types.ts

**Files:**
- Modify: `src/lib/training/training-types.ts`

### Step 1: Write failing test

Create `src/lib/training/__tests__/training-types.test.ts`:

```typescript
// src/lib/training/__tests__/training-types.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type {
  TrainingPhaseType,
  QuizQuestion,
  ComprehensionEntry,
  DialogueTopicResult,
  TrainingSupervisorState,
} from '../training-types'

describe('TrainingPhaseType', () => {
  it('includes DIALOGUING and FINAL_QUIZZING', () => {
    const phase: TrainingPhaseType = 'DIALOGUING'
    expectTypeOf(phase).toMatchTypeOf<TrainingPhaseType>()
    const phase2: TrainingPhaseType = 'FINAL_QUIZZING'
    expectTypeOf(phase2).toMatchTypeOf<TrainingPhaseType>()
  })
})

describe('QuizQuestion', () => {
  it('accepts OPEN_ANSWER type with expectedKeyPoints', () => {
    const q: QuizQuestion = {
      id: '1',
      type: 'OPEN_ANSWER',
      question: 'Explain X',
      expectedKeyPoints: ['point A', 'point B'],
    }
    expectTypeOf(q).toMatchTypeOf<QuizQuestion>()
  })

  it('accepts MULTIPLE_CHOICE with options and correctIndex', () => {
    const q: QuizQuestion = {
      id: '2',
      type: 'MULTIPLE_CHOICE',
      question: 'What is X?',
      options: ['A', 'B', 'C'],
      correctIndex: 1,
    }
    expectTypeOf(q).toMatchTypeOf<QuizQuestion>()
  })
})

describe('TrainingSupervisorState', () => {
  it('has dialogueTurns and comprehensionHistory fields', () => {
    const state: TrainingSupervisorState = {
      currentTopicIndex: 0,
      phase: 'DIALOGUING',
      retryCount: 0,
      detectedCompetenceLevel: 'INTERMEDIATE',
      adaptationDepth: 0,
      topicResults: [],
      dialogueTurns: 2,
      comprehensionHistory: [],
      dialogueTopicResults: [],
    }
    expectTypeOf(state.dialogueTurns).toBeNumber()
    expectTypeOf(state.comprehensionHistory).toBeArray()
  })
})
```

### Step 2: Run test to confirm it fails

```bash
npm run test:run -- src/lib/training/__tests__/training-types.test.ts
```

Expected: FAIL with type errors (types don't exist yet).

### Step 3: Implement the type extensions

Replace `src/lib/training/training-types.ts` with:

```typescript
// src/lib/training/training-types.ts

export type TrainingPhaseType =
  | 'EXPLAINING'
  | 'CHECKING'
  | 'QUIZZING'
  | 'EVALUATING'
  | 'RETRYING'
  | 'DATA_COLLECTION'
  | 'DIALOGUING'
  | 'FINAL_QUIZZING'
  | 'COMPLETE'

export type DetectedCompetenceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_ANSWER'
  question: string
  options?: string[]            // MULTIPLE_CHOICE and TRUE_FALSE only
  correctIndex?: number         // MULTIPLE_CHOICE and TRUE_FALSE only
  expectedKeyPoints?: string[]  // OPEN_ANSWER only
}

export interface ComprehensionEntry {
  topicIndex: number
  turn: number
  comprehensionLevel: number   // 0–100
  engagementLevel: 'high' | 'medium' | 'low'
  gaps: string[]
  understoodConcepts: string[]
  suggestedApproach: 'deepen' | 'clarify' | 'example' | 'simpler' | 'prerequisite' | 'summarize'
}

export interface DialogueTopicResult {
  topicId: string
  topicLabel: string
  finalComprehension: number   // average comprehensionLevel across all turns
  gaps: string[]               // cumulative unresolved gaps
  understoodConcepts: string[]
  turnsUsed: number
}

export interface TopicResult {
  topicId: string
  topicLabel: string
  status: 'PASSED' | 'FAILED' | 'GAP_DETECTED'
  score: number            // 0–100 weighted final
  openAnswerScore: number  // 0–100
  quizScore: number        // 0–100
  retries: number
  gaps: string[]
  feedback: string
}

export interface TrainingSupervisorState {
  currentTopicIndex: number
  phase: TrainingPhaseType
  retryCount: number
  detectedCompetenceLevel: DetectedCompetenceLevel
  adaptationDepth: number         // 0=default, 1=simpler, 2=max simple
  topicResults: TopicResult[]     // legacy: used by old CHECKING/QUIZZING flow
  // New DIALOGUING fields
  dialogueTurns: number           // current turn count in active DIALOGUING topic
  comprehensionHistory: ComprehensionEntry[]
  dialogueTopicResults: DialogueTopicResult[]   // one per completed dialogue topic
  finalQuizQuestions?: QuizQuestion[]            // set when entering FINAL_QUIZZING
  // Legacy fields (retained for backward compat with old sessions)
  pendingQuizzes?: QuizQuestion[]
  pendingCheckQuestion?: string
  pendingRetryGaps?: string[]
  dataCollectionPhase?: 'CONSENT' | 'COLLECTING' | 'DONE'
  dataCollected?: Record<string, string>
}

export interface EvaluationResult {
  score: number
  gaps: string[]
  feedback: string
}

export interface QuizEvaluationResult {
  score: number
  wrongAnswers: QuizQuestion[]
}

export interface TrainingChatResponse {
  text: string
  phase: TrainingPhaseType
  quizPayload?: { questions: QuizQuestion[] }
  topicResult?: TopicResult
  sessionComplete?: boolean
  overallScore?: number
  passed?: boolean
}

export interface RuntimeTrainingKnowledge {
  topicId: string
  topicLabel: string
  keyConceptSummary: string
  explanationCues: string[]
  commonMisconceptions: string[]
}
```

### Step 4: Run tests to confirm they pass

```bash
npm run test:run -- src/lib/training/__tests__/training-types.test.ts
```

Expected: PASS.

### Step 5: Check TypeScript

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors related to training-types.ts.

### Step 6: Commit

```bash
git add src/lib/training/training-types.ts src/lib/training/__tests__/training-types.test.ts
git commit -m "feat(types): add DIALOGUING/FINAL_QUIZZING phases, OPEN_ANSWER quiz, comprehension types"
```

---

## Task 3: New prompt functions in training-prompts.ts

**Files:**
- Modify: `src/lib/training/training-prompts.ts`
- Create: `src/lib/training/__tests__/training-prompts.test.ts`

### Step 1: Write failing tests

```typescript
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
```

### Step 2: Run tests to confirm they fail

```bash
npm run test:run -- src/lib/training/__tests__/training-prompts.test.ts
```

Expected: FAIL (functions don't exist yet).

### Step 3: Add functions to training-prompts.ts

Append to `src/lib/training/training-prompts.ts` (keep all existing functions, add at bottom):

```typescript
// ─── New: Dialogue & Final Quiz prompts ───────────────────────────────────────

import type { ComprehensionEntry, DialogueTopicResult } from './training-types'

interface DialoguePromptContext {
  topicLabel: string
  topicDescription?: string
  learningObjectives: string[]
  educationLevel: string
  competenceLevel: string
  adaptationDepth: number
  kbContent?: string
  language?: string
  dialogueTurns: number
  minCheckingTurns: number
  maxCheckingTurns: number
}

export function buildDialoguePrompt(
  ctx: DialoguePromptContext,
  turnHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  comprehensionHistory: ComprehensionEntry[]
): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  const historyLines = comprehensionHistory.map(
    (e) =>
      `  Turno ${e.turn}: comprensione ${e.comprehensionLevel}% | engagement: ${e.engagementLevel} | gaps: [${e.gaps.join(', ') || 'nessuno'}] | approccio suggerito: ${e.suggestedApproach}`
  )

  const latestApproach = comprehensionHistory.at(-1)?.suggestedApproach

  return `Sei un tutor esperto in sessioni 1-to-1 di apprendimento adattivo. ${langInstruction}

TOPIC CORRENTE: "${ctx.topicLabel}"
${ctx.topicDescription ? `Descrizione: ${ctx.topicDescription}` : ''}
OBIETTIVI: ${ctx.learningObjectives.join('; ')}
PROFILO STUDENTE: ${educationLabels[ctx.educationLevel] ?? ctx.educationLevel}, competenza ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}
TURNO: ${ctx.dialogueTurns}/${ctx.maxCheckingTurns} (minimo per avanzare: ${ctx.minCheckingTurns})

KNOWLEDGE BASE:
${ctx.kbContent ?? 'Usa conoscenza generale sull\'argomento.'}

CRONOLOGIA COMPRENSIONE (turni precedenti):
${historyLines.length > 0 ? historyLines.join('\n') : '  Primo turno — nessuna storia disponibile.'}

PRINCIPI DI CONDUZIONE (seguili sempre):
1. Una sola interazione per turno. Non fare liste di domande.
2. Risposta corretta e completa → approfondisci (livello Bloom superiore: applica, analizza, sintetizza).
3. Risposta parziale → chiedi chiarimento specifico su ciò che manca.
4. Risposta errata → non correggere direttamente. Usa domanda di ritorno ("Come mai pensi questo?"), esempio pratico, analogia, o prerequisito a monte.
5. Engagement basso (risposte brevi, monosillabi, "non so") → cambia registro: caso reale, chiedi "ha senso per te?", collega al contesto professionale.
6. Dopo ${ctx.minCheckingTurns} turni E comprensione adeguata → concludi con un breve riepilogo del topic e segnala il passaggio al prossimo argomento.

${latestApproach ? `APPROCCIO SUGGERITO (basato sull'ultimo turno): ${latestApproach}` : ''}`
}

export function buildFinalQuizSystemPrompt(
  allTopicLabels: string[],
  topicResults: DialogueTopicResult[],
  language = 'it'
): string {
  const langInstruction =
    language === 'it' ? 'Genera le domande in italiano.' : `Generate questions in ${language}.`

  const topicLines = topicResults.map(
    (r) =>
      `- ${r.topicLabel}: comprensione finale ${r.finalComprehension}% | lacune: [${r.gaps.join(', ') || 'nessuna'}]`
  )

  return `Sei un esperto di formazione. ${langInstruction}

Genera un quiz finale che copra tutti i topic del percorso formativo: ${allTopicLabels.join(', ')}.

Pesa domande e difficoltà in proporzione alle lacune rilevate nel dialogo:
${topicLines.join('\n')}

Regole per il numero e tipo di domande:
- Topic con comprensione < 60% → 2-3 domande, includi almeno una OPEN_ANSWER
- Topic con comprensione 60-85% → 2 domande MULTIPLE_CHOICE
- Topic con comprensione > 85% → 1 domanda TRUE_FALSE di conferma

Tipi disponibili: MULTIPLE_CHOICE, TRUE_FALSE, OPEN_ANSWER

Per MULTIPLE_CHOICE e TRUE_FALSE includi "options" (array di stringhe) e "correctIndex" (number).
Per OPEN_ANSWER includi "expectedKeyPoints" (array di concetti chiave attesi) — NON includere options o correctIndex.
Assegna a ogni domanda un id univoco (es. "q1", "q2", ...).`
}
```

### Step 4: Run tests

```bash
npm run test:run -- src/lib/training/__tests__/training-prompts.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add src/lib/training/training-prompts.ts src/lib/training/__tests__/training-prompts.test.ts
git commit -m "feat(prompts): add buildDialoguePrompt, buildFinalQuizSystemPrompt"
```

---

## Task 4: Update training-supervisor.ts — new state helpers

**Files:**
- Modify: `src/lib/training/training-supervisor.ts`
- Modify: `src/lib/training/__tests__/training-supervisor.test.ts`

### Step 1: Write failing tests

Add to `src/lib/training/__tests__/training-supervisor.test.ts`:

```typescript
import {
  buildInitialState,
  advanceDialogueTopic,
  // existing imports...
} from '../training-supervisor'
import type { DialogueTopicResult } from '../training-types'

describe('buildInitialState (new fields)', () => {
  it('initializes dialogueTurns and comprehensionHistory', () => {
    const state = buildInitialState()
    expect(state.dialogueTurns).toBe(0)
    expect(state.comprehensionHistory).toEqual([])
    expect(state.dialogueTopicResults).toEqual([])
  })
})

describe('advanceDialogueTopic', () => {
  const mockTopicResult: DialogueTopicResult = {
    topicId: 't1',
    topicLabel: 'Topic 1',
    finalComprehension: 75,
    gaps: [],
    understoodConcepts: ['concept A'],
    turnsUsed: 3,
  }

  it('advances to EXPLAINING for next topic when topics remain', () => {
    const state = buildInitialState()
    const { newState } = advanceDialogueTopic(state, mockTopicResult, 3)
    expect(newState.phase).toBe('EXPLAINING')
    expect(newState.currentTopicIndex).toBe(1)
    expect(newState.dialogueTurns).toBe(0)
    expect(newState.comprehensionHistory).toEqual([])
    expect(newState.dialogueTopicResults).toHaveLength(1)
  })

  it('transitions to FINAL_QUIZZING when last topic completes', () => {
    const state = buildInitialState()
    const { newState, isFinalQuiz } = advanceDialogueTopic(state, mockTopicResult, 1)
    expect(newState.phase).toBe('FINAL_QUIZZING')
    expect(isFinalQuiz).toBe(true)
    expect(newState.dialogueTopicResults).toHaveLength(1)
  })
})
```

### Step 2: Run test to confirm it fails

```bash
npm run test:run -- src/lib/training/__tests__/training-supervisor.test.ts
```

Expected: FAIL (`advanceDialogueTopic` not found, `buildInitialState` missing new fields).

### Step 3: Update training-supervisor.ts

Add new fields to `buildInitialState` and add the `advanceDialogueTopic` function:

**In `buildInitialState()`** — add three fields to the returned object:
```typescript
export function buildInitialState(): TrainingSupervisorState {
  return {
    currentTopicIndex: 0,
    phase: 'EXPLAINING',
    retryCount: 0,
    detectedCompetenceLevel: 'INTERMEDIATE',
    adaptationDepth: 0,
    topicResults: [],
    pendingQuizzes: undefined,
    pendingCheckQuestion: undefined,
    pendingRetryGaps: undefined,
    // New DIALOGUING fields
    dialogueTurns: 0,
    comprehensionHistory: [],
    dialogueTopicResults: [],
  }
}
```

**Add new function** after `buildInitialState`:
```typescript
/**
 * Advance state after completing DIALOGUING for one topic.
 * Returns updated state and whether we're transitioning to FINAL_QUIZZING.
 */
export function advanceDialogueTopic(
  state: TrainingSupervisorState,
  topicResult: DialogueTopicResult,
  totalTopics: number
): { newState: TrainingSupervisorState; isFinalQuiz: boolean } {
  const updatedResults = [...state.dialogueTopicResults, topicResult]
  const nextIndex = state.currentTopicIndex + 1

  const resetDialogueFields = {
    dialogueTurns: 0,
    comprehensionHistory: state.comprehensionHistory, // keep full history across topics
    dialogueTopicResults: updatedResults,
    pendingQuizzes: undefined,
    pendingCheckQuestion: undefined,
    pendingRetryGaps: undefined,
  }

  if (nextIndex >= totalTopics) {
    return {
      newState: {
        ...state,
        ...resetDialogueFields,
        phase: 'FINAL_QUIZZING',
      },
      isFinalQuiz: true,
    }
  }

  return {
    newState: {
      ...state,
      ...resetDialogueFields,
      currentTopicIndex: nextIndex,
      phase: 'EXPLAINING',
    },
    isFinalQuiz: false,
  }
}
```

Also add `import type { DialogueTopicResult } from './training-types'` at the top of the file.

### Step 4: Run tests

```bash
npm run test:run -- src/lib/training/__tests__/training-supervisor.test.ts
```

Expected: All pass.

### Step 5: Commit

```bash
git add src/lib/training/training-supervisor.ts src/lib/training/__tests__/training-supervisor.test.ts
git commit -m "feat(supervisor): add dialogue topic advancement + initial state for DIALOGUING"
```

---

## Task 5: Update training-service.ts — KB aggregation + EXPLAINING transition + DIALOGUING case

**Files:**
- Modify: `src/lib/training/training-service.ts`

This task has three sub-steps done in one commit.

### Step 1: Fix KB aggregation (line 84)

Replace:
```typescript
const kbContent = bot.knowledgeSources[0]?.content ?? undefined
```

With:
```typescript
const kbContent = bot.knowledgeSources.length > 0
  ? bot.knowledgeSources
      .map((s) => `## ${s.title ?? 'Fonte'}\n${s.content}`)
      .join('\n\n---\n\n')
      .slice(0, 12_000)
  : undefined
```

### Step 2: Add new imports at top of file

Add to the import block:
```typescript
import {
  buildDialoguePrompt,
  // keep existing imports
  buildExplainingPrompt,
  buildCheckingPrompt,
  buildQuizzingSystemPrompt,
  buildRetryingPrompt,
  buildFinalFeedbackPrompt,
  buildFinalQuizSystemPrompt,
} from './training-prompts'
import {
  buildInitialState,
  advanceAfterEvaluation,
  advanceDialogueTopic,
  computeOverallScore,
  computeSessionPassed,
} from './training-supervisor'
import type { TrainingSupervisorState, TrainingChatResponse, QuizQuestion, ComprehensionEntry } from './training-types'
```

### Step 3: Change EXPLAINING transition from CHECKING to DIALOGUING

In the `case 'EXPLAINING':` handler (around line 134), change:
```typescript
const newState = { ...state, phase: 'CHECKING' as const, pendingCheckQuestion: checkQuestion }
```

To:
```typescript
// DIALOGUING replaces CHECKING for new sessions
const newState = {
  ...state,
  phase: 'DIALOGUING' as const,
  dialogueTurns: 0,
}
```

And remove the `checkPrompt` / `checkResult` / `checkQuestion` generation entirely — DIALOGUING handles its own follow-up questions internally. The explanation text is returned as-is with phase DIALOGUING.

Full updated EXPLAINING/RETRYING block:
```typescript
case 'EXPLAINING':
case 'RETRYING': {
  const systemPrompt = state.phase === 'RETRYING'
    ? buildRetryingPrompt({
        topicLabel: currentTopic.label,
        topicDescription: currentTopic.description ?? undefined,
        learningObjectives: currentTopic.learningObjectives,
        educationLevel: bot.traineeEducationLevel,
        competenceLevel: state.detectedCompetenceLevel,
        adaptationDepth: state.adaptationDepth,
        kbContent,
        gaps: state.pendingRetryGaps ?? [],
        language: bot.language,
      })
    : buildExplainingPrompt({
        topicLabel: currentTopic.label,
        topicDescription: currentTopic.description ?? undefined,
        learningObjectives: currentTopic.learningObjectives,
        educationLevel: bot.traineeEducationLevel,
        competenceLevel: state.detectedCompetenceLevel,
        adaptationDepth: state.adaptationDepth,
        kbContent,
        language: bot.language,
      })

  const explainResult = await generateText({ model, system: systemPrompt, prompt: userMessage })
  await logTrainingTokens(bot.organizationId, bot.modelName, explainResult.usage, 'training-explain')

  const newState: TrainingSupervisorState = {
    ...state,
    phase: 'DIALOGUING' as const,
    dialogueTurns: 0,
  }
  await saveStateAndMessage(sessionId, newState, explainResult.text, state.phase as TrainingPhase)
  response = { text: explainResult.text, phase: 'DIALOGUING' }
  break
}
```

### Step 4: Add DIALOGUING case handler

Insert a new `case 'DIALOGUING':` block before `case 'CHECKING':` (keep CHECKING for backward compat):

```typescript
case 'DIALOGUING': {
  const minTurns = currentTopic.minCheckingTurns ?? 2
  const maxTurns = currentTopic.maxCheckingTurns ?? 6
  const newTurnCount = state.dialogueTurns + 1

  // Build conversation history from DB messages for this topic
  const topicStartPhase = 'EXPLAINING'
  const recentMessages = session.messages
    .filter((m) => m.phase === 'EXPLAINING' || m.phase === 'DIALOGUING')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const currentTopicHistory = state.comprehensionHistory.filter(
    (e) => e.topicIndex === state.currentTopicIndex
  )

  // Run tutor response + silent comprehension evaluation in parallel
  const dialogueSystemPrompt = buildDialoguePrompt(
    {
      topicLabel: currentTopic.label,
      topicDescription: currentTopic.description ?? undefined,
      learningObjectives: currentTopic.learningObjectives,
      educationLevel: bot.traineeEducationLevel,
      competenceLevel: state.detectedCompetenceLevel,
      adaptationDepth: state.adaptationDepth,
      kbContent,
      language: bot.language,
      dialogueTurns: newTurnCount,
      minCheckingTurns: minTurns,
      maxCheckingTurns: maxTurns,
    },
    recentMessages,
    currentTopicHistory
  )

  const evaluationSchema = z.object({
    comprehensionLevel: z.number().min(0).max(100),
    engagementLevel: z.enum(['high', 'medium', 'low']),
    gaps: z.array(z.string()),
    understoodConcepts: z.array(z.string()),
    readyToProgress: z.boolean(),
    suggestedApproach: z.enum(['deepen', 'clarify', 'example', 'simpler', 'prerequisite', 'summarize']),
  })

  const [tutorResult, evalResult] = await Promise.all([
    generateText({ model, system: dialogueSystemPrompt, prompt: userMessage }),
    generateObject({
      model,
      schema: z.object({ evaluation: evaluationSchema }),
      system: `Sei un valutatore silenzioso. Analizza la risposta dello studente e valuta comprensione ed engagement.
Topic: "${currentTopic.label}" | Obiettivi: ${currentTopic.learningObjectives.join('; ')}
Precedente approccio usato: ${currentTopicHistory.at(-1)?.suggestedApproach ?? 'nessuno'}`,
      prompt: `Risposta studente: "${userMessage}"\nValuta senza rispondere allo studente.`,
    }),
  ])

  await Promise.all([
    logTrainingTokens(bot.organizationId, bot.modelName, tutorResult.usage, 'training-dialogue'),
    logTrainingTokens(bot.organizationId, bot.modelName, evalResult.usage, 'training-eval'),
  ])

  const eval_ = evalResult.object.evaluation

  const newEntry: ComprehensionEntry = {
    topicIndex: state.currentTopicIndex,
    turn: newTurnCount,
    comprehensionLevel: eval_.comprehensionLevel,
    engagementLevel: eval_.engagementLevel,
    gaps: eval_.gaps,
    understoodConcepts: eval_.understoodConcepts,
    suggestedApproach: eval_.suggestedApproach,
  }

  // Should we advance?
  const shouldAdvance =
    (eval_.readyToProgress && newTurnCount >= minTurns) || newTurnCount >= maxTurns

  if (shouldAdvance) {
    // Compute final comprehension as average across this topic's turns
    const thisTopicEntries = [...currentTopicHistory, newEntry]
    const avgComp = Math.round(
      thisTopicEntries.reduce((sum, e) => sum + e.comprehensionLevel, 0) / thisTopicEntries.length
    )
    const allGaps = [...new Set(thisTopicEntries.flatMap((e) => e.gaps))]
    const allUnderstood = [...new Set(thisTopicEntries.flatMap((e) => e.understoodConcepts))]

    const dialogueTopicResult = {
      topicId: currentTopic.id,
      topicLabel: currentTopic.label,
      finalComprehension: avgComp,
      gaps: allGaps,
      understoodConcepts: allUnderstood,
      turnsUsed: newTurnCount,
    }

    const stateWithHistory: TrainingSupervisorState = {
      ...state,
      comprehensionHistory: [...state.comprehensionHistory, newEntry],
      dialogueTurns: newTurnCount,
    }

    const { newState: advancedState, isFinalQuiz } = advanceDialogueTopic(
      stateWithHistory,
      dialogueTopicResult,
      topics.length
    )

    if (isFinalQuiz) {
      // Generate comprehensive final quiz weighted by dialogue gaps
      const allTopicLabels = topics.map((t) => t.label)
      const quizResult = await generateObject({
        model,
        schema: z.object({
          questions: z.array(z.object({
            id: z.string(),
            type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'OPEN_ANSWER']),
            question: z.string(),
            options: z.array(z.string()).optional(),
            correctIndex: z.number().optional(),
            expectedKeyPoints: z.array(z.string()).optional(),
          })).min(3).max(12),
        }),
        system: buildFinalQuizSystemPrompt(
          allTopicLabels,
          advancedState.dialogueTopicResults,
          bot.language
        ),
        prompt: `Genera il quiz finale. Copri tutti i ${topics.length} topic.`,
      })
      await logTrainingTokens(bot.organizationId, bot.modelName, quizResult.usage, 'training-final-quiz-gen')

      const finalQuizQuestions = quizResult.object.questions as QuizQuestion[]
      const finalState = { ...advancedState, finalQuizQuestions }

      const quizIntro = bot.language === 'it'
        ? `Ottimo! Hai completato tutti gli argomenti del percorso. Ora verificheremo la tua comprensione con un quiz finale:`
        : `Great! You've completed all topics. Let's verify your understanding with a final quiz:`

      await saveStateAndMessage(sessionId, finalState, quizIntro, 'DIALOGUING' as TrainingPhase)
      response = {
        text: quizIntro,
        phase: 'FINAL_QUIZZING',
        quizPayload: { questions: finalQuizQuestions },
      }
    } else {
      // Advance to next topic
      const nextTopic = topics[advancedState.currentTopicIndex]
      const advanceText = bot.language === 'it'
        ? `${tutorResult.text}\n\nBene! Passiamo al prossimo argomento: "${nextTopic?.label}".`
        : `${tutorResult.text}\n\nGreat! Let's move to the next topic: "${nextTopic?.label}".`

      await saveStateAndMessage(sessionId, advancedState, advanceText, 'DIALOGUING' as TrainingPhase)
      response = { text: advanceText, phase: 'EXPLAINING' }
    }
  } else {
    // Continue dialogue
    const continuedState: TrainingSupervisorState = {
      ...state,
      dialogueTurns: newTurnCount,
      comprehensionHistory: [...state.comprehensionHistory, newEntry],
    }
    await saveStateAndMessage(sessionId, continuedState, tutorResult.text, 'DIALOGUING' as TrainingPhase)
    response = { text: tutorResult.text, phase: 'DIALOGUING' }
  }
  break
}
```

### Step 5: Add FINAL_QUIZZING case handler

Insert before `default:`:

```typescript
case 'FINAL_QUIZZING': {
  const questions = state.finalQuizQuestions ?? []
  if (questions.length === 0) {
    response = { text: 'Quiz finale non disponibile.', phase: 'FINAL_QUIZZING' }
    break
  }

  // Parse mixed answers: JSON array of (number | string)
  let answers: Array<number | string> = []
  try {
    const parsed = JSON.parse(userMessage)
    if (Array.isArray(parsed)) answers = parsed
  } catch {
    answers = new Array(questions.length).fill(0)
  }

  // Evaluate each question
  let totalScore = 0
  const allGaps: string[] = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const answer = answers[i]

    if (q.type === 'OPEN_ANSWER') {
      const result = await evaluateOpenAnswer(
        q.question,
        String(answer ?? ''),
        currentTopic?.learningObjectives ?? [],
        state.detectedCompetenceLevel,
        bot.modelName
      )
      totalScore += result.score
      allGaps.push(...result.gaps)
    } else {
      // MULTIPLE_CHOICE or TRUE_FALSE: exact index match
      const correct = typeof answer === 'number' && answer === q.correctIndex
      totalScore += correct ? 100 : 0
      if (!correct && q.question) {
        allGaps.push(`Risposta errata: "${q.question}"`)
      }
    }
  }

  const overallScore = Math.round(totalScore / Math.max(questions.length, 1))
  const passed = computeSessionPassed(state.topicResults, bot.passScoreThreshold) &&
    overallScore >= bot.passScoreThreshold

  const feedbackResult = await generateText({
    model,
    system: buildFinalFeedbackPrompt(
      state.dialogueTopicResults.map((r) => ({
        topicLabel: r.topicLabel,
        status: r.finalComprehension >= bot.passScoreThreshold ? 'PASSED' : 'GAP_DETECTED',
        score: r.finalComprehension,
        gaps: r.gaps,
      })),
      overallScore,
      passed,
      bot.language
    ),
    prompt: 'Genera il messaggio di chiusura.',
  })
  await logTrainingTokens(bot.organizationId, bot.modelName, feedbackResult.usage, 'training-final-feedback')

  const finalState: TrainingSupervisorState = { ...state, phase: 'COMPLETE' }

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      status: passed ? 'COMPLETED' : 'FAILED',
      passed,
      overallScore,
      completedAt: new Date(),
      durationSeconds: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
      topicResults: state.dialogueTopicResults as any,
      supervisorState: finalState as any,
    },
  })

  await prisma.trainingMessage.create({
    data: { trainingSessionId: sessionId, role: 'assistant', phase: 'COMPLETE', content: feedbackResult.text },
  })

  response = {
    text: feedbackResult.text,
    phase: 'COMPLETE',
    sessionComplete: true,
    overallScore,
    passed,
  }
  break
}
```

### Step 6: Check TypeScript

```bash
npx tsc --noEmit 2>&1 | grep training-service
```

Expected: no errors in training-service.ts.

### Step 7: Commit

```bash
git add src/lib/training/training-service.ts
git commit -m "feat(service): DIALOGUING + FINAL_QUIZZING handlers, multi-source KB aggregation"
```

---

## Task 6: Training KB API routes

**Files:**
- Create: `src/app/api/training-bots/[botId]/knowledge/route.ts`
- Create: `src/app/api/training-bots/[botId]/knowledge/[sourceId]/route.ts`

### Step 1: Create GET + POST route

```typescript
// src/app/api/training-bots/[botId]/knowledge/route.ts
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'

async function getBot(botId: string) {
  return prisma.trainingBot.findUnique({
    where: { id: botId },
    select: { id: true, organizationId: true },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId } = await params
    const bot = await getBot(botId)
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'VIEWER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sources = await prisma.knowledgeSource.findMany({
      where: { trainingBotId: botId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true,
        content: false as never  // exclude potentially large content
      },
    })

    // Add charCount separately
    const sourcesRaw = await prisma.knowledgeSource.findMany({
      where: { trainingBotId: botId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true, content: true },
    })

    const withCharCount = sourcesRaw.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      createdAt: s.createdAt,
      charCount: s.content.length,
    }))

    return NextResponse.json({ sources: withCharCount })
  } catch (err) {
    console.error('[training-kb GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const PostSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), title: z.string().min(1), content: z.string().min(1) }),
  z.object({ type: z.literal('text'), title: z.string().min(1), content: z.string().min(1) }),
  z.object({ type: z.literal('url'), url: z.string().url() }),
])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId } = await params
    const bot = await getBot(botId)
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'MEMBER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = PostSchema.parse(body)

    let title: string
    let content: string
    let type: string

    if (parsed.type === 'url') {
      // Scrape URL using the existing scrape endpoint pattern
      const scrapeRes = await fetch(`${process.env.NEXTAUTH_URL}/api/knowledge/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.url }),
      })
      if (!scrapeRes.ok) {
        return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 422 })
      }
      const scrapeData = await scrapeRes.json()
      title = scrapeData.title ?? parsed.url
      content = scrapeData.content ?? ''
      type = 'url'
    } else {
      title = parsed.title
      content = parsed.content
      type = parsed.type
    }

    const source = await prisma.knowledgeSource.create({
      data: {
        trainingBotId: botId,
        type,
        title,
        content,
        // botId is now nullable — training KB sources don't belong to a regular Bot
      },
    })

    return NextResponse.json({ source: { id: source.id, title: source.title, type: source.type, createdAt: source.createdAt, charCount: source.content.length } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[training-kb POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 2: Create DELETE route

```typescript
// src/app/api/training-bots/[botId]/knowledge/[sourceId]/route.ts
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; sourceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId, sourceId } = await params

    const bot = await prisma.trainingBot.findUnique({
      where: { id: botId },
      select: { organizationId: true },
    })
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'MEMBER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify source belongs to this training bot
    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, trainingBotId: botId },
    })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    await prisma.knowledgeSource.delete({ where: { id: sourceId } })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[training-kb DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 3: Check for existing scrape API

```bash
find /Users/tommycinti/Documents/ai-interviewer/ai-interviewer/src/app/api/knowledge -name "*.ts" | head -10
```

If `/api/knowledge/scrape` doesn't exist, replace the URL scrape logic in POST with a direct fetch using `cheerio` or just return the URL as the content title and skip actual scraping (leaving a TODO comment).

### Step 4: Commit

```bash
git add src/app/api/training-bots/
git commit -m "feat(api): GET/POST/DELETE training bot knowledge sources"
```

---

## Task 7: QuizRenderer — add OPEN_ANSWER branch

**Files:**
- Modify: `src/components/training/QuizRenderer.tsx`
- Modify: `src/components/training/TrainingChat.tsx`

### Step 1: Update QuizRenderer

Replace `src/components/training/QuizRenderer.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { QuizQuestion } from '@/lib/training/training-types'

interface Props {
  questions: QuizQuestion[]
  onSubmit: (answers: Array<number | string>) => void  // number for MC/TF, string for OPEN_ANSWER
  disabled?: boolean
}

export default function QuizRenderer({ questions, onSubmit, disabled }: Props) {
  const [answers, setAnswers] = useState<Array<number | string | null>>(
    new Array(questions.length).fill(null)
  )

  const allAnswered = answers.every((a) => a !== null && a !== '')

  function selectChoice(questionIdx: number, optionIdx: number) {
    if (disabled) return
    const updated = [...answers]
    updated[questionIdx] = optionIdx
    setAnswers(updated)
  }

  function setOpenAnswer(questionIdx: number, text: string) {
    if (disabled) return
    const updated = [...answers]
    updated[questionIdx] = text
    setAnswers(updated)
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return
    onSubmit(answers as Array<number | string>)
  }

  return (
    <div className="space-y-4 my-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-800 mb-3">{qi + 1}. {q.question}</p>

          {q.type === 'OPEN_ANSWER' ? (
            <textarea
              className="w-full text-sm px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 resize-none min-h-[80px] text-gray-700 placeholder:text-gray-400"
              placeholder="Scrivi la tua risposta..."
              value={typeof answers[qi] === 'string' ? (answers[qi] as string) : ''}
              onChange={(e) => setOpenAnswer(qi, e.target.value)}
              disabled={disabled}
            />
          ) : (
            <div className="space-y-2">
              {(q.options ?? []).map((opt, oi) => (
                <button
                  key={`${q.id}-${oi}`}
                  onClick={() => selectChoice(qi, oi)}
                  className={`w-full text-left text-sm px-4 py-2 rounded-lg border transition-colors ${
                    answers[qi] === oi
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={!allAnswered || disabled} className="w-full">
        Conferma risposte
      </Button>
    </div>
  )
}
```

### Step 2: Update TrainingChat.tsx handleQuizSubmit

Find `handleQuizSubmit` (line ~107) and update its type:

```typescript
function handleQuizSubmit(answers: Array<number | string>) {
  sendMessage(JSON.stringify(answers))
}
```

The `<QuizRenderer onSubmit={handleQuizSubmit} ...>` prop type will now match automatically since `QuizRenderer.onSubmit` was updated to `(answers: Array<number | string>) => void`.

### Step 3: Check TypeScript

```bash
npx tsc --noEmit 2>&1 | grep -i "quizrenderer\|handleQuizSubmit\|trainingchat" | head -10
```

Expected: no errors.

### Step 4: Commit

```bash
git add src/components/training/QuizRenderer.tsx src/components/training/TrainingChat.tsx
git commit -m "feat(ui): QuizRenderer supports OPEN_ANSWER questions with textarea"
```

---

## Task 8: TrainingKnowledgePanel component

**Files:**
- Create: `src/components/training/admin/TrainingKnowledgePanel.tsx`

### Step 1: Create the component

```typescript
// src/components/training/admin/TrainingKnowledgePanel.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Upload, FileText, Link as LinkIcon, AlertCircle } from 'lucide-react'

interface KBSource {
  id: string
  title: string | null
  type: string
  charCount: number
  createdAt: string
}

interface Props {
  botId: string
}

type InputMode = 'file' | 'text' | 'url'

const TYPE_BADGE: Record<string, string> = {
  file: 'bg-blue-50 text-blue-700 border-blue-200',
  text: 'bg-purple-50 text-purple-700 border-purple-200',
  url: 'bg-green-50 text-green-700 border-green-200',
}

export default function TrainingKnowledgePanel({ botId }: Props) {
  const [sources, setSources] = useState<KBSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<InputMode>('file')

  // Text paste fields
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  // URL field
  const [url, setUrl] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchSources() {
    try {
      const res = await fetch(`/api/training-bots/${botId}/knowledge`)
      if (!res.ok) throw new Error('Errore nel caricamento delle fonti')
      const data = await res.json()
      setSources(data.sources)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSources() }, [botId])

  async function handleFileUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const text = await file.text()
      await postSource({ type: 'file', title: file.name, content: text })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function postSource(body: object) {
    const res = await fetch(`/api/training-bots/${botId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Errore nel salvataggio')
    }
    await fetchSources()
  }

  async function handleTextSubmit() {
    if (!textTitle.trim() || !textContent.trim()) return
    setUploading(true)
    setError(null)
    try {
      await postSource({ type: 'text', title: textTitle.trim(), content: textContent.trim() })
      setTextTitle('')
      setTextContent('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) return
    setUploading(true)
    setError(null)
    try {
      await postSource({ type: 'url', url: url.trim() })
      setUrl('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Eliminare questa fonte di conoscenza?')) return
    try {
      const res = await fetch(`/api/training-bots/${botId}/knowledge/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore nella eliminazione')
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  function formatChars(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k caratteri` : `${n} caratteri`
  }

  return (
    <div className="space-y-6">
      {/* Source list */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Fonti caricate</h4>
        {loading ? (
          <p className="text-sm text-gray-400">Caricamento...</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessuna fonte ancora. Aggiungi contenuti qui sotto.</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_BADGE[s.type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {s.type}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate">{s.title ?? '(senza titolo)'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatChars(s.charCount)}</span>
                <button
                  onClick={() => deleteSource(s.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Mode tabs */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Aggiungi fonte</h4>
        <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
          {([['file', 'Carica file'], ['text', 'Incolla testo'], ['url', 'Aggiungi URL']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'file' && (
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Trascina un file qui o <span className="text-indigo-600 font-medium">sfoglia</span></p>
            <p className="text-xs text-gray-400 mt-1">Supportati: .txt, .md, .pdf, .docx</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
            />
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Titolo della fonte (es. 'Manuale HR 2025')"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
            <textarea
              placeholder="Incolla qui il contenuto della knowledge base..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none min-h-[120px]"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textTitle.trim() || !textContent.trim() || uploading}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {uploading ? 'Salvataggio...' : 'Salva testo'}
            </button>
          </div>
        )}

        {mode === 'url' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://esempio.com/pagina-da-aggiungere"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim() || uploading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {uploading ? '...' : 'Scarica'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Il contenuto della pagina verrà estratto automaticamente.</p>
          </div>
        )}
      </div>

      {uploading && (
        <p className="text-sm text-indigo-600">Elaborazione in corso...</p>
      )}
    </div>
  )
}
```

### Step 2: Commit

```bash
git add src/components/training/admin/TrainingKnowledgePanel.tsx
git commit -m "feat(ui): TrainingKnowledgePanel with file/text/URL knowledge upload"
```

---

## Task 9: Settings page — Conoscenza tab + topic turn fields

**Files:**
- Modify: `src/app/dashboard/training/[botId]/settings/page.tsx`
- Modify: `src/components/training/admin/training-bot-config-form.tsx`
- Modify: `src/app/api/training-bots/[botId]/route.ts` (UpdateBotSchema + createMany)

### Step 1: Add Conoscenza tab to settings page

Replace `src/app/dashboard/training/[botId]/settings/page.tsx` content from line 82 onwards:

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni — {bot.name}</h1>
        <p className="text-gray-500 mt-1">Modifica la configurazione del percorso formativo.</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {/* Simple anchor tab links — use search params or client state if preferred */}
        <a href={`?tab=config`} className="px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600">
          Configurazione
        </a>
        <a href={`?tab=knowledge`} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          Conoscenza
        </a>
      </div>
```

Actually, since this is a Server Component and tabs need interactivity, the cleanest approach is to use a search param `?tab=` to show/hide panels. Update the settings page like this:

```tsx
export default async function TrainingBotSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  // ... existing auth + access code ...

  const { tab } = await searchParams
  const activeTab = tab === 'knowledge' ? 'knowledge' : 'config'

  // ... existing bot fetch ...

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni — {bot.name}</h1>
        <p className="text-gray-500 mt-1">Modifica la configurazione del percorso formativo.</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'config', label: 'Configurazione' },
          { key: 'knowledge', label: 'Conoscenza' },
        ].map(({ key, label }) => (
          <a
            key={key}
            href={`?tab=${key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {activeTab === 'config' && <TrainingBotConfigForm mode="edit" bot={bot} />}

      {activeTab === 'knowledge' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Knowledge Base</h3>
          <p className="text-sm text-gray-500 mb-5">
            Carica i materiali del corso. Il tutor AI li userà come riferimento durante le lezioni.
          </p>
          <TrainingKnowledgePanel botId={bot.id} />
        </div>
      )}
    </div>
  )
}
```

Add import at top: `import TrainingKnowledgePanel from '@/components/training/admin/TrainingKnowledgePanel'`

### Step 2: Add minCheckingTurns/maxCheckingTurns to TopicDraft + form UI

In `training-bot-config-form.tsx`:

**Change 1** — Update `TopicDraft` interface:
```typescript
interface TopicDraft {
  id?: string
  label: string
  description: string
  minCheckingTurns: number
  maxCheckingTurns: number
}
```

**Change 2** — Update `useState` for topics initialization:
```typescript
const [topics, setTopics] = useState<TopicDraft[]>(
  bot?.topics.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description ?? '',
    minCheckingTurns: (t as any).minCheckingTurns ?? 2,
    maxCheckingTurns: (t as any).maxCheckingTurns ?? 6,
  })) ?? []
)
```

**Change 3** — Update `addTopic()`:
```typescript
function addTopic() {
  setTopics((prev) => [...prev, { label: '', description: '', minCheckingTurns: 2, maxCheckingTurns: 6 }])
}
```

**Change 4** — Update topics in the `PUT` request body (in the `handleSave` function):
```typescript
topics: topics.map((t, i) => ({
  id: t.id,
  label: t.label,
  description: t.description || null,
  orderIndex: i,
  minCheckingTurns: t.minCheckingTurns,
  maxCheckingTurns: t.maxCheckingTurns,
})),
```

**Change 5** — Add number inputs in the topic card UI. Find the topic card rendering block and add after the description textarea:
```tsx
{/* Dialogue turns */}
<div className="flex items-center gap-4 mt-2">
  <div className="flex-1">
    <label className="text-xs text-gray-500 mb-1 block">Turni minimi di dialogo</label>
    <input
      type="number"
      min={1}
      max={4}
      value={topic.minCheckingTurns}
      onChange={(e) =>
        setTopics((prev) =>
          prev.map((t, i) =>
            i === idx ? { ...t, minCheckingTurns: parseInt(e.target.value) || 2 } : t
          )
        )
      }
      className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
    />
  </div>
  <div className="flex-1">
    <label className="text-xs text-gray-500 mb-1 block">Turni massimi</label>
    <input
      type="number"
      min={3}
      max={12}
      value={topic.maxCheckingTurns}
      onChange={(e) =>
        setTopics((prev) =>
          prev.map((t, i) =>
            i === idx ? { ...t, maxCheckingTurns: parseInt(e.target.value) || 6 } : t
          )
        )
      }
      className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
    />
  </div>
</div>
```

### Step 3: Update UpdateBotSchema + createMany in route.ts

In `src/app/api/training-bots/[botId]/route.ts`:

**Update topics schema** (add two new optional fields):
```typescript
topics: z.array(z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  description: z.string().nullish(),
  orderIndex: z.number().int().optional(),
  minCheckingTurns: z.number().int().min(1).max(12).optional(),
  maxCheckingTurns: z.number().int().min(1).max(12).optional(),
})).optional(),
```

**Update createMany** to include new fields:
```typescript
await tx.trainingTopicBlock.createMany({
  data: topics.map((t, i) => ({
    label: t.label,
    description: t.description,
    orderIndex: t.orderIndex ?? i,
    trainingBotId: botId,
    minCheckingTurns: t.minCheckingTurns ?? 2,
    maxCheckingTurns: t.maxCheckingTurns ?? 6,
  })),
})
```

### Step 4: Check TypeScript

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

### Step 5: Commit

```bash
git add src/app/dashboard/training/ src/components/training/admin/training-bot-config-form.tsx src/app/api/training-bots/[botId]/route.ts
git commit -m "feat(ui): Conoscenza tab in settings, topic turn limits in config form"
```

---

## Task 10: Integration smoke test + build check

### Step 1: Run all tests

```bash
npm run test:run
```

Expected: All pass (no regressions in existing supervisor/evaluator tests).

### Step 2: TypeScript full check

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

### Step 3: Build check

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. Fix any errors before proceeding.

### Step 4: Check scrape API exists (for URL KB upload)

```bash
find src/app/api/knowledge -name "*.ts" | xargs grep -l "scrape" 2>/dev/null | head -3
```

If no scrape route exists, update the URL POST handler in `src/app/api/training-bots/[botId]/knowledge/route.ts` to use a direct `fetch` with `node-html-parser` or to return a stub. Add a TODO comment:

```typescript
// TODO: integrate with scrape API when available
// For now, store the URL as content title and prompt user to paste content manually
title = parsed.url
content = `URL fonte: ${parsed.url}\n\n(Contenuto non estratto automaticamente — incolla il testo manualmente.)`
type = 'url'
```

### Step 5: Final commit

```bash
git add -A
git commit -m "chore: post-integration smoke test fixes"
```

---

## Summary of commits

| # | Commit message | Files |
|---|---|---|
| 1 | `feat(db): add DIALOGUING/FINAL_QUIZZING phases, topic turn limits, nullable KB botId` | `prisma/schema.prisma`, `prisma/migrations/…/migration.sql` |
| 2 | `feat(types): add DIALOGUING/FINAL_QUIZZING phases, OPEN_ANSWER quiz, comprehension types` | `training-types.ts`, `training-types.test.ts` |
| 3 | `feat(prompts): add buildDialoguePrompt, buildFinalQuizSystemPrompt` | `training-prompts.ts`, `training-prompts.test.ts` |
| 4 | `feat(supervisor): add dialogue topic advancement + initial state for DIALOGUING` | `training-supervisor.ts`, `training-supervisor.test.ts` |
| 5 | `feat(service): DIALOGUING + FINAL_QUIZZING handlers, multi-source KB aggregation` | `training-service.ts` |
| 6 | `feat(api): GET/POST/DELETE training bot knowledge sources` | `api/training-bots/[botId]/knowledge/…` |
| 7 | `feat(ui): QuizRenderer supports OPEN_ANSWER questions with textarea` | `QuizRenderer.tsx`, `TrainingChat.tsx` |
| 8 | `feat(ui): TrainingKnowledgePanel with file/text/URL knowledge upload` | `TrainingKnowledgePanel.tsx` |
| 9 | `feat(ui): Conoscenza tab in settings, topic turn limits in config form` | `settings/page.tsx`, `training-bot-config-form.tsx`, `[botId]/route.ts` |
| 10 | `chore: post-integration smoke test fixes` | (any fixes) |

# Training Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Training Tool that teaches users topic-by-topic, evaluates understanding via open questions + structured quizzes, and produces a completion report — as a selective clone of the Interview tool.

**Architecture:** Clone interview infrastructure (Bot→TrainingBot, Conversation→TrainingSession, supervisor→training-supervisor) keeping shared infra (auth, LLM service, KnowledgeSource, RewardConfig). New training-specific logic: linear state machine (EXPLAIN→CHECK→QUIZ→EVALUATE), adaptive simplification on retry, quiz renderer UI.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Vercel AI SDK (generateText/generateObject), Zod, React, Tailwind, shadcn/ui

---

## Phase 1 — Database Schema

### Task 1: Add Training enums to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums after existing enums block**

Open `prisma/schema.prisma`. Find the last enum block. Append:

```prisma
enum TraineeEducationLevel {
  PRIMARY
  SECONDARY
  UNIVERSITY
  PROFESSIONAL
}

enum TraineeCompetenceLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  EXPERT
}

enum FailureMode {
  STRICT
  PERMISSIVE
}

enum TrainingSessionStatus {
  STARTED
  COMPLETED
  FAILED
  ABANDONED
}

enum TrainingPhase {
  EXPLAINING
  CHECKING
  QUIZZING
  EVALUATING
  RETRYING
  DATA_COLLECTION
  COMPLETE
}
```

**Step 2: Verify schema parses**
```bash
npx prisma validate
```
Expected: "The schema at prisma/schema.prisma is valid"

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat(training): add training enums to prisma schema"
```

---

### Task 2: Add TrainingBot, TrainingTopicBlock, TrainingSession, TrainingMessage models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add models**

Append after the new enums:

```prisma
model TrainingBot {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String?
  status      BotStatus @default(DRAFT)

  learningGoal   String?
  targetAudience String?
  language       String  @default("it")
  tone           String  @default("professional")

  traineeEducationLevel  TraineeEducationLevel  @default(PROFESSIONAL)
  traineeCompetenceLevel TraineeCompetenceLevel @default(INTERMEDIATE)

  failureMode        FailureMode @default(PERMISSIVE)
  passScoreThreshold Int         @default(70)
  maxRetries         Int         @default(2)

  introMessage    String?
  maxDurationMins Int     @default(30)

  useWarmup         Boolean @default(false)
  warmupIcebreaker  String?

  collectTraineeData  Boolean @default(false)
  traineeDataFields   Json?

  logoUrl         String?
  primaryColor    String?
  backgroundColor String?
  textColor       String?

  showProgressBar Boolean @default(true)
  welcomeTitle    String?
  welcomeSubtitle String?

  modelProvider String  @default("openai")
  modelName     String  @default("gpt-4o-mini")
  customApiKey  String?

  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  topics           TrainingTopicBlock[]
  sessions         TrainingSession[]
  rewardConfig     RewardConfig?        @relation("TrainingBotReward")
  knowledgeSources KnowledgeSource[]    @relation("TrainingBotKnowledge")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([organizationId])
  @@index([slug])
}

model TrainingTopicBlock {
  id            String      @id @default(cuid())
  trainingBotId String
  trainingBot   TrainingBot @relation(fields: [trainingBotId], references: [id], onDelete: Cascade)

  orderIndex         Int
  label              String
  description        String?
  learningObjectives String[]
  preWrittenQuizzes  Json?
  passScoreOverride  Int?
  maxRetriesOverride Int?

  createdAt DateTime @default(now())

  @@index([trainingBotId])
}

model TrainingSession {
  id            String      @id @default(cuid())
  trainingBotId String
  trainingBot   TrainingBot @relation(fields: [trainingBotId], references: [id], onDelete: Cascade)

  participantId String
  status        TrainingSessionStatus @default(STARTED)

  currentTopicId          String?
  topicResults            Json    @default("[]")
  overallScore            Float?
  passed                  Boolean?
  detectedCompetenceLevel String?

  startedAt       DateTime  @default(now())
  completedAt     DateTime?
  durationSeconds Int?

  traineeProfile Json?
  supervisorState Json?

  messages TrainingMessage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([trainingBotId])
  @@index([participantId])
}

model TrainingMessage {
  id                String          @id @default(cuid())
  trainingSessionId String
  trainingSession   TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)

  role    String
  phase   TrainingPhase
  content String
  metadata Json?

  createdAt DateTime @default(now())

  @@index([trainingSessionId])
}
```

**Step 2: Add relations to existing models**

In `RewardConfig` model add: `trainingBotId String? @unique` and relation field `trainingBot TrainingBot? @relation("TrainingBotReward", fields: [trainingBotId], references: [id])`

In `KnowledgeSource` model add: `trainingBotId String?` and relation field `trainingBot TrainingBot? @relation("TrainingBotKnowledge", fields: [trainingBotId], references: [id])`

In `Organization` model add: `trainingBots TrainingBot[]`

**Step 3: Generate and run migration**
```bash
npx prisma migrate dev --name add_training_tool
```
Expected: Migration created and applied successfully.

**Step 4: Generate Prisma client**
```bash
npx prisma generate
```

**Step 5: Commit**
```bash
git add prisma/
git commit -m "feat(training): add TrainingBot, TrainingSession, TrainingMessage models"
```

---

## Phase 2 — Types and Core Business Logic

### Task 3: Create training-types.ts

**Files:**
- Create: `src/lib/training/training-types.ts`

**Step 1: Create file**

```typescript
// src/lib/training/training-types.ts

export type TrainingPhaseType =
  | 'EXPLAINING'
  | 'CHECKING'
  | 'QUIZZING'
  | 'EVALUATING'
  | 'RETRYING'
  | 'DATA_COLLECTION'
  | 'COMPLETE'

export type DetectedCompetenceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  question: string
  options: string[]       // for TRUE_FALSE use ['Vero', 'Falso']
  correctIndex: number
}

export interface TopicResult {
  topicId: string
  topicLabel: string
  status: 'PASSED' | 'FAILED' | 'GAP_DETECTED'
  score: number           // 0-100 weighted final
  openAnswerScore: number // 0-100
  quizScore: number       // 0-100
  retries: number
  gaps: string[]
  feedback: string
}

export interface TrainingSupervisorState {
  currentTopicIndex: number
  phase: TrainingPhaseType
  retryCount: number
  detectedCompetenceLevel: DetectedCompetenceLevel
  adaptationDepth: number   // 0=configured, 1=one level simpler, 2=max simple
  topicResults: TopicResult[]
  pendingQuizzes?: QuizQuestion[]    // quizzes generated, waiting for answers
  pendingCheckQuestion?: string      // open question asked, waiting for answer
  dataCollectionPhase?: 'CONSENT' | 'COLLECTING' | 'DONE'
  dataCollected?: Record<string, string>
}

export interface EvaluationResult {
  score: number      // 0-100
  gaps: string[]
  feedback: string
}

export interface QuizEvaluationResult {
  score: number       // 0-100
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
  explanationCues: string[]   // how to explain clearly
  commonMisconceptions: string[]
}
```

**Step 2: Commit**
```bash
git add src/lib/training/training-types.ts
git commit -m "feat(training): add training TypeScript types"
```

---

### Task 4: Create training-evaluator.ts

**Files:**
- Create: `src/lib/training/training-evaluator.ts`
- Create: `src/lib/training/__tests__/training-evaluator.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/training/__tests__/training-evaluator.test.ts
import { computeTopicScore, evaluateQuizAnswers } from '../training-evaluator'
import type { QuizQuestion } from '../training-types'

describe('computeTopicScore', () => {
  it('weights open answer at 40% and quiz at 60%', () => {
    expect(computeTopicScore(100, 100)).toBe(100)
    expect(computeTopicScore(0, 100)).toBe(60)
    expect(computeTopicScore(100, 0)).toBe(40)
    expect(computeTopicScore(50, 50)).toBe(50)
  })
})

describe('evaluateQuizAnswers', () => {
  const questions: QuizQuestion[] = [
    { id: '1', type: 'TRUE_FALSE', question: 'Q1', options: ['Vero', 'Falso'], correctIndex: 0 },
    { id: '2', type: 'MULTIPLE_CHOICE', question: 'Q2', options: ['A', 'B', 'C'], correctIndex: 1 },
    { id: '3', type: 'TRUE_FALSE', question: 'Q3', options: ['Vero', 'Falso'], correctIndex: 1 },
  ]

  it('returns 100 when all answers correct', () => {
    const result = evaluateQuizAnswers(questions, [0, 1, 1])
    expect(result.score).toBe(100)
    expect(result.wrongAnswers).toHaveLength(0)
  })

  it('returns 0 when all answers wrong', () => {
    const result = evaluateQuizAnswers(questions, [1, 0, 0])
    expect(result.score).toBe(0)
    expect(result.wrongAnswers).toHaveLength(3)
  })

  it('returns partial score for mixed answers', () => {
    const result = evaluateQuizAnswers(questions, [0, 0, 1]) // 2/3 correct
    expect(result.score).toBeCloseTo(66.7, 0)
    expect(result.wrongAnswers).toHaveLength(1)
  })
})
```

**Step 2: Run tests to confirm they fail**
```bash
npx jest src/lib/training/__tests__/training-evaluator.test.ts
```
Expected: FAIL — "Cannot find module"

**Step 3: Implement training-evaluator.ts**

```typescript
// src/lib/training/training-evaluator.ts
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { QuizQuestion, EvaluationResult, QuizEvaluationResult } from './training-types'

/** Weighted score: 40% open answer + 60% quiz */
export function computeTopicScore(openAnswerScore: number, quizScore: number): number {
  return Math.round(openAnswerScore * 0.4 + quizScore * 0.6)
}

/** Evaluate structured quiz answers locally (no LLM needed) */
export function evaluateQuizAnswers(
  questions: QuizQuestion[],
  selectedIndexes: number[]
): QuizEvaluationResult {
  const wrongAnswers: QuizQuestion[] = []
  let correct = 0

  questions.forEach((q, i) => {
    if (selectedIndexes[i] === q.correctIndex) {
      correct++
    } else {
      wrongAnswers.push(q)
    }
  })

  return {
    score: questions.length === 0 ? 100 : Math.round((correct / questions.length) * 100),
    wrongAnswers,
  }
}

/** Use LLM to evaluate an open-answer response */
export async function evaluateOpenAnswer(
  question: string,
  answer: string,
  learningObjectives: string[],
  competenceLevel: string,
  modelName = 'gpt-4o-mini'
): Promise<EvaluationResult> {
  if (!answer || answer.trim().length < 5) {
    return { score: 0, gaps: ['Nessuna risposta fornita'], feedback: 'Non è stata fornita una risposta.' }
  }

  const { object } = await generateObject({
    model: openai(modelName),
    schema: z.object({
      score: z.number().min(0).max(100),
      gaps: z.array(z.string()),
      feedback: z.string(),
    }),
    prompt: `Valuta questa risposta a una domanda di verifica formativa.

Domanda: ${question}
Risposta del trainee: ${answer}
Obiettivi di apprendimento: ${learningObjectives.join('; ')}
Livello di competenza atteso: ${competenceLevel}

Valuta:
- score: 0-100 (quanto la risposta dimostra comprensione degli obiettivi)
- gaps: array di lacune specifiche rilevate (vuoto se score >= 70)
- feedback: breve valutazione in italiano (max 2 frasi) per il report del formatore

Sii rigoroso ma equo. Considera la correttezza del concetto, non la forma.`,
  })

  return object
}

/** Infer competence level from message history quality */
export function detectCompetenceLevel(
  answers: string[]
): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  if (answers.length === 0) return 'INTERMEDIATE'

  const avgLength = answers.reduce((sum, a) => sum + a.split(' ').length, 0) / answers.length
  const hasSpecificTerms = answers.some(a => a.length > 100)

  if (avgLength < 10 && !hasSpecificTerms) return 'BEGINNER'
  if (avgLength > 40 || hasSpecificTerms) return 'ADVANCED'
  return 'INTERMEDIATE'
}
```

**Step 4: Run tests**
```bash
npx jest src/lib/training/__tests__/training-evaluator.test.ts
```
Expected: PASS (3 tests)

**Step 5: Commit**
```bash
git add src/lib/training/
git commit -m "feat(training): add training-evaluator with scoring logic"
```

---

### Task 5: Create training-supervisor.ts

**Files:**
- Create: `src/lib/training/training-supervisor.ts`
- Create: `src/lib/training/__tests__/training-supervisor.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/training/__tests__/training-supervisor.test.ts
import { getNextPhase, shouldRetry, buildInitialState } from '../training-supervisor'
import type { TrainingSupervisorState } from '../training-types'

const mockTopic = { id: 't1', label: 'Topic 1', learningObjectives: ['obj1'], passScoreOverride: null, maxRetriesOverride: null }
const mockBot = { passScoreThreshold: 70, maxRetries: 2, failureMode: 'PERMISSIVE' as const }

describe('buildInitialState', () => {
  it('starts at index 0, EXPLAINING phase, depth 0', () => {
    const state = buildInitialState()
    expect(state.currentTopicIndex).toBe(0)
    expect(state.phase).toBe('EXPLAINING')
    expect(state.adaptationDepth).toBe(0)
    expect(state.retryCount).toBe(0)
    expect(state.topicResults).toEqual([])
  })
})

describe('shouldRetry', () => {
  it('allows retry in PERMISSIVE mode under maxRetries', () => {
    expect(shouldRetry(mockBot, 1)).toBe(true)
    expect(shouldRetry(mockBot, 2)).toBe(false) // at max
  })

  it('never retries in STRICT mode', () => {
    expect(shouldRetry({ ...mockBot, failureMode: 'STRICT' }, 0)).toBe(false)
  })
})

describe('getNextPhase', () => {
  it('advances EXPLAINING → CHECKING', () => {
    expect(getNextPhase('EXPLAINING')).toBe('CHECKING')
  })
  it('advances CHECKING → QUIZZING', () => {
    expect(getNextPhase('CHECKING')).toBe('QUIZZING')
  })
  it('advances QUIZZING → EVALUATING', () => {
    expect(getNextPhase('QUIZZING')).toBe('EVALUATING')
  })
})
```

**Step 2: Run to confirm failure**
```bash
npx jest src/lib/training/__tests__/training-supervisor.test.ts
```
Expected: FAIL

**Step 3: Implement training-supervisor.ts**

```typescript
// src/lib/training/training-supervisor.ts
import type {
  TrainingSupervisorState,
  TrainingPhaseType,
  TopicResult,
  DetectedCompetenceLevel,
} from './training-types'

interface BotConfig {
  passScoreThreshold: number
  maxRetries: number
  failureMode: 'STRICT' | 'PERMISSIVE'
}

interface TopicConfig {
  id: string
  label: string
  learningObjectives: string[]
  passScoreOverride?: number | null
  maxRetriesOverride?: number | null
}

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
  }
}

export function getNextPhase(current: TrainingPhaseType): TrainingPhaseType {
  const flow: Record<string, TrainingPhaseType> = {
    EXPLAINING: 'CHECKING',
    CHECKING: 'QUIZZING',
    QUIZZING: 'EVALUATING',
    RETRYING: 'CHECKING',
  }
  return flow[current] ?? 'EXPLAINING'
}

export function shouldRetry(bot: BotConfig, retryCount: number): boolean {
  if (bot.failureMode === 'STRICT') return false
  return retryCount < bot.maxRetries
}

export function getPassThreshold(bot: BotConfig, topic: TopicConfig): number {
  return topic.passScoreOverride ?? bot.passScoreThreshold
}

export function getMaxRetries(bot: BotConfig, topic: TopicConfig): number {
  return topic.maxRetriesOverride ?? bot.maxRetries
}

/**
 * Advance state after EVALUATING phase result.
 * Returns updated state and whether to move to next topic.
 */
export function advanceAfterEvaluation(
  state: TrainingSupervisorState,
  result: TopicResult,
  bot: BotConfig,
  topic: TopicConfig,
  totalTopics: number
): { newState: TrainingSupervisorState; moveToNextTopic: boolean } {
  const threshold = getPassThreshold(bot, topic)
  const maxRetriesForTopic = getMaxRetries(bot, topic)

  const newState = { ...state, topicResults: [...state.topicResults, result] }

  if (result.score >= threshold) {
    // Passed — advance to next topic or complete
    const nextIndex = state.currentTopicIndex + 1
    if (nextIndex >= totalTopics) {
      return { newState: { ...newState, phase: 'COMPLETE' }, moveToNextTopic: false }
    }
    return {
      newState: {
        ...newState,
        currentTopicIndex: nextIndex,
        phase: 'EXPLAINING',
        retryCount: 0,
        adaptationDepth: 0,
        pendingQuizzes: undefined,
        pendingCheckQuestion: undefined,
      },
      moveToNextTopic: true,
    }
  }

  // Failed
  const canRetry = bot.failureMode === 'PERMISSIVE' && state.retryCount < maxRetriesForTopic

  if (canRetry) {
    return {
      newState: {
        ...newState,
        phase: 'RETRYING',
        retryCount: state.retryCount + 1,
        adaptationDepth: Math.min(state.adaptationDepth + 1, 2),
        topicResults: state.topicResults, // don't commit failed result yet
        pendingQuizzes: undefined,
        pendingCheckQuestion: undefined,
      },
      moveToNextTopic: false,
    }
  }

  // No more retries — mark gap and advance
  const nextIndex = state.currentTopicIndex + 1
  if (nextIndex >= totalTopics) {
    return { newState: { ...newState, phase: 'COMPLETE' }, moveToNextTopic: false }
  }
  return {
    newState: {
      ...newState,
      currentTopicIndex: nextIndex,
      phase: 'EXPLAINING',
      retryCount: 0,
      adaptationDepth: 0,
      pendingQuizzes: undefined,
      pendingCheckQuestion: undefined,
    },
    moveToNextTopic: true,
  }
}

export function computeOverallScore(topicResults: TopicResult[]): number {
  if (topicResults.length === 0) return 0
  const sum = topicResults.reduce((acc, r) => acc + r.score, 0)
  return Math.round(sum / topicResults.length)
}

export function computeSessionPassed(
  topicResults: TopicResult[],
  threshold: number
): boolean {
  return computeOverallScore(topicResults) >= threshold
}
```

**Step 4: Run tests**
```bash
npx jest src/lib/training/__tests__/training-supervisor.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add src/lib/training/
git commit -m "feat(training): add training-supervisor state machine"
```

---

### Task 6: Create training-prompts.ts

**Files:**
- Create: `src/lib/training/training-prompts.ts`

**Step 1: Create file**

```typescript
// src/lib/training/training-prompts.ts

const educationLabels: Record<string, string> = {
  PRIMARY: 'scuola primaria (bambini)',
  SECONDARY: 'scuola secondaria (adolescenti)',
  UNIVERSITY: 'livello universitario',
  PROFESSIONAL: 'professionisti adulti',
}

const competenceLabels: Record<string, string> = {
  BEGINNER: 'principiante (nessuna conoscenza pregressa)',
  INTERMEDIATE: 'intermedio (conosce le basi)',
  ADVANCED: 'avanzato (competenze solide)',
  EXPERT: 'esperto (padronanza completa)',
}

const depthInstructions: Record<number, string> = {
  0: 'Usa il livello di complessità appropriato al profilo del trainee.',
  1: 'Semplifica rispetto alla spiegazione precedente. Usa un linguaggio più diretto, esempi più concreti.',
  2: 'Usa il linguaggio più semplice possibile. Analogie quotidiane, frasi brevi, zero jargon tecnico.',
}

interface PromptContext {
  topicLabel: string
  topicDescription?: string
  learningObjectives: string[]
  educationLevel: string
  competenceLevel: string
  adaptationDepth: number
  kbContent?: string
  gaps?: string[]
  language?: string
}

export function buildExplainingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  return `Sei un tutor esperto e paziente. ${langInstruction}

Stai spiegando il topic: "${ctx.topicLabel}"
${ctx.topicDescription ? `Descrizione: ${ctx.topicDescription}` : ''}

Profilo trainee:
- Livello scolastico: ${educationLabels[ctx.educationLevel] ?? ctx.educationLevel}
- Competenza: ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}

Istruzione di adattamento: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[0]}

Obiettivi di apprendimento (cosa il trainee deve capire):
${ctx.learningObjectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ctx.kbContent ? `Fonte di conoscenza da usare:\n${ctx.kbContent}` : 'Usa la tua conoscenza generale sull\'argomento.'}

Spiega il concetto in modo chiaro e progressivo. Usa esempi pratici adeguati al livello.
Alla fine, indica che sei pronto a verificare la comprensione.`
}

export function buildCheckingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  const complexityByDepth = ['appropriata al livello del trainee', 'semplice e diretta', 'molto semplice, una sola idea']

  return `Sei un tutor. ${langInstruction}

Hai appena spiegato: "${ctx.topicLabel}"
Obiettivi: ${ctx.learningObjectives.join('; ')}

Fai UNA sola domanda aperta per verificare che il trainee abbia capito il concetto principale.
Complessità della domanda: ${complexityByDepth[ctx.adaptationDepth] ?? complexityByDepth[0]}

NON fare domande a risposta multipla. Aspetta la risposta libera del trainee.
La domanda deve essere concisa e focalizzata sull'obiettivo più importante.`
}

export function buildQuizzingSystemPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Genera le domande in italiano.' : `Generate questions in ${lang}.`

  return `Sei un esperto di formazione. ${langInstruction}

Topic: "${ctx.topicLabel}"
Obiettivi: ${ctx.learningObjectives.join('; ')}
Livello: ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}
Adattamento: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[0]}

Genera domande di verifica strutturate per confermare la comprensione degli obiettivi.`
}

export function buildRetryingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  return `Sei un tutor. ${langInstruction}

Il trainee ha avuto difficoltà con: "${ctx.topicLabel}"
Lacune specifiche rilevate: ${(ctx.gaps ?? []).join('; ') || 'comprensione generale insufficiente'}

Adattamento attivo: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[2]}

Re-spiega SOLO gli aspetti non compresi, usando:
- Linguaggio ancora più semplice
- Esempi pratici e concreti (situazioni reali, analogie quotidiane)
- Frasi brevi
Non ripetere ciò che il trainee ha già dimostrato di capire.
Focalizzati sulle lacune specifiche elencate sopra.`
}

export function buildFinalFeedbackPrompt(
  topicResults: Array<{ topicLabel: string; status: string; score: number; gaps: string[] }>,
  overallScore: number,
  passed: boolean,
  language = 'it'
): string {
  const langInstruction = language === 'it' ? 'Rispondi in italiano.' : `Respond in ${language}.`

  return `Sei un tutor. ${langInstruction}

Il trainee ha completato il percorso formativo.
Score globale: ${overallScore}/100 — ${passed ? 'SUPERATO ✅' : 'NON SUPERATO ❌'}

Risultati per topic:
${topicResults.map(r => `- ${r.topicLabel}: ${r.score}/100 (${r.status})${r.gaps.length ? ` — lacune: ${r.gaps.join(', ')}` : ''}`).join('\n')}

Scrivi un messaggio di chiusura personalizzato (max 3 frasi):
- Riconosci l'impegno
- Se ci sono lacune, indica cosa approfondire
- Tono incoraggiante e professionale`
}
```

**Step 2: Commit**
```bash
git add src/lib/training/training-prompts.ts
git commit -m "feat(training): add training prompt builders"
```

---

## Phase 3 — API Route

### Task 7: Create /api/training-chat route

**Files:**
- Create: `src/app/api/training-chat/route.ts`
- Create: `src/lib/training/training-service.ts`

**Step 1: Create training-service.ts**

```typescript
// src/lib/training/training-service.ts
import { generateText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  buildExplainingPrompt,
  buildCheckingPrompt,
  buildQuizzingSystemPrompt,
  buildRetryingPrompt,
  buildFinalFeedbackPrompt,
} from './training-prompts'
import {
  buildInitialState,
  getNextPhase,
  advanceAfterEvaluation,
  computeOverallScore,
  computeSessionPassed,
} from './training-supervisor'
import { evaluateOpenAnswer, evaluateQuizAnswers, computeTopicScore, detectCompetenceLevel } from './training-evaluator'
import type { TrainingSupervisorState, TrainingChatResponse, QuizQuestion } from './training-types'

function getModel(provider: string, name: string, customKey?: string | null) {
  if (provider === 'anthropic') return anthropic(name)
  return openai(name, customKey ? { apiKey: customKey } : undefined)
}

export async function processTrainingMessage(
  sessionId: string,
  userMessage: string
): Promise<TrainingChatResponse> {
  // 1. Load session + bot
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      trainingBot: {
        include: { topics: { orderBy: { orderIndex: 'asc' } }, knowledgeSources: true },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  const bot = session.trainingBot
  const topics = bot.topics
  const state: TrainingSupervisorState = (session.supervisorState as TrainingSupervisorState) ?? buildInitialState()

  if (state.phase === 'COMPLETE') {
    return { text: 'Il percorso formativo è già completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const currentTopic = topics[state.currentTopicIndex]
  if (!currentTopic) {
    return { text: 'Percorso completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const model = getModel(bot.modelProvider, bot.modelName, bot.customApiKey)
  const kbContent = bot.knowledgeSources[0]?.content ?? undefined

  // 2. Save user message
  await prisma.trainingMessage.create({
    data: { trainingSessionId: sessionId, role: 'user', phase: state.phase, content: userMessage },
  })

  // 3. Handle phase
  let response: TrainingChatResponse

  switch (state.phase) {
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
            gaps: state.topicResults.at(-1)?.gaps ?? [],
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

      const { text } = await generateText({ model, system: systemPrompt, prompt: userMessage })
      const newState = { ...state, phase: 'CHECKING' as const }
      await saveStateAndMessage(sessionId, newState, text, 'EXPLAINING')
      response = { text, phase: 'CHECKING' }
      break
    }

    case 'CHECKING': {
      // User answered open question — generate quiz
      const checkQuestion = state.pendingCheckQuestion ?? '(domanda aperta)'
      const openEval = await evaluateOpenAnswer(
        checkQuestion,
        userMessage,
        currentTopic.learningObjectives,
        state.detectedCompetenceLevel,
        bot.modelName
      )

      // Generate quizzes
      const preWritten = currentTopic.preWrittenQuizzes as QuizQuestion[] | null
      let quizzes: QuizQuestion[]

      if (preWritten && preWritten.length > 0) {
        quizzes = preWritten.slice(0, 3)
      } else {
        const { object } = await generateObject({
          model,
          schema: z.object({
            questions: z.array(z.object({
              id: z.string(),
              type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE']),
              question: z.string(),
              options: z.array(z.string()),
              correctIndex: z.number(),
            })).min(1).max(3),
          }),
          system: buildQuizzingSystemPrompt({
            topicLabel: currentTopic.label,
            learningObjectives: currentTopic.learningObjectives,
            educationLevel: bot.traineeEducationLevel,
            competenceLevel: state.detectedCompetenceLevel,
            adaptationDepth: state.adaptationDepth,
            language: bot.language,
          }),
          prompt: `Genera 2-3 domande di verifica sul topic "${currentTopic.label}".`,
        })
        quizzes = object.questions
      }

      const newState: TrainingSupervisorState = {
        ...state,
        phase: 'QUIZZING',
        pendingQuizzes: quizzes,
        // store open eval for later scoring
        topicResults: [
          ...state.topicResults,
          // temp partial result (will be replaced after quiz)
          { topicId: currentTopic.id, topicLabel: currentTopic.label, status: 'GAP_DETECTED',
            score: openEval.score, openAnswerScore: openEval.score, quizScore: 0,
            retries: state.retryCount, gaps: openEval.gaps, feedback: openEval.feedback },
        ],
      }

      const introText = bot.language === 'it'
        ? 'Bene! Ora alcune domande di verifica:'
        : 'Good! Now a few verification questions:'

      await saveStateAndMessage(sessionId, newState, introText, 'CHECKING')
      response = { text: introText, phase: 'QUIZZING', quizPayload: { questions: quizzes } }
      break
    }

    case 'QUIZZING': {
      // Parse selected indexes from userMessage (format: "0,1,1" or JSON array)
      const quizzes = state.pendingQuizzes ?? []
      const selectedIndexes = parseQuizAnswers(userMessage, quizzes.length)
      const quizEval = evaluateQuizAnswers(quizzes, selectedIndexes)

      // Get stored open answer score from temp result
      const tempResult = state.topicResults.at(-1)
      const openScore = tempResult?.openAnswerScore ?? 0
      const finalScore = computeTopicScore(openScore, quizEval.score)

      const threshold = currentTopic.passScoreOverride ?? bot.passScoreThreshold
      const status = finalScore >= threshold ? 'PASSED' : (state.retryCount >= (currentTopic.maxRetriesOverride ?? bot.maxRetries) ? 'FAILED' : 'GAP_DETECTED')

      const topicResult = {
        topicId: currentTopic.id,
        topicLabel: currentTopic.label,
        status,
        score: finalScore,
        openAnswerScore: openScore,
        quizScore: quizEval.score,
        retries: state.retryCount,
        gaps: tempResult?.gaps ?? [],
        feedback: tempResult?.feedback ?? '',
      }

      // Remove temp result, add final
      const resultsWithoutTemp = state.topicResults.slice(0, -1)
      const stateWithResult = { ...state, topicResults: resultsWithoutTemp }

      const botConfig = { passScoreThreshold: bot.passScoreThreshold, maxRetries: bot.maxRetries, failureMode: bot.failureMode as 'STRICT' | 'PERMISSIVE' }
      const topicConfig = { id: currentTopic.id, label: currentTopic.label, learningObjectives: currentTopic.learningObjectives, passScoreOverride: currentTopic.passScoreOverride, maxRetriesOverride: currentTopic.maxRetriesOverride }

      const { newState, moveToNextTopic } = advanceAfterEvaluation(stateWithResult, topicResult, botConfig, topicConfig, topics.length)

      // Detect competence from all user answers
      const userAnswers = session.messages.filter(m => m.role === 'user').map(m => m.content)
      const detectedLevel = detectCompetenceLevel(userAnswers)
      const finalState = { ...newState, detectedCompetenceLevel: detectedLevel }

      // Generate response text
      let text: string
      if (finalState.phase === 'COMPLETE') {
        const overallScore = computeOverallScore(finalState.topicResults)
        const passed = computeSessionPassed(finalState.topicResults, bot.passScoreThreshold)
        const { text: feedbackText } = await generateText({
          model,
          system: buildFinalFeedbackPrompt(finalState.topicResults, overallScore, passed, bot.language),
          prompt: 'Genera il messaggio di chiusura.',
        })
        text = feedbackText

        // Update session as complete
        await prisma.trainingSession.update({
          where: { id: sessionId },
          data: {
            status: passed ? 'COMPLETED' : 'FAILED',
            passed,
            overallScore,
            completedAt: new Date(),
            durationSeconds: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
            topicResults: finalState.topicResults as any,
            supervisorState: finalState as any,
          },
        })

        await prisma.trainingMessage.create({
          data: { trainingSessionId: sessionId, role: 'assistant', phase: 'COMPLETE', content: text },
        })

        return { text, phase: 'COMPLETE', topicResult, sessionComplete: true, overallScore, passed }
      } else if (finalState.phase === 'RETRYING') {
        text = bot.language === 'it'
          ? `Proviamo a ripassare questo argomento. Focalizziamoci su: ${topicResult.gaps.join(', ') || 'i punti chiave'}.`
          : `Let's review this topic again, focusing on: ${topicResult.gaps.join(', ') || 'the key points'}.`
      } else if (moveToNextTopic) {
        const nextTopic = topics[finalState.currentTopicIndex]
        text = bot.language === 'it'
          ? `Ottimo! Passiamo al prossimo argomento: "${nextTopic?.label}".`
          : `Great! Let's move to the next topic: "${nextTopic?.label}".`
      } else {
        text = bot.language === 'it' ? 'Procediamo.' : 'Let\'s continue.'
      }

      await saveStateAndMessage(sessionId, finalState, text, 'QUIZZING')
      response = { text, phase: finalState.phase, topicResult }
      break
    }

    default:
      response = { text: 'Stato non riconosciuto.', phase: state.phase }
  }

  return response
}

function parseQuizAnswers(input: string, count: number): number[] {
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) return parsed.map(Number)
  } catch {}
  // fallback: comma-separated "0,1,1"
  const parts = input.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === count && parts.every(n => !isNaN(n))) return parts
  return new Array(count).fill(0)
}

async function saveStateAndMessage(
  sessionId: string,
  state: TrainingSupervisorState,
  text: string,
  phase: string
) {
  await Promise.all([
    prisma.trainingSession.update({
      where: { id: sessionId },
      data: { supervisorState: state as any, currentTopicId: undefined },
    }),
    prisma.trainingMessage.create({
      data: { trainingSessionId: sessionId, role: 'assistant', phase: phase as any, content: text },
    }),
  ])
}
```

**Step 2: Create API route**

```typescript
// src/app/api/training-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { processTrainingMessage } from '@/lib/training/training-service'

const RequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, sessionId } = RequestSchema.parse(body)

    const result = await processTrainingMessage(sessionId, message)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[training-chat]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```
Expected: No errors (fix any if found)

**Step 4: Commit**
```bash
git add src/lib/training/ src/app/api/training-chat/
git commit -m "feat(training): add training service and API route"
```

---

## Phase 4 — Frontend (Trainee-Facing)

### Task 8: Training Landing Page

**Files:**
- Create: `src/app/t/[slug]/page.tsx`
- Create: `src/app/api/training-sessions/route.ts` (create session endpoint)

**Step 1: Create session API**

```typescript
// src/app/api/training-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const Schema = z.object({ botId: z.string() })

export async function POST(req: NextRequest) {
  const { botId } = Schema.parse(await req.json())

  const bot = await prisma.trainingBot.findUnique({
    where: { id: botId, status: 'PUBLISHED' },
    select: { id: true },
  })
  if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

  const session = await prisma.trainingSession.create({
    data: { trainingBotId: botId, participantId: `anon-${uuidv4()}` },
  })

  return NextResponse.json({ sessionId: session.id })
}
```

**Step 2: Create landing page**

```typescript
// src/app/t/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TrainingLandingClient from '@/components/training/TrainingLandingClient'

interface Props { params: { slug: string } }

export default async function TrainingLandingPage({ params }: Props) {
  const bot = await prisma.trainingBot.findUnique({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  })

  if (!bot) notFound()

  return (
    <TrainingLandingClient
      botId={bot.id}
      botName={bot.name}
      description={bot.description ?? ''}
      learningGoal={bot.learningGoal ?? ''}
      topics={bot.topics.map(t => ({ id: t.id, label: t.label }))}
      estimatedMinutes={bot.maxDurationMins}
      welcomeTitle={bot.welcomeTitle ?? `Benvenuto in ${bot.name}`}
      welcomeSubtitle={bot.welcomeSubtitle ?? ''}
      primaryColor={bot.primaryColor ?? '#6366f1'}
      logoUrl={bot.logoUrl ?? ''}
    />
  )
}
```

**Step 3: Create TrainingLandingClient component**

```typescript
// src/components/training/TrainingLandingClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  botId: string
  botName: string
  description: string
  learningGoal: string
  topics: { id: string; label: string }[]
  estimatedMinutes: number
  welcomeTitle: string
  welcomeSubtitle: string
  primaryColor: string
  logoUrl: string
}

export default function TrainingLandingClient({
  botId, botName, description, learningGoal,
  topics, estimatedMinutes, welcomeTitle, welcomeSubtitle, primaryColor, logoUrl
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function startTraining() {
    setLoading(true)
    const res = await fetch('/api/training-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    })
    const { sessionId } = await res.json()
    router.push(`/t/chat/${sessionId}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        {logoUrl && <img src={logoUrl} alt={botName} className="h-12 mb-6" />}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{welcomeTitle}</h1>
        {welcomeSubtitle && <p className="text-gray-500 mb-4">{welcomeSubtitle}</p>}
        {description && <p className="text-gray-700 mb-4">{description}</p>}
        {learningGoal && (
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-indigo-700">Obiettivo formativo</p>
            <p className="text-sm text-indigo-900 mt-1">{learningGoal}</p>
          </div>
        )}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Argomenti ({topics.length})</p>
          <ul className="space-y-1">
            {topics.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center">{i + 1}</span>
                {t.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-400 mb-4">Durata stimata: ~{estimatedMinutes} minuti</p>
        <Button onClick={startTraining} disabled={loading} className="w-full" style={{ backgroundColor: primaryColor }}>
          {loading ? 'Avvio...' : 'Inizia la formazione'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add src/app/t/ src/app/api/training-sessions/ src/components/training/
git commit -m "feat(training): add training landing page"
```

---

### Task 9: Training Chat Interface

**Files:**
- Create: `src/app/t/chat/[sessionId]/page.tsx`
- Create: `src/components/training/TrainingChat.tsx`
- Create: `src/components/training/QuizRenderer.tsx`
- Create: `src/components/training/TrainingProgressBar.tsx`
- Create: `src/components/training/TrainingCompletionScreen.tsx`

**Step 1: Create chat page**

```typescript
// src/app/t/chat/[sessionId]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TrainingChat from '@/components/training/TrainingChat'

export default async function TrainingChatPage({ params }: { params: { sessionId: string } }) {
  const session = await prisma.trainingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      trainingBot: { include: { topics: { orderBy: { orderIndex: 'asc' } } } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!session) notFound()

  const bot = session.trainingBot
  const state = session.supervisorState as any

  return (
    <TrainingChat
      sessionId={session.id}
      botName={bot.name}
      topics={bot.topics.map(t => ({ id: t.id, label: t.label }))}
      currentTopicIndex={state?.currentTopicIndex ?? 0}
      topicResults={state?.topicResults ?? []}
      primaryColor={bot.primaryColor ?? '#6366f1'}
      initialMessages={session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        phase: m.phase,
      }))}
      introMessage={bot.introMessage ?? `Ciao! Iniziamo il percorso su "${bot.name}".`}
    />
  )
}
```

**Step 2: Create QuizRenderer component**

```typescript
// src/components/training/QuizRenderer.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { QuizQuestion } from '@/lib/training/training-types'

interface Props {
  questions: QuizQuestion[]
  onSubmit: (selectedIndexes: number[]) => void
  disabled?: boolean
}

export default function QuizRenderer({ questions, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<(number | null)[]>(new Array(questions.length).fill(null))

  const allAnswered = selected.every(s => s !== null)

  function select(questionIdx: number, optionIdx: number) {
    const updated = [...selected]
    updated[questionIdx] = optionIdx
    setSelected(updated)
  }

  function handleSubmit() {
    if (!allAnswered) return
    onSubmit(selected as number[])
  }

  return (
    <div className="space-y-4 my-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-800 mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => !disabled && select(qi, oi)}
                className={`w-full text-left text-sm px-4 py-2 rounded-lg border transition-colors ${
                  selected[qi] === oi
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={!allAnswered || disabled} className="w-full">
        Conferma risposte
      </Button>
    </div>
  )
}
```

**Step 3: Create TrainingProgressBar component**

```typescript
// src/components/training/TrainingProgressBar.tsx
'use client'
import type { TopicResult } from '@/lib/training/training-types'

interface Topic { id: string; label: string }
interface Props {
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
}

const statusIcon: Record<string, string> = {
  PASSED: '✅',
  FAILED: '❌',
  GAP_DETECTED: '⚠️',
}

export default function TrainingProgressBar({ topics, currentTopicIndex, topicResults }: Props) {
  const resultsMap = Object.fromEntries(topicResults.map(r => [r.topicId, r]))

  return (
    <div className="flex gap-2 flex-wrap items-center justify-center px-4 py-3 border-b bg-white">
      {topics.map((topic, i) => {
        const result = resultsMap[topic.id]
        const isCurrent = i === currentTopicIndex
        const isDone = i < currentTopicIndex || !!result

        return (
          <div
            key={topic.id}
            title={topic.label}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
              isCurrent
                ? 'bg-indigo-100 border-indigo-400 text-indigo-700 font-medium'
                : isDone
                ? 'bg-gray-100 border-gray-300 text-gray-600'
                : 'border-gray-200 text-gray-400'
            }`}
          >
            {result ? statusIcon[result.status] : isCurrent ? '🔄' : '○'}
            <span className="hidden sm:inline max-w-[80px] truncate">{topic.label}</span>
            <span className="sm:hidden">{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 4: Create TrainingChat main component**

```typescript
// src/components/training/TrainingChat.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import TrainingProgressBar from './TrainingProgressBar'
import QuizRenderer from './QuizRenderer'
import TrainingCompletionScreen from './TrainingCompletionScreen'
import type { TopicResult, QuizQuestion, TrainingChatResponse } from '@/lib/training/training-types'

interface Message { role: 'user' | 'assistant'; content: string; phase?: string }
interface Topic { id: string; label: string }

interface Props {
  sessionId: string
  botName: string
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
  primaryColor: string
  initialMessages: Message[]
  introMessage: string
}

export default function TrainingChat({
  sessionId, botName, topics, currentTopicIndex: initialTopicIndex,
  topicResults: initialResults, primaryColor, initialMessages, introMessage,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [{ role: 'assistant', content: introMessage }]
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string>('EXPLAINING')
  const [currentTopicIndex, setCurrentTopicIndex] = useState(initialTopicIndex)
  const [topicResults, setTopicResults] = useState<TopicResult[]>(initialResults)
  const [pendingQuizzes, setPendingQuizzes] = useState<QuizQuestion[] | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [completionData, setCompletionData] = useState<{ overallScore: number; passed: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(messageText: string) {
    if (!messageText.trim() || loading) return
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: messageText }])
    setInput('')
    setPendingQuizzes(null)

    try {
      const res = await fetch('/api/training-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, sessionId }),
      })
      const data: TrainingChatResponse = await res.json()

      setMessages(prev => [...prev, { role: 'assistant', content: data.text, phase: data.phase }])
      setCurrentPhase(data.phase)

      if (data.topicResult) {
        setTopicResults(prev => {
          const idx = prev.findIndex(r => r.topicId === data.topicResult!.topicId)
          if (idx >= 0) { const copy = [...prev]; copy[idx] = data.topicResult!; return copy }
          return [...prev, data.topicResult!]
        })
      }

      if (data.quizPayload) setPendingQuizzes(data.quizPayload.questions)
      if (data.sessionComplete) {
        setSessionComplete(true)
        if (data.overallScore !== undefined && data.passed !== undefined) {
          setCompletionData({ overallScore: data.overallScore, passed: data.passed })
        }
      }
      // Advance topic index if moved
      if (data.phase === 'EXPLAINING' && !data.sessionComplete) {
        setCurrentTopicIndex(prev => prev + 1)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleQuizSubmit(selectedIndexes: number[]) {
    const payload = JSON.stringify(selectedIndexes)
    sendMessage(payload)
  }

  if (sessionComplete && completionData) {
    return (
      <TrainingCompletionScreen
        botName={botName}
        overallScore={completionData.overallScore}
        passed={completionData.passed}
        topicResults={topicResults}
        primaryColor={primaryColor}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <h1 className="font-semibold text-gray-900">{botName}</h1>
      </div>
      <TrainingProgressBar
        topics={topics}
        currentTopicIndex={currentTopicIndex}
        topicResults={topicResults}
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {pendingQuizzes && (
          <QuizRenderer questions={pendingQuizzes} onSubmit={handleQuizSubmit} disabled={loading} />
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <span className="text-gray-400 text-sm">...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {!pendingQuizzes && (
        <div className="bg-white border-t px-4 py-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            Invia
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 5: Create TrainingCompletionScreen**

```typescript
// src/components/training/TrainingCompletionScreen.tsx
'use client'
import type { TopicResult } from '@/lib/training/training-types'

const statusIcon: Record<string, string> = { PASSED: '✅', FAILED: '❌', GAP_DETECTED: '⚠️' }
const statusLabel: Record<string, string> = { PASSED: 'Superato', FAILED: 'Non superato', GAP_DETECTED: 'Lacune rilevate' }

interface Props {
  botName: string
  overallScore: number
  passed: boolean
  topicResults: TopicResult[]
  primaryColor: string
}

export default function TrainingCompletionScreen({ botName, overallScore, passed, topicResults, primaryColor }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{passed ? '🎉' : '📚'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{botName}</h1>
          <p className="text-gray-500 text-sm">Percorso formativo completato</p>
        </div>
        <div className={`rounded-xl p-4 mb-6 text-center ${passed ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className={`text-3xl font-bold ${passed ? 'text-green-700' : 'text-amber-700'}`}>
            {overallScore}/100
          </p>
          <p className={`text-sm font-medium mt-1 ${passed ? 'text-green-600' : 'text-amber-600'}`}>
            {passed ? '✅ Obiettivi raggiunti' : '⚠️ Alcuni obiettivi non raggiunti'}
          </p>
        </div>
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Riepilogo argomenti</p>
          {topicResults.map(r => (
            <div key={r.topicId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span>{statusIcon[r.status]}</span>
                <span className="text-sm text-gray-800">{r.topicLabel}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                r.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                r.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {r.score}/100 — {statusLabel[r.status]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 6: Build and verify**
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 7: Commit**
```bash
git add src/app/t/ src/components/training/
git commit -m "feat(training): add training chat interface with quiz renderer"
```

---

## Phase 5 — Dashboard Admin

### Task 10: Training Bot CRUD API

**Files:**
- Create: `src/app/api/training-bots/route.ts`
- Create: `src/app/api/training-bots/[botId]/route.ts`

**Step 1: Create list/create endpoint**

```typescript
// src/app/api/training-bots/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  organizationId: z.string(),
  language: z.string().default('it'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('organizationId')
  if (!orgId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const bots = await prisma.trainingBot.findMany({
    where: { organizationId: orgId },
    include: { topics: { orderBy: { orderIndex: 'asc' } }, _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ bots })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = CreateSchema.parse(await req.json())
  const bot = await prisma.trainingBot.create({ data: body })
  return NextResponse.json({ bot }, { status: 201 })
}
```

**Step 2: Create get/update endpoint**

```typescript
// src/app/api/training-bots/[botId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { botId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bot = await prisma.trainingBot.findUniqueOrThrow({
    where: { id: params.botId },
    include: { topics: { orderBy: { orderIndex: 'asc' } }, knowledgeSources: true, rewardConfig: true },
  })
  return NextResponse.json({ bot })
}

export async function PUT(req: NextRequest, { params }: { params: { botId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { topics, ...botFields } = body

  const updated = await prisma.$transaction(async tx => {
    const bot = await tx.trainingBot.update({ where: { id: params.botId }, data: botFields })

    if (topics) {
      await tx.trainingTopicBlock.deleteMany({ where: { trainingBotId: params.botId } })
      if (topics.length > 0) {
        await tx.trainingTopicBlock.createMany({
          data: topics.map((t: any, i: number) => ({
            ...t, trainingBotId: params.botId, orderIndex: i, id: undefined,
          })),
        })
      }
    }
    return bot
  })

  return NextResponse.json({ bot: updated })
}
```

**Step 3: Commit**
```bash
git add src/app/api/training-bots/
git commit -m "feat(training): add training bot CRUD API"
```

---

### Task 11: Dashboard Pages

**Files:**
- Create: `src/app/dashboard/training/page.tsx`
- Create: `src/app/dashboard/training/new/page.tsx`
- Create: `src/app/dashboard/training/[botId]/page.tsx`
- Create: `src/app/dashboard/training/[botId]/settings/page.tsx`
- Create: `src/app/dashboard/training/[botId]/sessions/page.tsx`
- Create: `src/components/training/admin/training-bot-config-form.tsx`
- Create: `src/components/training/admin/training-session-profile.tsx`

**Step 1: List page**

```typescript
// src/app/dashboard/training/page.tsx
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function TrainingDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Get org from session (adapt to your actual auth pattern)
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: session.user?.email ?? '' },
    include: { memberships: { include: { organization: true } } },
  })
  const orgId = user.memberships[0]?.organizationId

  const bots = orgId ? await prisma.trainingBot.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  }) : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Percorsi Formativi</h1>
          <p className="text-gray-500 text-sm mt-1">Crea e gestisci i tuoi bot di formazione</p>
        </div>
        <Link href="/dashboard/training/new">
          <Button>+ Nuovo percorso</Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {bots.map(bot => (
          <div key={bot.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <Link href={`/dashboard/training/${bot.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                {bot.name}
              </Link>
              <p className="text-sm text-gray-500 mt-0.5">{bot._count.sessions} sessioni</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                bot.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{bot.status}</span>
              <Link href={`/dashboard/training/${bot.id}/settings`}>
                <Button variant="outline" size="sm">Impostazioni</Button>
              </Link>
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Nessun percorso formativo ancora. Creane uno!
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create training-bot-config-form.tsx**

This is the largest component. Create a multi-section form that mirrors `bot-config-form.tsx` from the interview tool. Key sections to implement:

```typescript
// src/components/training/admin/training-bot-config-form.tsx
// Mirror the structure of src/components/bot-config-form.tsx
// Sections:
// 1. Identity (name, slug, language, tone, introMessage, welcomeTitle, welcomeSubtitle)
// 2. Learning objective (learningGoal, targetAudience)
// 3. Trainee profile (traineeEducationLevel, traineeCompetenceLevel) — NEW
// 4. Evaluation (failureMode, passScoreThreshold, maxRetries) — NEW
// 5. Topics (TrainingTopicBlock list with learningObjectives, preWrittenQuizzes per topic)
// 6. Knowledge Base (reuse KnowledgeSource upload component)
// 7. Data collection (collectTraineeData, traineeDataFields)
// 8. Reward / Certificate (reuse RewardConfig component)
// 9. Branding (logoUrl, primaryColor, backgroundColor, textColor)
// 10. AI Model (modelProvider, modelName)

// Reference src/components/bot-config-form.tsx for the exact form patterns,
// tabs structure, and save/update flow. Adapt field names to TrainingBot schema.
'use client'
// ... (implement following the same pattern as bot-config-form.tsx)
```

> **Implementation note for executor:** Copy `src/components/bot-config-form.tsx` as a starting point. Replace all `Bot`/interview-specific fields with `TrainingBot` fields per the schema. Add the three new sections (Trainee Profile, Evaluation Settings, and Learning Objectives per topic). The API call should use `PUT /api/training-bots/[botId]`.

**Step 3: Create sessions list page**

```typescript
// src/app/dashboard/training/[botId]/sessions/page.tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function SessionsPage({ params }: { params: { botId: string } }) {
  const sessions = await prisma.trainingSession.findMany({
    where: { trainingBotId: params.botId },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Sessioni di formazione</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-4">Partecipante</th>
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Stato</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-700">{s.participantId}</td>
              <td className="py-2 pr-4 text-gray-500">{s.startedAt.toLocaleDateString('it-IT')}</td>
              <td className="py-2 pr-4">{s.overallScore !== null ? `${s.overallScore}/100` : '—'}</td>
              <td className="py-2 pr-4">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  s.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>{s.status}</span>
              </td>
              <td className="py-2">
                <Link href={`/dashboard/training/${params.botId}/sessions/${s.id}`}
                  className="text-indigo-600 hover:underline text-xs">Dettaglio →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 4: Create training-session-profile component**

```typescript
// src/components/training/admin/training-session-profile.tsx
'use client'
import type { TopicResult } from '@/lib/training/training-types'

const statusIcon: Record<string, string> = { PASSED: '✅', FAILED: '❌', GAP_DETECTED: '⚠️' }

interface Props {
  session: {
    participantId: string
    status: string
    overallScore: number | null
    passed: boolean | null
    startedAt: Date
    completedAt: Date | null
    durationSeconds: number | null
    detectedCompetenceLevel: string | null
    topicResults: TopicResult[]
    traineeProfile: Record<string, string> | null
  }
  configuredCompetenceLevel: string
}

export default function TrainingSessionProfile({ session, configuredCompetenceLevel }: Props) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-400 mb-1">Partecipante</p>
            <p className="font-mono text-sm text-gray-700">{session.participantId}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">
              {session.overallScore !== null ? `${session.overallScore}/100` : '—'}
            </p>
            <p className={`text-sm font-medium ${session.passed ? 'text-green-600' : 'text-red-600'}`}>
              {session.passed ? '✅ Superato' : '❌ Non superato'}
            </p>
          </div>
        </div>
        {session.detectedCompetenceLevel && (
          <div className="mt-3 text-xs text-gray-500">
            Livello configurato: <strong>{configuredCompetenceLevel}</strong> →
            Rilevato: <strong>{session.detectedCompetenceLevel}</strong>
          </div>
        )}
      </div>

      {/* Topic results */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Risultati per argomento</h2>
        <div className="space-y-3">
          {session.topicResults.map((r) => (
            <div key={r.topicId} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-gray-800">
                  {statusIcon[r.status]} {r.topicLabel}
                </span>
                <span className="text-sm font-bold text-gray-700">{r.score}/100</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">
                Risposta aperta: {r.openAnswerScore}/100 · Quiz: {r.quizScore}/100 · Tentativi: {r.retries + 1}
              </div>
              {r.gaps.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                  Lacune: {r.gaps.join(' · ')}
                </div>
              )}
              {r.feedback && <p className="text-xs text-gray-600 mt-1 italic">{r.feedback}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Trainee profile if collected */}
      {session.traineeProfile && Object.keys(session.traineeProfile).length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Dati trainee</h2>
          <dl className="grid grid-cols-2 gap-2">
            {Object.entries(session.traineeProfile).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-gray-400 capitalize">{k}</dt>
                <dd className="text-sm text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
```

**Step 5: Commit**
```bash
git add src/app/dashboard/training/ src/components/training/admin/
git commit -m "feat(training): add training dashboard pages and session profile"
```

---

## Phase 6 — Credit Tracking & Polish

### Task 12: Add TRAINING to token tracking

**Files:**
- Modify: `prisma/schema.prisma` (add TRAINING to TokenCategory enum)
- Modify: `src/lib/training/training-service.ts` (log tokens after LLM calls)

**Step 1: Update enum**

In `prisma/schema.prisma`, find `enum TokenCategory` and add `TRAINING`:
```prisma
enum TokenCategory {
  INTERVIEW
  CHATBOT
  TRAINING  // add this
}
```

**Step 2: Run migration**
```bash
npx prisma migrate dev --name add_training_token_category
```

**Step 3: Add token logging in training-service.ts**

After each `generateText` / `generateObject` call in `training-service.ts`, add:
```typescript
// After the generateText call, log token usage
await prisma.tokenLog.create({
  data: {
    organizationId: bot.organizationId,
    category: 'TRAINING',
    tokensUsed: usage?.totalTokens ?? 0,
    metadata: { sessionId, phase: state.phase },
  },
})
```

**Step 4: Commit**
```bash
git add prisma/ src/lib/training/training-service.ts
git commit -m "feat(training): add TRAINING token category tracking"
```

---

### Task 13: Navigation integration

**Files:**
- Modify: `src/app/dashboard/layout.tsx` (or equivalent nav component)

**Step 1: Add training link to dashboard nav**

Find the sidebar/nav component (check `src/components/dashboard/sidebar.tsx` or similar). Add:
```typescript
{ href: '/dashboard/training', label: 'Formazione', icon: GraduationCapIcon }
```

Use an appropriate icon from your icon library (Lucide: `GraduationCap`).

**Step 2: Commit**
```bash
git add src/
git commit -m "feat(training): add training tool to dashboard navigation"
```

---

## Final Verification

```bash
# Full type check
npx tsc --noEmit

# All tests
npx jest --passWithNoTests

# Build check
npm run build
```

Expected: All pass, no type errors, build succeeds.

---

## Quick Reference: URL Structure

| Path | Purpose |
|------|---------|
| `/t/[slug]` | Trainee landing page |
| `/t/chat/[sessionId]` | Training chat session |
| `/dashboard/training` | Admin: list training bots |
| `/dashboard/training/new` | Admin: create new training bot |
| `/dashboard/training/[botId]` | Admin: bot overview |
| `/dashboard/training/[botId]/settings` | Admin: bot configuration |
| `/dashboard/training/[botId]/sessions` | Admin: sessions list |
| `/dashboard/training/[botId]/sessions/[sessionId]` | Admin: session report |

## Quick Reference: New Files

```
prisma/schema.prisma                         ← modified
src/lib/training/
  training-types.ts                          ← new
  training-evaluator.ts                      ← new
  training-supervisor.ts                     ← new
  training-prompts.ts                        ← new
  training-service.ts                        ← new
  __tests__/training-evaluator.test.ts       ← new
  __tests__/training-supervisor.test.ts      ← new
src/app/
  api/training-chat/route.ts                 ← new
  api/training-sessions/route.ts             ← new
  api/training-bots/route.ts                 ← new
  api/training-bots/[botId]/route.ts         ← new
  t/[slug]/page.tsx                          ← new
  t/chat/[sessionId]/page.tsx                ← new
  dashboard/training/page.tsx                ← new
  dashboard/training/new/page.tsx            ← new
  dashboard/training/[botId]/page.tsx        ← new
  dashboard/training/[botId]/settings/page.tsx ← new
  dashboard/training/[botId]/sessions/page.tsx ← new
  dashboard/training/[botId]/sessions/[sessionId]/page.tsx ← new
src/components/training/
  TrainingLandingClient.tsx                  ← new
  TrainingChat.tsx                           ← new
  QuizRenderer.tsx                           ← new
  TrainingProgressBar.tsx                    ← new
  TrainingCompletionScreen.tsx               ← new
  admin/training-bot-config-form.tsx         ← new (based on bot-config-form.tsx)
  admin/training-session-profile.tsx         ← new
```

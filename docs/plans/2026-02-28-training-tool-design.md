# Training Tool — Design Document
**Date:** 2026-02-28
**Status:** Approved
**Approach:** Selective Clone of Interview Architecture

---

## 1. Overview

A new "Training" tool that mirrors the Interview tool in layout, settings structure, and infrastructure, but inverts the goal: instead of extracting information from users, it teaches users specific topics and certifies understanding.

**Primary use cases:** onboarding, knowledge transfer, compliance training, company process education.

**Key principle:** The training conversation flow is intentionally simpler than the interview flow. The interview supervisor is complex because it explores unknown territory. The training supervisor is linear and deterministic because the path is known in advance.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Selective Clone | Interview supervisor is complex/delicate; clean separation avoids risky coupling |
| Completion model | AI judgment + quiz score (both must pass) | Most robust; open answers detect nuance, quizzes confirm specifics |
| Session model | Single session (no pause/resume) | Same as interview; simpler infrastructure |
| Trainee identity | Optional data collection (same system as interview) | Zero new infrastructure |
| Content source | KB primary + topics/objectives structure + LLM general fallback | KB is truth, topics define what to verify |
| Failed topic handling | Configurable STRICT / PERMISSIVE | PERMISSIVE re-explains with increasing simplification |
| Adaptation axes | Language register + topic depth + question complexity | All three adapt to detected competence |
| Output | Completion screen + dashboard report + optional certificate (reward) | Certificate reuses existing RewardConfig |

---

## 3. Database Schema

### New Models

```prisma
model TrainingBot {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?
  status      BotStatus @default(DRAFT)  // reuse existing enum

  // Learning context
  learningGoal    String?
  targetAudience  String?
  language        String  @default("it")
  tone            String  @default("professional")

  // Trainee profile (new fields vs interview)
  traineeEducationLevel  TraineeEducationLevel @default(PROFESSIONAL)
  traineeCompetenceLevel TraineeCompetenceLevel @default(INTERMEDIATE)

  // Evaluation settings (new)
  failureMode         FailureMode @default(PERMISSIVE)
  passScoreThreshold  Int         @default(70)
  maxRetries          Int         @default(2)

  // Session settings
  introMessage    String?
  maxDurationMins Int     @default(30)

  // Data collection (reuse interview pattern)
  collectTraineeData  Boolean  @default(false)
  traineeDataFields   Json?

  // Branding (same as Bot)
  logoUrl         String?
  primaryColor    String?
  backgroundColor String?
  textColor       String?

  // UI settings
  showProgressBar   Boolean         @default(true)
  progressBarStyle  ProgressBarStyle @default(SEMANTIC)
  welcomeTitle      String?
  welcomeSubtitle   String?

  // AI model
  modelProvider String @default("openai")
  modelName     String @default("gpt-4o-mini")
  customApiKey  String?

  // Relations
  organizationId   String
  organization     Organization      @relation(fields: [organizationId], references: [id])
  topics           TrainingTopicBlock[]
  sessions         TrainingSession[]
  rewardConfig     RewardConfig?     // reuse existing model
  knowledgeSources KnowledgeSource[] // reuse existing model

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TrainingTopicBlock {
  id           String      @id @default(cuid())
  trainingBotId String
  trainingBot  TrainingBot @relation(fields: [trainingBotId], references: [id])

  orderIndex   Int
  label        String
  description  String?

  // Training-specific (vs interview SubGoals)
  learningObjectives String[]     // what the trainee must be able to do/know
  preWrittenQuizzes  Json?        // optional: QuizQuestion[] defined by trainer

  // Per-topic overrides
  passScoreOverride Int?          // overrides TrainingBot.passScoreThreshold
  maxRetriesOverride Int?         // overrides TrainingBot.maxRetries

  createdAt DateTime @default(now())
}

model TrainingSession {
  id            String      @id @default(cuid())
  trainingBotId String
  trainingBot   TrainingBot @relation(fields: [trainingBotId], references: [id])

  participantId String      // anonymous ID, same pattern as interview

  status        TrainingSessionStatus @default(STARTED)

  // Progress tracking
  currentTopicId    String?
  topicResults      Json    @default("[]")  // TopicResult[]
  overallScore      Float?
  passed            Boolean?

  // Adaptation tracking (new)
  detectedCompetenceLevel String?  // 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

  // Timing
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  durationSeconds Int?

  // Data collection (same as interview candidateProfile)
  traineeProfile Json?

  messages      TrainingMessage[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model TrainingMessage {
  id                String          @id @default(cuid())
  trainingSessionId String
  trainingSession   TrainingSession @relation(fields: [trainingSessionId], references: [id])

  role    MessageRole  // reuse existing enum: user | assistant | system
  phase   TrainingPhase
  content String
  metadata Json?

  createdAt DateTime @default(now())
}

// New enums
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
  COMPLETE
}
```

### Reused Models (unchanged)
- `KnowledgeSource` — linked to TrainingBot
- `RewardConfig` — linked to TrainingBot (certificate = reward)
- `Organization`, `Subscription` — unchanged
- `TokenLog` — new category `TRAINING` added

---

## 4. Training Supervisor — State Machine

### Philosophy
Unlike the interview supervisor (complex, exploratory, elastic), the training supervisor is **linear and deterministic**. The path is known; the only variable is whether a trainee passes or fails each topic and how many retries they need.

### State

```typescript
interface TrainingSupervisorState {
  // Topic progression
  currentTopicIndex: number
  phase: TrainingPhase
  retryCount: number

  // Adaptation (updated in real-time)
  detectedCompetenceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  adaptationDepth: number  // 0 = configured level, 1 = one level simpler, 2 = maximum simplification

  // Results
  topicResults: TopicResult[]

  // Optional data collection state (same as interview)
  dataCollectionPhase?: 'CONSENT' | 'COLLECTING' | 'DONE'
}

interface TopicResult {
  topicId: string
  topicLabel: string
  status: 'PASSED' | 'FAILED' | 'GAP_DETECTED'
  score: number            // 0-100
  openAnswerScore: number  // 0-100
  quizScore: number        // 0-100
  retries: number
  gaps: string[]           // detected knowledge gaps
  feedback: string         // AI-generated feedback for trainer report
}

interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  question: string
  options: string[]        // for MULTIPLE_CHOICE
  correctIndex: number     // index of correct answer
}
```

### Flow per Topic

```
START_TOPIC
    │
    ▼
EXPLAINING ──────────────────────────────────────────────────────────────────────┐
  Bot sposta concetto (adattato a educationLevel + competenceLevel + depth)       │
  Usa KB se disponibile, altrimenti LLM general knowledge                         │
    │                                                                              │
    ▼ (utente risponde o manda "ok")                                              │
CHECKING                                                                           │
  Bot fa 1 domanda aperta per sondare comprensione                                 │
  Complessità calibrata su adaptationDepth                                         │
    │                                                                              │
    ▼ (utente risponde)                                                           │
QUIZZING                                                                           │
  Bot genera/presenta 1-3 domande strutturate                                      │
  Se preWrittenQuizzes → usa quelle, altrimenti genera da LLM                     │
  Frontend renderizza QuizRenderer (bottoni cliccabili)                            │
    │                                                                              │
    ▼ (utente risponde ai quiz)                                                   │
EVALUATING                                                                         │
  AI valuta: openAnswerScore (40%) + quizScore (60%)                               │
  Rileva gaps specifici                                                             │
  Aggiorna detectedCompetenceLevel                                                 │
    │                                                                              │
    ├── score >= threshold ──► TOPIC_PASSED ──► next topic (o COMPLETE)           │
    │                                                                              │
    └── score < threshold                                                          │
          │                                                                        │
          ├── STRICT mode ──► TOPIC_FAILED ──► sessione marcata fallita           │
          │                                                                        │
          └── PERMISSIVE mode                                                      │
                │                                                                  │
                ├── retryCount < maxRetries                                        │
                │     adaptationDepth++                                            │
                │     retryCount++                                                 │
                │     ──────────────────────────────────────────────────────────► │
                │     (re-spiega focalizzandosi sui gaps, livello più semplice)    │
                │                                                                  │
                └── retryCount >= maxRetries                                       │
                      status = 'GAP_DETECTED'                                     │
                      ──► next topic (lacuna registrata nel report)               │
```

### Global Flow

```
[WARMUP?]          → opzionale, stesso sistema intervista
[TOPIC_LOOP]       → cicla su tutti i TrainingTopicBlock in ordine
[DATA_COLLECTION?] → opzionale, alla fine (stesso sistema intervista)
[COMPLETE]         → schermata finale + report
```

---

## 5. Service Layer

### New Files

```
/src/lib/training/
  training-supervisor.ts        ← state machine (clone semplificato di interview-supervisor.ts)
  training-plan-service.ts      ← genera piano base da topics (molto più semplice dell'interview)
  training-evaluator.ts         ← NUOVO: valuta risposte e calcola score
  training-runtime-knowledge.ts ← adatta runtime-knowledge.ts per training
  training-prompts.ts           ← prompt per ogni fase
  training-types.ts             ← tutti i tipi TypeScript

/src/services/
  training-service.ts           ← orchestrazione sessione (≈ interview-service.ts)
```

### training-evaluator.ts (nuovo, non esiste nell'intervista)

```typescript
// Valuta risposta aperta
evaluateOpenAnswer(
  question: string,
  answer: string,
  learningObjectives: string[],
  competenceLevel: string
): Promise<{ score: number; gaps: string[]; feedback: string }>

// Valuta quiz strutturati
evaluateQuiz(
  questions: QuizQuestion[],
  answers: number[]  // indici selezionati dall'utente
): { score: number; wrongAnswers: QuizQuestion[] }

// Score finale pesato
computeTopicScore(openScore: number, quizScore: number): number
// → 0.4 * openScore + 0.6 * quizScore

// Rileva livello competenza reale dall'history
detectCompetenceLevel(
  messages: TrainingMessage[]
): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
```

### Prompt Templates (training-prompts.ts)

```typescript
EXPLAINING: `Sei un tutor esperto in [topic].
  Stai spiegando a un trainee con:
  - Livello scolastico: [educationLevel]
  - Competenza dichiarata: [competenceLevel]
  - Adattamento corrente: depth=[adaptationDepth] (0=normale, 1=semplificato, 2=massima semplicità)
  Obiettivi di apprendimento: [learningObjectives]
  [kbContent ? "Usa questa fonte:" + kbContent : "Usa la tua conoscenza generale"]
  Spiega il concetto con esempi pratici. Sii chiaro e progressivo.`

CHECKING: `Hai spiegato [topic]. Fai UNA domanda aperta per verificare la comprensione.
  Difficoltà: [adaptedComplexity based on depth]
  Non fare domande a risposta multipla. Aspetta la risposta dell'utente.`

QUIZZING: `[Se preWrittenQuizzes] Usa queste domande: [preWrittenQuizzes]
  [Altrimenti] Genera [n] domande su [topic].
  Ogni domanda deve essere: { type, question, options, correctIndex }
  Difficoltà: [adaptedComplexity]`

EVALUATING: `Valuta questa risposta aperta:
  Domanda: [question]
  Risposta trainee: [answer]
  Obiettivi: [learningObjectives]
  Ritorna JSON: { score: 0-100, gaps: string[], feedback: string }`

RETRYING: `Il trainee non ha superato [topic] (score: [score]/[threshold]).
  Lacune rilevate: [gaps]
  Re-spiega concentrandoti SOLO sulle lacune, usando:
  - Linguaggio ancora più semplice (depth=[newDepth])
  - Esempi più concreti e quotidiani
  - Analogie semplici se utile
  Non ripetere ciò che ha già capito bene.`
```

---

## 6. API Route

```
/src/app/api/training-chat/route.ts  (≈ /api/chat/route.ts)

POST handler:
  1. Valida request: { messages, sessionId, botId }
  2. Carica TrainingBot + topics + KB
  3. Ricostruisce TrainingSupervisorState dalla sessione
  4. Determina fase corrente tramite supervisor
  5. Genera risposta LLM appropriata alla fase
  6. Se QUIZZING → genera anche quizPayload (quiz strutturato)
  7. Se EVALUATING → chiama training-evaluator, aggiorna topicResults
  8. Aggiorna stato supervisor → avanza fase o topic
  9. Persiste messaggio + stato aggiornato in DB
  10. Ritorna: { text, phase, quizPayload?, topicResult? }

Response shape:
  {
    text: string              // messaggio testuale del bot
    phase: TrainingPhase      // fase corrente (per UI)
    quizPayload?: {           // solo in fase QUIZZING
      questions: QuizQuestion[]
    }
    topicResult?: TopicResult // solo dopo EVALUATING
    sessionComplete?: boolean // true quando tutti i topic sono conclusi
  }
```

---

## 7. Frontend — Trainee-Facing

### Pages

```
/src/app/t/[slug]/page.tsx           ← Landing page (≈ /app/i/[slug]/page.tsx)
  - Bot lookup by slug
  - Crea TrainingSession con participantId
  - Mostra: nome corso, learningGoal, topic preview, durata stimata
  - Redirect a /t/chat/[sessionId]

/src/app/t/chat/[sessionId]/page.tsx ← Chat (≈ /app/i/chat/[conversationId]/)
  - Renderizza <TrainingChat>
```

### Components

```
/src/components/training/
  TrainingChat.tsx              ← shell principale (≈ InterviewChat.tsx)
  QuizRenderer.tsx              ← NUOVO: renderizza quiz strutturati con bottoni
  TrainingProgressBar.tsx       ← variante con stati per-topic (✅ ⚠️ ❌)
  TrainingCompletionScreen.tsx  ← schermata finale con score e riepilogo topic

  (riusati da interview):
  WelcomeScreen.tsx
  WarmupQuestion.tsx            ← se warmup attivo
```

### QuizRenderer.tsx

Il componente intercetta `quizPayload` dalla response API e renderizza:
- **MULTIPLE_CHOICE**: bottoni radio cliccabili con testo opzione
- **TRUE_FALSE**: due bottoni "Vero" / "Falso"

Quando l'utente seleziona e conferma, il frontend invia la risposta come messaggio testuale normalizzato (es. "Opzione B: [testo opzione]"), permettendo al backend di evaluare senza logica speciale nel frontend.

### TrainingProgressBar.tsx

A differenza dell'intervista (che mostra progress semantico/numerico), la progress bar del training mostra ogni topic con il suo stato:

```
Topic 1: ✅  Topic 2: ✅  Topic 3: 🔄 (corrente)  Topic 4: ○  Topic 5: ○
```

Dopo completamento: `✅ = PASSED`, `⚠️ = GAP_DETECTED`, `❌ = FAILED`.

---

## 8. Dashboard Admin

### Pages

```
/src/app/dashboard/training/
  page.tsx                     ← lista training bots (≈ dashboard/interviews)
  new/page.tsx                 ← crea nuovo training bot
  [botId]/
    page.tsx                   ← overview: score medio, tasso completamento
    settings/page.tsx          ← form configurazione
    sessions/page.tsx          ← lista sessioni trainee
    sessions/[sessionId]/page.tsx ← report singola sessione

/src/components/training/admin/
  training-bot-config-form.tsx ← form configurazione (≈ bot-config-form.tsx)
  training-session-profile.tsx ← report sessione (≈ conversation-profile.tsx)
  training-analytics.tsx       ← grafici analytics
```

### Training Bot Config Form — Sezioni

```
1. Identità
   nome, slug, lingua, tono, introMessage, welcomeTitle, welcomeSubtitle

2. Obiettivo formativo
   learningGoal, targetAudience

3. Profilo trainee (NUOVO rispetto all'intervista)
   traineeEducationLevel: [PRIMARY | SECONDARY | UNIVERSITY | PROFESSIONAL]
   traineeCompetenceLevel: [BEGINNER | INTERMEDIATE | ADVANCED | EXPERT]

4. Valutazione (NUOVO)
   failureMode: [STRICT | PERMISSIVE]
   passScoreThreshold: 0-100 (default 70%)
   maxRetries: 1-5 (solo per PERMISSIVE)

5. Topics (adattato da intervista)
   Per ogni TrainingTopicBlock:
   - label, description
   - learningObjectives (array di stringhe)
   - preWrittenQuizzes (opzionale, editor JSON o form guidato)
   - passScoreOverride (opzionale)
   - maxRetriesOverride (opzionale)

6. Knowledge Base
   upload documenti (stesso sistema intervista)

7. Raccolta dati trainee (opzionale)
   collectTraineeData toggle
   traineeDataFields (nome, email, reparto, ruolo, ecc.)

8. Reward / Certificato (opzionale)
   rewardConfig (riusa sistema esistente)
   tipo certificato: PDF scaricabile

9. Branding
   logo, colori (se piano permette)

10. Modello AI
    provider, modelName
```

### Training Session Profile (Report)

```
Header:
  trainee info (se raccolta attiva) | data sessione | durata | score globale | PASSED/FAILED

Topic Results:
  Per ogni topic:
  ├── label + status badge (✅ PASSED | ⚠️ GAP_DETECTED | ❌ FAILED)
  ├── score: XX% (open: XX% + quiz: XX%)
  ├── retries: N
  ├── gaps: ["lacuna 1", "lacuna 2"]
  └── feedback AI (testo)

Livello competenza:
  Configurato: [INTERMEDIATE] → Rilevato: [BEGINNER]  ← insight utile per formatore

Transcript completo (collassabile)
```

### Analytics Dashboard

```
Metriche aggregate per TrainingBot:
├── Tasso completamento (COMPLETED / STARTED)
├── Score medio globale
├── Score medio per topic → identifica lacune sistematiche
├── Topic più difficili (ordinati per retry rate)
├── Distribuzione livello competenza rilevato vs dichiarato
└── Trend nel tempo
```

---

## 9. Analytics e Credit Tracking

```typescript
// Nuovo TokenCategory
enum TokenCategory {
  INTERVIEW,  // esistente
  CHATBOT,    // esistente
  TRAINING,   // NUOVO
}

// Tracking utilizzo
TrainingBot:
  trainingSessionsUsedThisMonth: Int  // aggiunto a Subscription

// canStartTraining(organizationId): stesso pattern di canStartInterview()
```

---

## 10. What Is Reused vs New

### Riusato senza modifiche
- `KnowledgeSource` model e upload API
- `RewardConfig` model (certificato = reward di tipo CERTIFICATE)
- `Organization`, `User`, `Subscription` models
- `TokenLog` (+ nuova categoria TRAINING)
- Auth middleware
- LLM service (`generateText`, `generateObject`)
- UI shell components (message bubbles, input, modal, etc.)
- Branding system (colori, logo)
- Warmup system (opzionale, identico)
- Data collection system (fine sessione, identico)

### Clonato e modificato
- `Bot` → `TrainingBot` (nuovi campi training-specific)
- `TopicBlock` → `TrainingTopicBlock` (learningObjectives, quiz, score threshold)
- `Conversation` → `TrainingSession`
- `Message` → `TrainingMessage` (+ phase field)
- `interview-supervisor.ts` → `training-supervisor.ts` (logica completamente diversa)
- `plan-service.ts` → `training-plan-service.ts` (molto semplificato)
- `runtime-knowledge.ts` → `training-runtime-knowledge.ts`
- `/app/i/` pages → `/app/t/` pages
- `/api/chat/` → `/api/training-chat/`
- Dashboard interview pages → dashboard training pages
- `bot-config-form.tsx` → `training-bot-config-form.tsx`
- `InterviewChat.tsx` → `TrainingChat.tsx`

### Nuovo (non esiste nell'intervista)
- `training-evaluator.ts` — valutazione score + gap detection
- `training-prompts.ts` — prompt per ogni fase training
- `QuizRenderer.tsx` — UI per quiz strutturati
- `TrainingProgressBar.tsx` — progress bar con stato per-topic
- `TrainingCompletionScreen.tsx` — schermata finale con riepilogo
- `training-session-profile.tsx` — report sessione nel dashboard
- `training-analytics.tsx` — analytics specifici training

---

## 11. URL Structure

```
Trainee-facing:
  /t/[slug]                    ← landing page training
  /t/chat/[sessionId]          ← sessione training

Admin dashboard:
  /dashboard/training          ← lista training bots
  /dashboard/training/new      ← crea training bot
  /dashboard/training/[botId]  ← overview training bot
  /dashboard/training/[botId]/settings    ← configurazione
  /dashboard/training/[botId]/sessions    ← lista sessioni
  /dashboard/training/[botId]/sessions/[sessionId]  ← report sessione
```

---

## 12. Implementation Phases (suggested)

**Phase 1 — Foundation**
- DB schema (TrainingBot, TrainingTopicBlock, TrainingSession, TrainingMessage + enums)
- Prisma migration
- Basic CRUD API for TrainingBot

**Phase 2 — Core Flow**
- training-supervisor.ts (state machine)
- training-evaluator.ts (scoring)
- training-prompts.ts
- /api/training-chat route
- TrainingSession management

**Phase 3 — Frontend Trainee**
- /app/t/[slug] landing page
- /app/t/chat/[sessionId] chat interface
- TrainingChat, QuizRenderer, TrainingProgressBar components
- TrainingCompletionScreen

**Phase 4 — Dashboard Admin**
- training-bot-config-form (all sections)
- Dashboard pages (list, overview, settings, sessions)
- training-session-profile (report)
- training-analytics

**Phase 5 — Polish**
- Certificate PDF generation (reward system extension)
- Credit/usage tracking (TRAINING category)
- Analytics aggregation
- Edge cases and error handling

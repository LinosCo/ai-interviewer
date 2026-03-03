# Design: Training KB + Adaptive Socratic Tutor

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Training bot — knowledge base upload, conversational adaptive tutor, final quiz

---

## 1. Problem Statement

The training bot system currently has three gaps:

1. **No KB upload UI for TrainingBot** — the existing knowledge management UI only targets regular chatbot `Bot` models. `TrainingBot.knowledgeSources` exists in the DB (via `trainingBotId`) but there is no admin interface or API to populate it.
2. **Linear, scripted tutoring** — the current flow (`EXPLAINING → CHECKING (1 turn) → QUIZZING → RETRYING`) does not support real back-and-forth dialogue. A student who misunderstands gets one retry, not a genuine Socratic conversation.
3. **Quiz only per-topic, no final exam** — there is no comprehensive end-of-course verification across all topics.

---

## 2. Decisions

| Question | Decision |
|----------|----------|
| KB scope | **Bot-level** (shared across all topics) |
| KB content types | **File upload + text paste + URL scrape** |
| Tutor behavior | **Multi-turn DIALOGUING** — adaptive Socratic 1-to-1, comprehension-driven |
| Checking turns | **Configurable per topic** (minCheckingTurns, maxCheckingTurns) |
| Quiz timing | **Final quiz only** — conversational dialogue per topic, single comprehensive quiz at end |
| Quiz question types | **MULTIPLE_CHOICE + TRUE_FALSE + OPEN_ANSWER** |
| Engagement tracking | **Yes** — comprehensionHistory stored in supervisorState, surfaced in admin reports |

---

## 3. New Session Flow

### Old flow (deprecated for new sessions)
```
EXPLAINING → CHECKING (1 turn) → QUIZZING → EVALUATING → RETRYING → (next topic) → COMPLETE
```

### New flow
```
For each topic:
  EXPLAINING  →  DIALOGUING (min–max turns, configurable per topic)
                    ↑ after each student turn: silent AI comprehension evaluation
                    ↑ if comprehension low: change approach (example, prerequisite, simpler)
                    ↑ if comprehension ok AND minTurns reached: advance to next topic
                    ↑ if maxTurns reached: advance anyway, gaps recorded

After all topics:
  FINAL_QUIZZING  →  COMPLETE
    (comprehensive quiz, weighted by gaps accumulated during dialogue)
```

### New TrainingPhase enum values (additive)
- `DIALOGUING` — replaces CHECKING + per-topic QUIZZING
- `FINAL_QUIZZING` — end-of-course comprehensive quiz

Existing phases (`CHECKING`, `QUIZZING`, `RETRYING`) are **deprecated** but retained for backward compatibility (old sessions remain readable).

---

## 4. DB Changes

### `TrainingTopicBlock` — new fields
```sql
ALTER TABLE "TrainingTopicBlock"
  ADD COLUMN IF NOT EXISTS "minCheckingTurns" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "maxCheckingTurns" INTEGER NOT NULL DEFAULT 6;
```

### `TrainingPhase` enum — new values
```sql
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'DIALOGUING';
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'FINAL_QUIZZING';
```

### `KnowledgeSource` — already has `trainingBotId` (added in repair migration)
No schema change needed.

---

## 5. State Machine (`supervisorState`)

### New shape
```typescript
interface TrainingSupervisorState {
  phase: 'EXPLAINING' | 'DIALOGUING' | 'FINAL_QUIZZING' | 'COMPLETE'
    // legacy (kept for old sessions): 'CHECKING' | 'QUIZZING' | 'RETRYING' | 'EVALUATING' | 'DATA_COLLECTION'
  currentTopicIndex: number
  dialogueTurns: number              // current turn count in DIALOGUING for current topic
  comprehensionHistory: Array<{      // one entry per DIALOGUING turn
    topicIndex: number
    turn: number
    comprehensionLevel: number       // 0–100
    engagementLevel: 'high' | 'medium' | 'low'
    gaps: string[]
    understoodConcepts: string[]
    suggestedApproach: 'deepen' | 'clarify' | 'example' | 'simpler' | 'prerequisite' | 'summarize'
  }>
  topicResults: Array<{
    topicId: string
    topicLabel: string
    finalComprehension: number       // average comprehensionLevel across turns
    gaps: string[]                   // cumulative gaps not resolved
    understoodConcepts: string[]
    turnsUsed: number
  }>
  finalQuizQuestions?: QuizQuestion[]   // set when entering FINAL_QUIZZING
  detectedCompetenceLevel: string
  adaptationDepth: number
  // legacy fields retained:
  pendingCheckQuestion?: string
  pendingQuizzes?: QuizQuestion[]
  pendingRetryGaps?: string[]
  retryCount: number
}
```

---

## 6. QuizQuestion Type Extension

```typescript
interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_ANSWER'
  question: string
  options?: string[]           // only for MC and TF
  correctIndex?: number        // only for MC and TF
  expectedKeyPoints?: string[] // only for OPEN_ANSWER
}
```

UI: `QuizRenderer` switches to a `<textarea>` when `type === 'OPEN_ANSWER'`. Evaluation uses existing `evaluateOpenAnswer()`.

---

## 7. New Prompt Functions (`training-prompts.ts`)

### `buildDialoguePrompt(ctx, turnHistory, comprehensionHistory)`

A rich Socratic tutor prompt with built-in pedagogical meta-instructions:

```
Sei un tutor esperto in sessioni 1-to-1 di apprendimento adattivo. [langInstruction]

TOPIC CORRENTE: "[label]"
[Descrizione se presente]
OBIETTIVI: [learningObjectives]
PROFILO STUDENTE: [educationLevel], competenza [competenceLevel]
TURNO: [dialogueTurns]/[maxCheckingTurns] (minimo per avanzare: [minCheckingTurns])

KNOWLEDGE BASE:
[kbContent | "Usa conoscenza generale"]

CRONOLOGIA COMPRENSIONE (turni precedenti):
[per ogni entry: turno N — comp: X% — engagement: Y — gaps: [...] — approccio: Z]

PRINCIPI DI CONDUZIONE (seguili sempre):
1. Una sola interazione per turno. Non fare liste di domande.
2. Risposta corretta e completa → approfondisci (livello Bloom superiore: applica, analizza, sintetizza)
3. Risposta parziale → chiedi chiarimento su ciò che manca specificamente
4. Risposta errata → non correggere direttamente. Usa: domanda di ritorno ("Come mai pensi questo?"),
   esempio pratico, analogia, oppure torna al prerequisito a monte
5. Engagement basso (risposte brevi, monosillabi, "non so") → cambia registro:
   usa un caso concreto della vita reale, chiedi "ha senso per te?",
   connetti il concetto al loro contesto professionale/personale
6. Dopo [minCheckingTurns] turni E comprensione adeguata → concludi con un breve riepilogo
   del topic e segnala che passi al prossimo argomento

APPROCCIO SUGGERITO (basato sulla valutazione del turno precedente): [suggestedApproach]
```

### `evaluateDialogueTurn(answer, topic, objectives, conversationHistory)` → `generateObject`

Silent evaluation after each student turn. Returns:
```typescript
z.object({
  comprehensionLevel: z.number().min(0).max(100),
  engagementLevel: z.enum(['high', 'medium', 'low']),
  gaps: z.array(z.string()),
  understoodConcepts: z.array(z.string()),
  readyToProgress: z.boolean(),  // true if minTurns met AND comprehension > threshold
  suggestedApproach: z.enum([
    'deepen', 'clarify', 'example', 'simpler', 'prerequisite', 'summarize'
  ])
})
```

### `buildFinalQuizSystemPrompt(allTopics, topicResults, language)`

Generates a comprehensive final quiz weighted by dialogue gaps:
```
Genera un quiz finale che copra tutti i topic del percorso.
Pesa domande e difficoltà in proporzione alle lacune rilevate nel dialogo:
[per ogni topic: label, finalComprehension%, gaps[]]
- Topic con comprensione < 60% → 2-3 domande, includi OPEN_ANSWER
- Topic con comprensione 60-85% → 2 domande MULTIPLE_CHOICE
- Topic con comprensione > 85% → 1 domanda TRUE_FALSE di conferma
Tipi disponibili: MULTIPLE_CHOICE, TRUE_FALSE, OPEN_ANSWER
```

---

## 8. API Changes

### New: Training KB endpoints
```
GET    /api/training-bots/[botId]/knowledge
       → { sources: [{ id, title, type, charCount, createdAt }] }

POST   /api/training-bots/[botId]/knowledge
       body: { type: 'file', title: string, content: string }
           | { type: 'text', title: string, content: string }
           | { type: 'url',  url: string }
       → { source: KnowledgeSource }

DELETE /api/training-bots/[botId]/knowledge/[sourceId]
       → 204
```

### Modified: `training-service.ts`

**KB aggregation** (replaces `bot.knowledgeSources[0]?.content`):
```typescript
const kbContent = bot.knowledgeSources.length > 0
  ? bot.knowledgeSources
      .map(s => `## ${s.title}\n${s.content}`)
      .join('\n\n---\n\n')
      .slice(0, 12_000)
  : undefined
```

**New phase handlers** in `processTrainingMessage`:
- `case 'EXPLAINING'` → same as before, but transitions to `DIALOGUING` instead of `CHECKING`
- `case 'DIALOGUING'` → runs `buildDialoguePrompt` + `evaluateDialogueTurn` in parallel;
  if `readyToProgress || dialogueTurns >= maxCheckingTurns` → save topicResult, advance topic or enter `FINAL_QUIZZING`
- `case 'FINAL_QUIZZING'` → handles mixed question types; `OPEN_ANSWER` evaluated via `evaluateOpenAnswer`

---

## 9. UI Changes

### Training bot settings page — new "Conoscenza" tab
- List of existing KB sources (title, type badge, char count, date, delete button)
- Three input modes:
  - **Carica file** — drag-and-drop / file picker (txt, pdf, docx, md)
  - **Incolla testo** — title field + large textarea
  - **Aggiungi URL** — URL input + "Scarica" button (uses existing scrape API)

### Topic block editor — new fields per topic
- `minCheckingTurns` — number input, default 2, range 1–4, label "Turni minimi di dialogo"
- `maxCheckingTurns` — number input, default 6, range 3–12, label "Turni massimi"

### `QuizRenderer` — OPEN_ANSWER support
- New branch for `type === 'OPEN_ANSWER'`: renders `<textarea>` + submit button
- Sends answer text as `selectedIndexes: [-1]` with answer in a separate field, or as JSON

---

## 10. Files to Create / Modify

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `minCheckingTurns`, `maxCheckingTurns` to `TrainingTopicBlock`; add `DIALOGUING`, `FINAL_QUIZZING` to `TrainingPhase` enum |
| `prisma/migrations/20260301_training_dialogue_kb/migration.sql` | New idempotent migration |
| `src/lib/training/training-types.ts` | Extend `TrainingSupervisorState`, `QuizQuestion` |
| `src/lib/training/training-prompts.ts` | Add `buildDialoguePrompt`, `evaluateDialogueTurn`, `buildFinalQuizSystemPrompt` |
| `src/lib/training/training-supervisor.ts` | Update state transitions for new phases |
| `src/lib/training/training-service.ts` | New phase handlers (`DIALOGUING`, `FINAL_QUIZZING`), KB aggregation |
| `src/app/api/training-bots/[botId]/knowledge/route.ts` | NEW — GET + POST |
| `src/app/api/training-bots/[botId]/knowledge/[sourceId]/route.ts` | NEW — DELETE |
| `src/components/training/admin/training-bot-config-form.tsx` | Add `minCheckingTurns`/`maxCheckingTurns` fields per topic |
| `src/components/training/admin/TrainingKnowledgePanel.tsx` | NEW — KB management UI panel |
| `src/app/dashboard/training/[botId]/settings/page.tsx` | Add "Conoscenza" tab with `TrainingKnowledgePanel` |
| `src/components/training/QuizRenderer.tsx` | Add `OPEN_ANSWER` branch |

---

## 11. Token Budget

Each DIALOGUING turn makes **2 AI calls**:
1. `buildDialoguePrompt` → `generateText` (tutor response, ~500-800 tokens)
2. `evaluateDialogueTurn` → `generateObject` (silent evaluation, ~200-300 tokens)

With max 6 turns per topic and 4 topics: ~56 calls max per session. Acceptable for `gpt-4o-mini` (~$0.02/session at max).

---

## 12. Backward Compatibility

- Old sessions with `phase: 'CHECKING' | 'QUIZZING' | 'RETRYING'` remain readable in the admin UI
- The `processTrainingMessage` service keeps the old `case` branches for these phases
- New sessions created after deployment use the new flow automatically
- No data migration needed — old sessions are already `COMPLETED` or `FAILED`

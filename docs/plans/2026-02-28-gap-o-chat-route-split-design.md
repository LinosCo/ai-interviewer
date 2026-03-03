# Design: Gap O — Split chat/route.ts

**Date**: 2026-02-28
**Status**: Approved (autonomous sprint)
**Gap**: O — File chat/route.ts too large (2601 lines)
**Effort estimate**: 4-6 hours

---

## Problem

`src/app/api/chat/route.ts` is 2601 lines containing:

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–77 | 30+ imports from lib modules |
| Config / Types / Schema | 66–172 | CONFIG, InterviewState, ChatRequestSchema |
| `isLocalSimulationRequest` | 78–85 | Route-level simulation guard |
| `extractFieldFromMessage` | 174–237 | LLM field extraction |
| `checkUserIntent` | 238–330 | Consent/refusal intent detection |
| `detectExplicitClosureIntent` | 331–375 | User closure intent detection |
| `generateQuestionOnly` | 376–460 | Question-only LLM generation |
| `generateDeepOfferOnly` | 461–504 | Deep offer LLM generation |
| `enforceDeepOfferQuestion` | 505–544 | DEEP_OFFER safety enforcement |
| `completeInterview` | 545–590 | Profile save on interview end |
| `POST` (main handler) | 591–2601 | 6-section orchestrator (2011 lines) |

The 8 helper functions (lines 78–590) belong in domain-specific lib files. The POST handler's 6 sections share ~50 local variables that flow through all phases.

---

## Chosen Approach: Extract by Concern + Local Sub-functions

Chosen over full context-object pipeline (Approach B) because:
- Context object would need 40+ fields — complex typing, high TS error risk
- Local arrow functions (closures) let sections share state without parameter passing
- Net result: ~60% reduction in route.ts, each lib file is small and focused

### Not doing
- Approach B (context-object pipeline): too risky for a lateral refactoring
- Splitting POST into named top-level functions that take 20+ params: anti-pattern
- Moving types to a separate file: types are already used locally, low value

---

## Target Architecture

### New files created

#### `src/lib/interview/chat-intent.ts`
- `extractFieldFromMessage()` — LLM-based single-field extraction
- `checkUserIntent()` — detect consent/refusal/neutral intent
- `detectExplicitClosureIntent()` — detect explicit "I want to stop" signals

**Concern**: Intent detection via LLM
**Size target**: ~200 lines

#### `src/lib/interview/question-generator.ts`
- `generateQuestionOnly()` — generate just the next question text
- `generateDeepOfferOnly()` — generate just the extension consent question
- `enforceDeepOfferQuestion()` — fix an invalid DEEP_OFFER response

**Concern**: LLM-based question generation
**Size target**: ~180 lines

#### `src/lib/interview/interview-completion.ts`
- `completeInterview()` — save final profile, mark conversation complete

**Concern**: Interview lifecycle finalization
**Size target**: ~60 lines

### Modified files

#### `src/app/api/chat/route.ts` (2601 → ~800 lines)
- Keeps: `isLocalSimulationRequest`, imports, config, types, schema
- Removes: the 8 helper functions (moved to lib)
- POST handler: refactored into 6 named local async arrow functions:
  - `loadData()` — DB fetches (section 1+2)
  - `runPhaseMachine()` — phase transitions (section 3)
  - `buildPrompt()` — PromptBuilder assembly (section 4)
  - `generateAndProcess()` — LLM call + post-processing (section 5)
  - `saveState()` — DB writes (section 6)
  - POST calls these in sequence, streaming the result

---

## Types/Interfaces Strategy

Types used only inside route.ts stay there:
- `InterviewState` — keep in route.ts (exported for simulate/route.ts)
- `QualityTelemetry`, `FlowGuardTelemetry`, `LLMUsagePayload`, `LLMUsageCollector` — keep in route.ts

Types needed by extracted files:
- `LLMUsageCollector` — pass as parameter where needed (already a function type)

---

## Shared State Strategy in POST Handler

The 6 sections share ~50 local variables. Rather than a context object, we use **local named arrow functions that close over the same `let` scope**:

```typescript
export async function POST(req: Request) {
    // ... parse request ...

    // Shared mutable state
    let interviewState: InterviewState = defaultState;
    let nextState: InterviewState = defaultState;
    let responseText = '';
    // ... etc

    // Section sub-functions (closures)
    const loadData = async () => { /* reads from req, writes to shared let vars */ };
    const runPhaseMachine = async () => { /* reads/writes interviewState, nextState */ };
    const buildPrompt = async () => { /* reads state, builds promptBuilder */ };
    const generateAndProcess = async () => { /* calls LLM, sets responseText */ };
    const saveState = async () => { /* writes nextState to DB */ };

    // Orchestration
    await loadData();
    await runPhaseMachine();
    await buildPrompt();
    const stream = await generateAndProcess();
    await saveState();
    return stream;
}
```

This pattern is safe because:
- No behavioral change — execution order is identical
- TypeScript can still verify all types
- Each section is clearly named and independently readable
- No parameter passing complexity

---

## Success Criteria

- [ ] `route.ts` ≤ 900 lines
- [ ] 3 new lib files created with JSDoc comments
- [ ] `tsc --noEmit` still at ≤97 errors (no regressions)
- [ ] `/api/chat` still returns correct streaming responses
- [ ] All imports resolve correctly
- [ ] `git diff --stat` shows only the target files changed

---

## Risk Mitigation

- Do extractions one file at a time, verify TS after each
- Export all extracted functions — don't break `simulate/route.ts` which imports `InterviewState`
- Run `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l` after each step
- No DB schema changes
- No API contract changes

---

## Implementation Order

1. Create `chat-intent.ts` — move `extractFieldFromMessage`, `checkUserIntent`, `detectExplicitClosureIntent`
2. Verify TS error count
3. Create `question-generator.ts` — move `generateQuestionOnly`, `generateDeepOfferOnly`, `enforceDeepOfferQuestion`
4. Verify TS error count
5. Create `interview-completion.ts` — move `completeInterview`
6. Verify TS error count
7. Refactor POST handler into named local arrow functions
8. Final TS verification + commit

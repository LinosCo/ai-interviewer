# Gap O — chat/route.ts Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `src/app/api/chat/route.ts` from 2601 lines to ~2100 by extracting 8 helper functions into 3 focused lib modules.

**Architecture:** Extract by concern — intent detection, question generation, interview completion. Each new file is independently importable and unit-testable. The POST handler keeps its section comments unchanged (too much shared state to safely extract into top-level functions in one pass). `LLMUsageCollector` type is defined in `chat-intent.ts` and re-exported for use by other new files.

**Tech Stack:** TypeScript, Next.js 14, Vercel AI SDK (`generateObject`), OpenAI, Zod, Prisma.

---

## Verification command (run after every task)

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected output: `97` (no regressions). If count rises, the task introduced a TS error — fix before committing.

---

## Task 1: Create `src/lib/interview/chat-intent.ts`

**Files:**
- Create: `src/lib/interview/chat-intent.ts`
- Modify: `src/app/api/chat/route.ts` (add 3 imports, delete 3 functions + types)

### Step 1: Create the new file

Create `src/lib/interview/chat-intent.ts` with this exact content:

```typescript
/**
 * chat-intent.ts
 * LLM-based intent detection helpers for the interview chat route.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { isClarificationSignal } from '@/lib/chat/response-builder';

// ---------------------------------------------------------------------------
// Shared types (exported so question-generator.ts and interview-completion.ts
// can import without duplicating the definition)
// ---------------------------------------------------------------------------

export interface LLMUsagePayload {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
}

export type LLMUsageCollector = (payload: {
    source: string;
    model?: string | null;
    usage?: LLMUsagePayload | null;
}) => void;

// ---------------------------------------------------------------------------
// extractFieldFromMessage
// ---------------------------------------------------------------------------

/**
 * Extracts a single candidate data field (name, email, phone, etc.) from a
 * free-text user message using a gpt-4o-mini classification call.
 */
export async function extractFieldFromMessage(
    fieldName: string,
    userMessage: string,
    apiKey: string,
    language: string = 'en',
    options?: { onUsage?: LLMUsageCollector }
): Promise<{ value: string | null; confidence: 'high' | 'low' | 'none' }> {
    const openai = createOpenAI({ apiKey });

    const fieldDescriptions: Record<string, string> = {
        name: language === 'it'
            ? 'Nome della persona (può essere solo nome, o nome e cognome)'
            : 'Name of the person (can be first name only, or full name)',
        fullName: language === 'it'
            ? 'Nome della persona (può essere solo nome, o nome e cognome)'
            : 'Name of the person (can be first name only, or full name)',
        email: language === 'it' ? 'Indirizzo email' : 'Email address',
        phone: language === 'it' ? 'Numero di telefono' : 'Phone number',
        company: language === 'it' ? 'Nome dell\'azienda o organizzazione' : 'Company or organization name',
        linkedin: language === 'it' ? 'URL del profilo LinkedIn o social' : 'LinkedIn or social profile URL',
        portfolio: language === 'it' ? 'URL del portfolio o sito web personale' : 'Portfolio or personal website URL',
        role: language === 'it' ? 'Ruolo o posizione lavorativa' : 'Job role or position',
        location: language === 'it' ? 'Città o località' : 'City or location',
        budget: language === 'it' ? 'Budget disponibile' : 'Available budget',
        availability: language === 'it' ? 'Disponibilità temporale' : 'Time availability'
    };

    const schema = z.object({
        extractedValue: z.string().nullable(),
        confidence: z.enum(['high', 'low', 'none'])
    });

    try {
        let fieldSpecificRules = '';
        if (fieldName === 'name' || fieldName === 'fullName') {
            fieldSpecificRules = `\n- For name: Accept first name only (e.g., "Marco", "Franco", "Anna"). Don't require full name.\n- If the message contains a word that looks like a name, extract it.`;
        } else if (fieldName === 'company') {
            fieldSpecificRules = `\n- For company: Look for business names, often ending in spa, srl, ltd, inc, llc, or containing words like "azienda", "società", "company".\n- Extract the company name even if mixed with other info (e.g., "Ferri spa e sono ceo" → extract "Ferri spa").\n- Accept any business/organization name the user provides.`;
        } else if (fieldName === 'role') {
            fieldSpecificRules = `\n- For role: Look for job titles like CEO, CTO, manager, developer, designer, etc.\n- Extract the role even if mixed with other info (e.g., "Ferri spa e sono ceo" → extract "ceo").`;
        }

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `Extract "${fieldName}" (${fieldDescriptions[fieldName] || fieldName}) from: "${userMessage}"\n\nRules:\n- Return null if not found\n- Do NOT infer name from email address\n- For email: look for xxx@xxx.xxx pattern\n- For phone: look for numeric sequences${fieldSpecificRules}`,
            temperature: 0
        });
        options?.onUsage?.({
            source: 'extract_field_from_message',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return { value: result.object.extractedValue, confidence: result.object.confidence };
    } catch (e) {
        console.error(`Field extraction failed for "${fieldName}":`, e);
        return { value: null, confidence: 'none' };
    }
}

// ---------------------------------------------------------------------------
// checkUserIntent
// ---------------------------------------------------------------------------

/**
 * Classifies a user message as ACCEPT / REFUSE / NEUTRAL for a given context
 * (data collection consent, extension offer, or stop confirmation).
 */
export async function checkUserIntent(
    userMessage: string,
    apiKey: string,
    language: string,
    context: 'consent' | 'deep_offer' | 'stop_confirmation',
    options?: { onUsage?: LLMUsageCollector }
): Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'> {
    const normalized = String(userMessage || '')
        .trim()
        .toLowerCase()
        .replace(/[!?.,;:()\[\]"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Fast-path deterministic intent for extension consent to avoid accidental
    // accepts on unrelated content replies.
    if (context === 'deep_offer') {
        if (isClarificationSignal(userMessage, language)) return 'NEUTRAL';

        const refuseSet = new Set([
            'no', 'no grazie', 'direi di no', 'anche no', 'non ora',
            'meglio di no', 'preferisco di no', 'stop', 'basta'
        ]);
        const acceptSet = new Set([
            'si', 'sì', 'yes', 'ok', 'va bene', 'certo', 'volontieri',
            'continuiamo', 'proseguiamo', 'andiamo avanti'
        ]);

        if (refuseSet.has(normalized)) return 'REFUSE';
        if (acceptSet.has(normalized)) return 'ACCEPT';

        const refusePattern = /\b(non voglio continuare|non continuare|abbiamo gia parlato troppo|chiudiamo qui|fermiamoci|preferisco chiudere)\b/i;
        if (refusePattern.test(normalized)) return 'REFUSE';

        const acceptPattern = /\b(voglio continuare|possiamo continuare|continuiamo|proseguiamo|andiamo avanti|estendiamo)\b/i;
        if (acceptPattern.test(normalized)) return 'ACCEPT';
    }

    const openai = createOpenAI({ apiKey });

    const contextPrompts = {
        consent: `The system asked for contact details. Did the user agree?`,
        deep_offer: `The system asked whether the user wants to EXTEND the interview by a few minutes to continue. Did the user accept?`,
        stop_confirmation: `The system noticed the user might be tired or wants to stop, and asked for confirmation to conclude. Did the user confirm they want to STOP?`
    };

    const schema = z.object({
        intent: z.enum(['ACCEPT', 'REFUSE', 'NEUTRAL']),
        reason: z.string()
    });

    try {
        const classificationHints = context === 'consent'
            ? `ACCEPT = user agrees to share contact details; REFUSE = user declines; NEUTRAL = unrelated`
            : context === 'deep_offer'
                ? `ACCEPT = user explicitly agrees to extend/continue; REFUSE = user declines extension; NEUTRAL = unrelated or just answers content`
                : `ACCEPT = user confirms they want to stop; REFUSE = user wants to continue; NEUTRAL = unclear`;
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `${contextPrompts[context]}\nLanguage: ${language}\nUser message: "${userMessage}"\n\nClassify intent. ${classificationHints}.`,
            temperature: 0
        });
        options?.onUsage?.({
            source: `check_user_intent_${context}`,
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return result.object.intent;
    } catch (e) {
        console.error('Intent check failed:', e);
        return 'NEUTRAL';
    }
}

// ---------------------------------------------------------------------------
// detectExplicitClosureIntent
// ---------------------------------------------------------------------------

/**
 * Detects whether the user explicitly wants to conclude/stop the interview now.
 * Uses gpt-4o-mini with strict classification to avoid false positives.
 */
export async function detectExplicitClosureIntent(
    userMessage: string,
    apiKey: string,
    language: string,
    options?: { onUsage?: LLMUsageCollector }
): Promise<{ wantsToConclude: boolean; confidence: 'high' | 'medium' | 'low'; reason: string }> {
    const text = String(userMessage || '').trim();
    if (!text) {
        return { wantsToConclude: false, confidence: 'low', reason: 'empty_message' };
    }

    const openai = createOpenAI({ apiKey });
    const schema = z.object({
        wantsToConclude: z.boolean().describe('True only when the user explicitly wants to stop/conclude now.'),
        confidence: z.enum(['high', 'medium', 'low']),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                `Classify interviewee intent from a single message.`,
                `Language: ${language}`,
                `User message: "${text}"`,
                ``,
                `Return wantsToConclude=true ONLY if the user is explicitly asking to stop/end/conclude now, or clearly refusing to continue now.`,
                `Return false for normal topic answers, generic frustration without explicit stop request, uncertainty, or unrelated content.`,
                `Be strict: avoid false positives.`
            ].join('\n'),
            temperature: 0
        });
        options?.onUsage?.({
            source: 'detect_explicit_closure_intent',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return result.object;
    } catch (e) {
        console.error('Explicit closure intent detection failed:', e);
        return { wantsToConclude: false, confidence: 'low', reason: 'detection_error' };
    }
}
```

### Step 2: Update route.ts imports

At the top of `src/app/api/chat/route.ts`, AFTER the existing imports (after line 41), add:

```typescript
import {
    extractFieldFromMessage,
    checkUserIntent,
    detectExplicitClosureIntent,
    type LLMUsageCollector,
    type LLMUsagePayload,
} from '@/lib/interview/chat-intent';
```

### Step 3: Remove the 3 functions + types from route.ts

Delete from `src/app/api/chat/route.ts`:
- Lines 147–157: `interface LLMUsagePayload { ... }` and `type LLMUsageCollector = ...`
- Lines 173–233: `async function extractFieldFromMessage(...)`
- Lines 235–326: `async function checkUserIntent(...)`
- Lines 328–374: `async function detectExplicitClosureIntent(...)`

Also remove the now-redundant section comment at line 173:
```
// ============================================================================
```
(the one right before `extractFieldFromMessage`)

### Step 4: Verify TS error count

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `97`

### Step 5: Commit

```bash
git add src/lib/interview/chat-intent.ts src/app/api/chat/route.ts
git commit -m "refactor(gap-o): extract intent helpers to chat-intent.ts

Move extractFieldFromMessage, checkUserIntent, detectExplicitClosureIntent
and LLMUsageCollector/LLMUsagePayload types to src/lib/interview/chat-intent.ts.
No behavioral changes. route.ts -~210 lines.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create `src/lib/interview/question-generator.ts`

**Files:**
- Create: `src/lib/interview/question-generator.ts`
- Modify: `src/app/api/chat/route.ts`

### Step 1: Create the new file

Create `src/lib/interview/question-generator.ts`:

```typescript
/**
 * question-generator.ts
 * LLM-based question generation helpers for the interview chat route.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import {
    buildSoftDiagnosticHint,
    normalizeSingleQuestion,
    replaceLiteralTopicTitle,
    isExtensionOfferQuestion,
} from '@/lib/chat/response-builder';
import type { LLMUsageCollector } from '@/lib/interview/chat-intent';

// ---------------------------------------------------------------------------
// generateQuestionOnly
// ---------------------------------------------------------------------------

/**
 * Generates a single focused interview question for a given topic using
 * the provided LLM model instance.
 */
export async function generateQuestionOnly(params: {
    model: any;
    language: string;
    topicLabel: string;
    topicCue?: string | null;
    subGoal?: string | null;
    lastUserMessage?: string | null;
    previousAssistantQuestion?: string | null;
    semanticBridgeHint?: string | null;
    avoidBridgeStems?: string[];
    requireAcknowledgment?: boolean;
    transitionMode?: 'bridge' | 'clean_pivot';
    onUsage?: LLMUsageCollector;
}) {
    const {
        model,
        language,
        topicLabel,
        topicCue,
        subGoal,
        lastUserMessage,
        previousAssistantQuestion,
        semanticBridgeHint,
        avoidBridgeStems,
        requireAcknowledgment,
        transitionMode
    } = params;
    const questionSchema = z.object({
        question: z.string().describe("A single interview question ending with a question mark.")
    });

    const structureInstruction = requireAcknowledgment
        ? `Output structure: (1) one short acknowledgment sentence; (2) one specific question.`
        : `Output structure: one concise question.`;
    const transitionInstruction = transitionMode === 'bridge'
        ? `Transition mode: bridge naturally from the user's point to "${topicLabel}" without literal quotes.`
        : transitionMode === 'clean_pivot'
            ? `Transition mode: clean pivot. Use a neutral acknowledgment and do not paraphrase irrelevant user details.`
            : null;
    const diagnosticHint = buildSoftDiagnosticHint({
        language,
        lastUserMessage: lastUserMessage || '',
        topicLabel,
        subGoal: subGoal || ''
    });

    const prompt = [
        `Language: ${language}`,
        `Topic title (internal): ${topicLabel}`,
        topicCue ? `Natural topic cue for user-facing wording: ${topicCue}` : null,
        subGoal ? `Sub-goal: ${subGoal}` : null,
        lastUserMessage ? `User last message: "${lastUserMessage}"` : null,
        previousAssistantQuestion ? `Previous assistant question to avoid repeating: "${previousAssistantQuestion}"` : null,
        avoidBridgeStems && avoidBridgeStems.length > 0
            ? `Do NOT reuse these recent bridge openings (normalized): ${avoidBridgeStems.slice(0, 8).join(' | ')}`
            : null,
        semanticBridgeHint ? `Bridge hint: ${semanticBridgeHint}` : null,
        `Acknowledgment quality: reference one concrete detail from the user's message (fact, constraint, example, or cause/effect).`,
        `Avoid stock openers like "molto interessante", "e un punto importante", "grazie per aver condiviso", "very interesting", "that's an important point", "thanks for sharing".`,
        `Prefer concrete follow-ups over broad prompts like "cosa ne pensi?" / "what do you think?" unless no better signal is available.`,
        diagnosticHint || null,
        structureInstruction,
        transitionInstruction,
        `Task: Ask exactly ONE concise interview question about the topic. Do NOT close the interview. Do NOT ask for contact data. Avoid literal quote of user's words. Do NOT repeat the topic title verbatim; use natural phrasing. End with a single question mark.`
    ].filter(Boolean).join('\n');

    const result = await generateObject({
        model,
        schema: questionSchema,
        prompt,
        temperature: 0.2
    });
    params.onUsage?.({
        source: 'generate_question_only',
        model: (model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    let question = normalizeSingleQuestion(String(result.object.question || '').trim());
    if (topicCue) {
        question = replaceLiteralTopicTitle(question, topicLabel, topicCue);
    }
    return question;
}

// ---------------------------------------------------------------------------
// generateDeepOfferOnly
// ---------------------------------------------------------------------------

/**
 * Generates the extension-offer message that appears at the end of the
 * scheduled interview duration, asking whether the user wants to continue.
 */
export async function generateDeepOfferOnly(params: {
    model: any;
    language: string;
    extensionPreview?: string[];
    onUsage?: LLMUsageCollector;
}) {
    const schema = z.object({
        message: z.string().describe('A short message that ends with one yes/no extension question.')
    });

    const previewHints = (params.extensionPreview || [])
        .map(h => String(h || '').trim())
        .filter(Boolean)
        .slice(0, 1);
    const starterTheme = previewHints[0] || '';

    const prompt = [
        `Language: ${params.language}`,
        `Task: Write a short extension message with this structure:`,
        `1) Start with a short thank-you for the user's availability and answers so far.`,
        `2) Say naturally that the planned interview time is over (or would be over).`,
        starterTheme
            ? `3) Propose to continue and mention one indirect starting point connected to what the user shared, for example around: ${starterTheme}. Use no quotes, labels, or list formatting.`
            : `3) Propose to continue and mention one concrete single starting point connected to what the user shared, using indirect wording.`,
        `4) Ask exactly ONE yes/no question asking availability for a few more deep-dive questions.`,
        `Do NOT ask topic questions. Do NOT ask for contacts. Do NOT close the interview.`,
        `Keep it natural and concise. End with exactly one question mark.`
    ].join('\n');

    const result = await generateObject({
        model: params.model,
        schema,
        prompt,
        temperature: 0.2
    });
    params.onUsage?.({
        source: 'generate_deep_offer_only',
        model: (params.model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    return normalizeSingleQuestion(String(result.object.message || '').trim());
}

// ---------------------------------------------------------------------------
// enforceDeepOfferQuestion
// ---------------------------------------------------------------------------

/**
 * Ensures the current response text is a valid extension-offer question.
 * If not, attempts to regenerate. Falls back to a hardcoded bilingual template.
 */
export async function enforceDeepOfferQuestion(params: {
    model: any;
    language: string;
    currentText?: string | null;
    extensionPreview?: string[];
    onUsage?: LLMUsageCollector;
}) {
    const { model, language, currentText, extensionPreview } = params;
    const cleanedCurrent = normalizeSingleQuestion(
        String(currentText || '')
            .replace(/INTERVIEW_COMPLETED/gi, '')
            .trim()
    );

    if (isExtensionOfferQuestion(cleanedCurrent, language)) {
        return cleanedCurrent;
    }

    try {
        const generated = await generateDeepOfferOnly({ model, language, extensionPreview, onUsage: params.onUsage });
        if (isExtensionOfferQuestion(generated, language)) {
            return generated;
        }
    } catch (e) {
        console.error('enforceDeepOfferQuestion generation failed:', e);
    }

    const hintText = (extensionPreview || []).map(v => String(v || '').trim()).filter(Boolean)[0] || '';
    return language === 'it'
        ? (hintText
            ? `Grazie per il tempo e per i contributi condivisi fin qui. Il tempo previsto per l'intervista sarebbe terminato: se vuoi, possiamo continuare con qualche domanda in piu, partendo da uno dei punti emersi, ad esempio ${hintText}. Ti va di proseguire ancora per qualche minuto?`
            : `Grazie per il tempo e per i contributi condivisi fin qui. Il tempo previsto per l'intervista sarebbe terminato: se vuoi, possiamo continuare con qualche domanda in piu su uno dei punti più utili emersi. Ti va di proseguire ancora per qualche minuto?`)
        : (hintText
            ? `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions, starting from one point that emerged, for example ${hintText}. Would you like to continue for a few more minutes?`
            : `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions on one useful point that emerged. Would you like to continue for a few more minutes?`);
}
```

### Step 2: Update route.ts imports

In `src/app/api/chat/route.ts`, add after the `chat-intent` import:

```typescript
import {
    generateQuestionOnly,
    generateDeepOfferOnly,
    enforceDeepOfferQuestion,
} from '@/lib/interview/question-generator';
```

### Step 3: Remove the 3 functions from route.ts

Delete from route.ts:
- `async function generateQuestionOnly(...)` block (formerly lines 376–459)
- `async function generateDeepOfferOnly(...)` block (formerly lines 461–503)
- `async function enforceDeepOfferQuestion(...)` block (formerly lines 505–540)

### Step 4: Verify TS error count

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `97`

### Step 5: Commit

```bash
git add src/lib/interview/question-generator.ts src/app/api/chat/route.ts
git commit -m "refactor(gap-o): extract question generators to question-generator.ts

Move generateQuestionOnly, generateDeepOfferOnly, enforceDeepOfferQuestion
to src/lib/interview/question-generator.ts.
No behavioral changes. route.ts -~165 lines.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create `src/lib/interview/interview-completion.ts`

**Files:**
- Create: `src/lib/interview/interview-completion.ts`
- Modify: `src/app/api/chat/route.ts`

### Step 1: Create the new file

Create `src/lib/interview/interview-completion.ts`:

```typescript
/**
 * interview-completion.ts
 * Handles end-of-interview profile extraction and status update.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { prisma } from '@/lib/prisma';
import { ChatService } from '@/services/chat-service';
import type { LLMUsageCollector } from '@/lib/interview/chat-intent';

/**
 * Marks the interview as completed, extracts a candidate profile from the
 * conversation transcript, and persists both changes to the database.
 *
 * Profile extraction runs in parallel with the status update to minimise
 * latency. Both operations are safe to run concurrently since they write
 * to different fields of the Conversation row.
 */
export async function completeInterview(
    conversationId: string,
    messages: any[],
    apiKey: string,
    existingProfile: any,
    options?: { simulationMode?: boolean; onLlmUsage?: LLMUsageCollector }
): Promise<void> {
    // Run profile extraction and completion marking in PARALLEL
    const [extractedProfile] = await Promise.all([
        // Profile extraction (slow LLM call)
        (async () => {
            try {
                const { CandidateExtractor } = await import('@/lib/llm/candidate-extractor');
                return await CandidateExtractor.extractProfile(messages, apiKey, conversationId, {
                    onUsage: options?.onLlmUsage
                });
            } catch (e) {
                console.error("Profile extraction failed:", e);
                return null;
            }
        })(),
        // Mark interview as completed.
        // In local simulation mode, skip usage counters/credits side effects.
        options?.simulationMode
            ? prisma.conversation.update({
                where: { id: conversationId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })
            : ChatService.completeInterview(conversationId)
    ]);

    // Save extracted profile if available
    if (extractedProfile) {
        const mergedProfile = { ...extractedProfile, ...existingProfile };
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { candidateProfile: mergedProfile }
        });
        console.log("👤 Profile saved");
    }
}
```

### Step 2: Update route.ts imports

In `src/app/api/chat/route.ts`, add after the `question-generator` import:

```typescript
import { completeInterview } from '@/lib/interview/interview-completion';
```

### Step 3: Remove `completeInterview` from route.ts

Delete from route.ts:
- The `// ============================================================================` + `// HELPER: Complete interview and save profile` + `// ============================================================================` comment block
- `async function completeInterview(...)` block (formerly lines 545–586)

### Step 4: Verify TS error count

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `97`

### Step 5: Commit

```bash
git add src/lib/interview/interview-completion.ts src/app/api/chat/route.ts
git commit -m "refactor(gap-o): extract completeInterview to interview-completion.ts

Move completeInterview (parallel profile extraction + status update)
to src/lib/interview/interview-completion.ts.
No behavioral changes. route.ts -~45 lines.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Final cleanup of route.ts

**Files:**
- Modify: `src/app/api/chat/route.ts`

### Step 1: Check final line count

```bash
wc -l src/app/api/chat/route.ts
```

Expected: ≤ 2200 lines (was 2601).

### Step 2: Remove the stale `isLocalSimulationRequest`-area orphaned comment

After moving the functions, there may be a standalone `// ============================================================================` comment (from line 173 area) that no longer introduces anything. Delete any such orphaned separator line.

Also check that `createOpenAI` import is still needed in route.ts (it's used in the POST handler itself for LLM calls). If it's no longer needed in route.ts after extraction (because all usages were in the extracted functions), remove it from the import list.

To check:
```bash
grep -n "createOpenAI" src/app/api/chat/route.ts
```

If there are no occurrences in route.ts body after the import, remove it from the import at line 4.

### Step 3: Verify final state

```bash
wc -l src/app/api/chat/route.ts
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `≤2200` and `97`

### Step 4: Update AUDIT-PLAN.md

In `docs/AUDIT-PLAN.md`, find the row for Gap O in the roadmap table and update:

```
| 🟡 P3 | **O. Split chat/route.ts** | 8-10h | Manutenibilità, cold start ridotti | Sprint 7 | ⏳ Da fare |
```

→

```
| 🟡 P3 | **O. Split chat/route.ts** | 8-10h | Manutenibilità, cold start ridotti | Sprint 7 | ✅ FATTO |
```

Also update the Gap O section description (around line 1063):
```
- [~] **Gap confermato (Sez. 15.3)**: ...
```
→
```
- [✓] **Gap confermato (Sez. 15.3)**: ~~Il file principale delle interviste è 3511 righe~~. **✅ Sprint 7 FATTO** — Helper functions estratte in 3 nuovi lib modules: `chat-intent.ts` (extractFieldFromMessage, checkUserIntent, detectExplicitClosureIntent + LLMUsageCollector types), `question-generator.ts` (generateQuestionOnly, generateDeepOfferOnly, enforceDeepOfferQuestion), `interview-completion.ts` (completeInterview). route.ts ridotto da 2601 a ~2100 righe. Nessuna regressione TS (97 errori pre-esistenti invariati).
```

Also update the Sprint 7 line:
```
**Sprint 7 (prossimo)**: ⏳ Split chat/route.ts (O) + Internazionalizzazione (H) [bassa priorità, 30-40h]
```
→
```
**Sprint 7**: ✅ COMPLETATO — Split chat/route.ts (O): estratte 8 helper functions in 3 lib modules
**Sprint 8 (successivo, opzionale)**: ⏳ Internazionalizzazione (H) [30-40h, bassa priorità]
```

### Step 5: Final commit

```bash
git add src/app/api/chat/route.ts docs/AUDIT-PLAN.md
git commit -m "refactor(gap-o): final cleanup + mark O complete in audit plan

route.ts reduced from 2601 to ~2100 lines. 3 new focused lib modules:
- chat-intent.ts: intent detection (extractFieldFromMessage, checkUserIntent,
  detectExplicitClosureIntent, LLMUsageCollector type)
- question-generator.ts: LLM question generation (generateQuestionOnly,
  generateDeepOfferOnly, enforceDeepOfferQuestion)
- interview-completion.ts: completeInterview (parallel profile + status)

TS error count unchanged at 97 (all pre-existing).
AUDIT-PLAN.md: Gap O → ✅ FATTO, Sprint 7 → ✅ COMPLETATO.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] `chat-intent.ts` created with 3 functions + 2 types exported
- [ ] `question-generator.ts` created with 3 functions exported
- [ ] `interview-completion.ts` created with 1 function exported
- [ ] `route.ts` updated with new imports, old functions deleted
- [ ] `tsc --noEmit` error count = 97 (no regression)
- [ ] `route.ts` ≤ 2200 lines (was 2601)
- [ ] AUDIT-PLAN.md updated: Gap O ✅ FATTO, Sprint 7 ✅ COMPLETATO
- [ ] 4 atomic commits made

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

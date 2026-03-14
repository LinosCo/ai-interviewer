/**
 * chat-intent.ts
 * LLM-based intent detection helpers for the interview chat route.
 * Extracted from src/app/api/chat/route.ts (Gap O refactoring).
 */

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

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

export type SemanticUserTurnSignal = 'none' | 'clarification' | 'off_topic_question';
export type ResponseValueBand = 'low' | 'medium' | 'high' | 'very_high';
export type DeltaType = 'none' | 'refinement' | 'new_direction' | 'contradiction' | 'concrete_example';
export type NarrativeState = 'open_thread' | 'answered_thread' | 'transition_ready';

export interface TopicalUserTurnInterpretation {
    wantsToConclude: boolean;
    closureConfidence: 'high' | 'medium' | 'low';
    closureReason: string;
    signal: SemanticUserTurnSignal;
    responseValue: ResponseValueBand;
    deltaType: DeltaType;
    narrativeState: NarrativeState;
}

export interface AssistantTurnEvaluation {
    isExtensionOffer: boolean;
    isClarificationResponse: boolean;
    isScopeBoundaryResponse: boolean;
    isConsentRequest: boolean;
    targetsExpectedField: boolean;
    isClosureResponse: boolean;
    isVagueDataCollectionRequest: boolean;
    isContactRequest: boolean;
    isPromotionalContent: boolean;
}

export interface DataCollectionTurnInterpretation {
    consentIntent: 'ACCEPT' | 'REFUSE' | 'NEUTRAL';
    wantsToConclude: boolean;
    closureConfidence: 'high' | 'medium' | 'low';
    isFrustrated: boolean;
    wantsToSkipField: boolean;
    extractedExpectedFieldValue: string | null;
    extractedExpectedFieldConfidence: 'high' | 'low' | 'none';
}

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

export async function detectSemanticUserTurnSignal(params: {
    userMessage: string;
    apiKey: string;
    language: string;
    phase: 'EXPLORE' | 'DEEPEN' | 'DEEP_OFFER' | 'DATA_COLLECTION';
    currentTopicLabel?: string | null;
    targetTopicLabel?: string | null;
    interviewObjective?: string | null;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<SemanticUserTurnSignal> {
    const text = String(params.userMessage || '').trim();
    if (!text) return 'none';
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') return 'none';

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        signal: z.enum(['none', 'clarification', 'off_topic_question']),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Classify the user turn in a multilingual interview flow.',
                `Participant language: ${params.language}`,
                `Current phase: ${params.phase}`,
                `Current topic: "${String(params.currentTopicLabel || '')}"`,
                `Target topic: "${String(params.targetTopicLabel || '')}"`,
                `Interview objective: "${String(params.interviewObjective || '')}"`,
                `User message: "${text}"`,
                '',
                'Return "clarification" only if the user is asking the interviewer to clarify or explain the previous question.',
                'Return "off_topic_question" only if the user is asking a question that is genuinely outside the scope of the interview topic/objective.',
                'Return "none" for ordinary topical answers, on-topic questions, or ambiguous cases.',
                'Be semantic and language-agnostic. Avoid keyword-based assumptions.'
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: 'detect_semantic_user_turn_signal',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return result.object.signal;
    } catch (e) {
        console.error('Semantic user-turn signal detection failed:', e);
        return 'none';
    }
}

export async function evaluateTopicalUserTurn(params: {
    userMessage: string;
    apiKey: string;
    language: string;
    phase: 'EXPLORE' | 'DEEPEN' | 'DEEP_OFFER' | 'DATA_COLLECTION';
    currentTopicLabel?: string | null;
    targetTopicLabel?: string | null;
    interviewObjective?: string | null;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<TopicalUserTurnInterpretation> {
    const text = String(params.userMessage || '').trim();
    if (!text || (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN')) {
        return {
            wantsToConclude: false,
            closureConfidence: 'low',
            closureReason: 'not_applicable',
            signal: 'none',
            responseValue: 'low',
            deltaType: 'none',
            narrativeState: 'answered_thread'
        };
    }

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        wantsToConclude: z.boolean(),
        closureConfidence: z.enum(['high', 'medium', 'low']),
        closureReason: z.string(),
        signal: z.enum(['none', 'clarification', 'off_topic_question']),
        responseValue: z.enum(['low', 'medium', 'high', 'very_high']),
        deltaType: z.enum(['none', 'refinement', 'new_direction', 'contradiction', 'concrete_example']),
        narrativeState: z.enum(['open_thread', 'answered_thread', 'transition_ready']),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Interpret a user turn in a multilingual interview.',
                `Participant language: ${params.language}`,
                `Current phase: ${params.phase}`,
                `Current topic: "${String(params.currentTopicLabel || '')}"`,
                `Target topic: "${String(params.targetTopicLabel || '')}"`,
                `Interview objective: "${String(params.interviewObjective || '')}"`,
                `User message: "${text}"`,
                '',
                'Set wantsToConclude=true only if the user explicitly wants to stop or end now.',
                'Set signal="clarification" only if the user is asking the interviewer to clarify the previous question.',
                'Set signal="off_topic_question" only if the user is asking something genuinely outside the interview scope.',
                'Set signal="none" for ordinary answers, on-topic questions, or ambiguous cases.',
                'Classify responseValue as: low (generic/brief), medium (usable but limited), high (concrete and relevant), very_high (concrete, relevant, and strategically rich).',
                'Classify deltaType as: none, refinement, new_direction, contradiction, or concrete_example.',
                'Classify narrativeState as: open_thread (promising thread worth exploring), answered_thread (point addressed well enough), or transition_ready (little additional value in staying here).',
                'Use the interview objective and current topic as the reference for relevance and richness.',
                'Be semantic, strict, multilingual, and avoid keyword-based assumptions.'
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: 'evaluate_topical_user_turn',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return {
            wantsToConclude: result.object.wantsToConclude,
            closureConfidence: result.object.closureConfidence,
            closureReason: result.object.closureReason,
            signal: result.object.signal,
            responseValue: result.object.responseValue,
            deltaType: result.object.deltaType,
            narrativeState: result.object.narrativeState
        };
    } catch (e) {
        console.error('Topical user-turn evaluation failed:', e);
        return {
            wantsToConclude: false,
            closureConfidence: 'low',
            closureReason: 'evaluation_error',
            signal: 'none',
            responseValue: 'low',
            deltaType: 'none',
            narrativeState: 'answered_thread'
        };
    }
}

export async function isAssistantRequestingField(params: {
    assistantMessage: string;
    fieldName: string;
    apiKey: string;
    language: string;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<boolean> {
    const message = String(params.assistantMessage || '').trim();
    if (!message || !params.fieldName) return false;

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        targetsField: z.boolean(),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Classify an assistant message in a multilingual interview.',
                `Participant language: ${params.language}`,
                `Canonical field id: ${params.fieldName}`,
                `Assistant message: "${message}"`,
                '',
                'Return targetsField=true only if the assistant is clearly asking for that exact field now, regardless of wording or language.',
                'Return false if the assistant is asking for another field, asking for multiple fields, asking for consent only, asking a topic question, or closing the interview.',
                'Be strict and semantic, not lexical.'
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: 'classify_assistant_field_request',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return result.object.targetsField;
    } catch (e) {
        console.error(`Assistant field-request classification failed for "${params.fieldName}":`, e);
        return false;
    }
}

async function classifyAssistantMessage(params: {
    assistantMessage: string;
    apiKey: string;
    language: string;
    task: string;
    source: string;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<boolean> {
    const message = String(params.assistantMessage || '').trim();
    if (!message) return false;

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        matches: z.boolean(),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Classify an assistant message in a multilingual interview.',
                `Participant language: ${params.language}`,
                `Assistant message: "${message}"`,
                '',
                params.task
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: params.source,
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return result.object.matches;
    } catch (e) {
        console.error(`Assistant-message classification failed for ${params.source}:`, e);
        return false;
    }
}

export async function isAssistantExtensionOffer(params: {
    assistantMessage: string;
    apiKey: string;
    language: string;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<boolean> {
    return classifyAssistantMessage({
        ...params,
        source: 'classify_assistant_extension_offer',
        task: [
            'Return matches=true only if the assistant is politely offering to extend the interview by a few more minutes and is asking whether the participant wants to continue.',
            'Return false for topic questions, consent requests, field collection, generic wrap-up, or any message that does not clearly offer an interview extension.',
            'Be semantic and language-agnostic.'
        ].join(' ')
    });
}

export async function isAssistantClarificationResponse(params: {
    assistantMessage: string;
    userMessage: string;
    apiKey: string;
    language: string;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<boolean> {
    return classifyAssistantMessage({
        assistantMessage: params.assistantMessage,
        apiKey: params.apiKey,
        language: params.language,
        source: 'classify_assistant_clarification_response',
        options: params.options,
        task: [
            `The user had asked for clarification: "${String(params.userMessage || '').trim()}"`,
            'Return matches=true only if the assistant first clarifies what it meant in a direct and helpful way, then optionally continues the interview coherently.',
            'Return false if the assistant ignores the clarification request, answers a different question, or only asks another follow-up.'
        ].join(' ')
    });
}

export async function isAssistantScopeBoundaryResponse(params: {
    assistantMessage: string;
    userMessage: string;
    apiKey: string;
    language: string;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<boolean> {
    return classifyAssistantMessage({
        assistantMessage: params.assistantMessage,
        apiKey: params.apiKey,
        language: params.language,
        source: 'classify_assistant_scope_boundary_response',
        options: params.options,
        task: [
            `The user had asked an out-of-scope question: "${String(params.userMessage || '').trim()}"`,
            'Return matches=true only if the assistant politely sets a scope boundary for this interview and then redirects to the interview focus.',
            'Return false if it answers the off-topic question directly, ignores the boundary, or just continues without acknowledging scope.'
        ].join(' ')
    });
}

export async function evaluateAssistantTurn(params: {
    assistantMessage: string;
    apiKey: string;
    language: string;
    userMessage?: string | null;
    expectedFieldName?: string | null;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<AssistantTurnEvaluation> {
    const message = String(params.assistantMessage || '').trim();
    if (!message) {
        return {
            isExtensionOffer: false,
            isClarificationResponse: false,
            isScopeBoundaryResponse: false,
            isConsentRequest: false,
            targetsExpectedField: false,
            isClosureResponse: false,
            isVagueDataCollectionRequest: false,
            isContactRequest: false,
            isPromotionalContent: false
        };
    }

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        isExtensionOffer: z.boolean(),
        isClarificationResponse: z.boolean(),
            isScopeBoundaryResponse: z.boolean(),
            isConsentRequest: z.boolean(),
            targetsExpectedField: z.boolean(),
            isClosureResponse: z.boolean(),
            isVagueDataCollectionRequest: z.boolean(),
            isContactRequest: z.boolean(),
            isPromotionalContent: z.boolean(),
            reason: z.string()
        });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Classify an assistant message inside a multilingual interview runtime.',
                `Participant language: ${params.language}`,
                `Assistant message: "${message}"`,
                `User message to account for (if relevant): "${String(params.userMessage || '').trim()}"`,
                `Expected canonical field id (if any): "${String(params.expectedFieldName || '').trim()}"`,
                '',
                'Set isExtensionOffer=true only if the assistant is offering to extend the interview by a few minutes and asking whether to continue.',
                'Set isClarificationResponse=true only if the user asked for clarification and the assistant clearly clarifies before continuing.',
                'Set isScopeBoundaryResponse=true only if the user asked something out of scope and the assistant politely sets scope boundaries before redirecting.',
                'Set isConsentRequest=true only if the assistant is explicitly asking permission to collect contact details and waiting for yes/no.',
                'Set targetsExpectedField=true only if the assistant is clearly asking for the exact expected field now, and not multiple fields.',
                'Set isClosureResponse=true only if the assistant is clearly closing, greeting goodbye, wrapping up, or ending the interview.',
                'Set isVagueDataCollectionRequest=true only if the assistant is asking for contact/details in a vague unspecific way instead of the exact consent or exact field requested.',
                'Set isContactRequest=true only if the assistant is asking for personal/contact details from the participant.',
                'Set isPromotionalContent=true only if the assistant includes promotional, CTA, coupon, reward-claiming, or external-contacting content beyond the interview need.',
                'Be semantic, strict, multilingual, and avoid keyword-based assumptions.'
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: 'evaluate_assistant_turn',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return {
            isExtensionOffer: result.object.isExtensionOffer,
            isClarificationResponse: result.object.isClarificationResponse,
            isScopeBoundaryResponse: result.object.isScopeBoundaryResponse,
            isConsentRequest: result.object.isConsentRequest,
            targetsExpectedField: result.object.targetsExpectedField,
            isClosureResponse: result.object.isClosureResponse,
            isVagueDataCollectionRequest: result.object.isVagueDataCollectionRequest,
            isContactRequest: result.object.isContactRequest,
            isPromotionalContent: result.object.isPromotionalContent
        };
    } catch (e) {
        console.error('Assistant turn evaluation failed:', e);
        return {
            isExtensionOffer: false,
            isClarificationResponse: false,
            isScopeBoundaryResponse: false,
            isConsentRequest: false,
            targetsExpectedField: false,
            isClosureResponse: false,
            isVagueDataCollectionRequest: false,
            isContactRequest: false,
            isPromotionalContent: false
        };
    }
}

export async function evaluateDataCollectionUserTurn(params: {
    userMessage: string;
    apiKey: string;
    language: string;
    consentRequested: boolean;
    expectedFieldName?: string | null;
    options?: { onUsage?: LLMUsageCollector };
}): Promise<DataCollectionTurnInterpretation> {
    const text = String(params.userMessage || '').trim();
    if (!text) {
        return {
            consentIntent: 'NEUTRAL',
            wantsToConclude: false,
            closureConfidence: 'low',
            isFrustrated: false,
            wantsToSkipField: false,
            extractedExpectedFieldValue: null,
            extractedExpectedFieldConfidence: 'none'
        };
    }

    const openai = createOpenAI({ apiKey: params.apiKey });
    const schema = z.object({
        consentIntent: z.enum(['ACCEPT', 'REFUSE', 'NEUTRAL']),
        wantsToConclude: z.boolean(),
        closureConfidence: z.enum(['high', 'medium', 'low']),
        isFrustrated: z.boolean(),
        wantsToSkipField: z.boolean(),
        extractedExpectedFieldValue: z.string().nullable(),
        extractedExpectedFieldConfidence: z.enum(['high', 'low', 'none']),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: [
                'Interpret a user message inside the data-collection phase of a multilingual interview.',
                `Participant language: ${params.language}`,
                `Consent was explicitly requested this turn: ${params.consentRequested ? 'yes' : 'no'}`,
                `Expected canonical field id (if any): "${String(params.expectedFieldName || '').trim()}"`,
                `User message: "${text}"`,
                '',
                'Set consentIntent to ACCEPT only if the user clearly agrees to share contact details.',
                'Set consentIntent to REFUSE only if the user clearly declines sharing contact details.',
                'Otherwise set consentIntent to NEUTRAL.',
                'Set wantsToConclude=true only if the user explicitly wants to stop or end now.',
                'Set isFrustrated=true only if the user is clearly complaining about repetition, looping, or annoyance with the flow.',
                'Set wantsToSkipField=true only if the user clearly cannot or does not want to provide the currently expected field.',
                'Set extractedExpectedFieldValue only when the user explicitly provides the expected field value in the message.',
                'Do not infer values that are not stated.',
                'Be semantic, strict, multilingual, and domain-agnostic.'
            ].join('\n'),
            temperature: 0
        });
        params.options?.onUsage?.({
            source: 'evaluate_data_collection_user_turn',
            model: 'gpt-4o-mini',
            usage: (result as any)?.usage
        });
        return {
            consentIntent: result.object.consentIntent,
            wantsToConclude: result.object.wantsToConclude,
            closureConfidence: result.object.closureConfidence,
            isFrustrated: result.object.isFrustrated,
            wantsToSkipField: result.object.wantsToSkipField,
            extractedExpectedFieldValue: result.object.extractedExpectedFieldValue,
            extractedExpectedFieldConfidence: result.object.extractedExpectedFieldConfidence
        };
    } catch (e) {
        console.error('Data-collection user turn evaluation failed:', e);
        return {
            consentIntent: 'NEUTRAL',
            wantsToConclude: false,
            closureConfidence: 'low',
            isFrustrated: false,
            wantsToSkipField: false,
            extractedExpectedFieldValue: null,
            extractedExpectedFieldConfidence: 'none'
        };
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

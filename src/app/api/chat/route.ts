
import { ChatService } from '@/services/chat-service';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { LLMService } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { getOrCreateInterviewPlan } from '@/lib/interview/plan-service';
import type { InterviewPlan } from '@/lib/interview/plan-types';
import { buildTopicAnchors, buildMessageAnchors, responseMentionsAnchors } from '@/lib/interview/topic-anchors';
import { getFieldLabel, getNextMissingCandidateField } from '@/lib/interview/flow-guards';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { getCompletionGuardAction, shouldInterceptDeepOfferClosure, shouldInterceptTopicPhaseClosure } from '@/lib/interview/phase-flow';
import { evaluateInterviewQuestionQuality } from '@/lib/interview/qualitative-evaluator';

export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
    SAFETY_MAX_ASSISTANT_TURNS: 120,
    SAFETY_MAX_TOTAL_MESSAGES: 260,
};

function isLocalSimulationRequest(req: Request): boolean {
    const simulateHeader = req.headers.get('x-chat-simulate');
    if (simulateHeader !== '1') return false;
    if (process.env.NODE_ENV === 'production') return false;
    const host = (req.headers.get('host') || '').toLowerCase();
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

// ============================================================================
// TYPES
// ============================================================================
type Phase = 'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'DATA_COLLECTION';

interface InterestingTopic {
    topicId: string;
    topicLabel: string;
    engagementScore: number;  // 0-1 based on response length
    bestSnippet?: string;
}

interface InterviewState {
    phase: Phase;
    topicIndex: number;
    turnInTopic: number;
    deepAccepted: boolean | null;   // null = not asked yet
    consentGiven: boolean | null;   // null = not asked yet
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    fieldAttemptCounts: Record<string, number>;  // Track attempts per field to prevent loops
    closureAttempts: number;        // Track consecutive closure attempts to prevent infinite loops
    dataCollectionRefused?: boolean;
    forceConsentQuestion?: boolean;
    interestingTopics?: InterestingTopic[];
    deepTopicOrder?: string[];             // Ordered topic IDs for DEEP based on value
    deepTurnsByTopic?: Record<string, number>;
    topicSubGoalHistory?: Record<string, string[]>; // Track used sub-goals per topic
    lastUserTopicId?: string | null;
    deepLastSubGoalByTopic?: Record<string, string>;
    clarificationTurnsByTopic?: Record<string, number>;
    extensionReturnPhase?: 'SCAN' | 'DEEP' | null;
    extensionReturnTopicIndex?: number | null;
    extensionReturnTurnInTopic?: number | null;
    extensionOfferAttempts?: number;
}

interface QualityTelemetry {
    eligible: boolean;
    evaluated: boolean;
    score: number | null;
    passed: boolean | null;
    gateTriggered: boolean;
    regenerated: boolean;
    fallbackUsed: boolean;
    issues: string[];
}

interface FlowGuardTelemetry {
    topicClosureIntercepted: boolean;
    deepOfferClosureIntercepted: boolean;
    completionGuardIntercepted: boolean;
    completionBlockedForConsent: boolean;
    completionBlockedForMissingField: boolean;
}

const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
    })).default([]),
    conversationId: z.string().min(1),
    botId: z.string().min(1),
    effectiveDuration: z.union([z.number(), z.string(), z.null()]).optional(),
    introMessage: z.string().optional().nullable(),
    clientMessageId: z.string().min(8).max(128).optional()
});

type ClientMessage = z.infer<typeof ChatRequestSchema>['messages'][number];

// ============================================================================ 
// HELPERS: Engagement scoring and snippets
// ============================================================================
function extractSnippet(text: string, maxLen: number = 120): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    // Prefer first sentence if available
    const firstSentence = clean.split(/[.!?]/)[0]?.trim();
    const snippet = (firstSentence && firstSentence.length >= 20) ? firstSentence : clean;
    return snippet.length > maxLen ? snippet.slice(0, maxLen - 1) + '…' : snippet;
}

function computeEngagementScore(text: string, language: string): number {
    const clean = text.trim();
    if (!clean) return 0;

    const words = clean.split(/\s+/).length;
    const lengthScore = Math.min(1, words / 60);

    const examplePattern = language === 'it'
        ? /\b(ad esempio|per esempio|ad es\.|esempio)\b/i
        : /\b(for example|for instance|e\.g\.)\b/i;
    const hasExample = examplePattern.test(clean) ? 1 : 0;

    const hasNumbers = /\b\d{1,4}\b/.test(clean) ? 1 : 0;

    const specificityPattern = language === 'it'
        ? /\b(srl|spa|s\.p\.a|snc|sas|societ[aà]|azienda|cliente|fornitore)\b/i
        : /\b(ltd|inc|llc|gmbh|company|client|customer|supplier)\b/i;
    const hasSpecificity = specificityPattern.test(clean) ? 1 : 0;

    const emotionPattern = language === 'it'
        ? /\b(adoro|odio|frustrante|entusiasmante|deluso|soddisfatto|preoccupato)\b/i
        : /\b(love|hate|frustrating|exciting|disappointed|satisfied|concerned)\b/i;
    const hasEmotion = emotionPattern.test(clean) ? 1 : 0;

    const score = (
        lengthScore * 0.4 +
        hasExample * 0.2 +
        hasNumbers * 0.15 +
        hasSpecificity * 0.15 +
        hasEmotion * 0.1
    );

    return Math.max(0, Math.min(1, score));
}

function getDeepTopics(botTopics: any[], deepOrder?: string[]) {
    if (!deepOrder || deepOrder.length === 0) return botTopics;
    return deepOrder
        .map(id => botTopics.find(t => t.id === id))
        .filter(Boolean);
}

function buildDeepTopicOrder(
    botTopics: any[],
    interestingTopics: InterestingTopic[] | undefined,
    history?: Record<string, string[]>
): string[] {
    const scored = botTopics.map((t, idx) => {
        const match = (interestingTopics || []).find(it => it.topicId === t.id);
        const remainingSubGoals = getRemainingSubGoals(t, history).length;
        return {
            id: t.id,
            score: match?.engagementScore ?? 0,
            remainingSubGoals,
            idx
        };
    }).sort((a, b) =>
        (b.remainingSubGoals - a.remainingSubGoals) ||
        (b.score - a.score) ||
        (a.idx - b.idx)
    );

    return scored.map(s => s.id);
}

function getScanPlanTurns(plan: InterviewPlan, topicId: string): number {
    const topic = plan.scan.topics.find(t => t.topicId === topicId);
    return Math.max(1, topic?.maxTurns ?? 1);
}

function getDeepPlanTurns(plan: InterviewPlan, topicId: string): number {
    const topic = plan.deep.topics.find(t => t.topicId === topicId);
    const base = topic?.maxTurns ?? plan.deep.maxTurnsPerTopic;
    return Math.max(1, base);
}

function getRemainingSubGoals(topic: any, history: Record<string, string[]> | undefined) {
    const used = (history || {})[topic.id] || [];
    return (topic.subGoals || []).filter((sg: string) => !used.includes(sg));
}

function buildDeepPlan(
    botTopics: any[],
    plan: InterviewPlan,
    history: Record<string, string[]> | undefined,
    interestingTopics: InterestingTopic[] | undefined,
    remainingSec?: number
) {
    const topicsWithRemaining = botTopics.filter(t => getRemainingSubGoals(t, history).length > 0);
    if (topicsWithRemaining.length > 0) {
        const ordered = buildDeepTopicOrder(botTopics, interestingTopics, history).filter(id =>
            topicsWithRemaining.some(t => t.id === id)
        );
        const deepTurnsByTopic: Record<string, number> = {};

        // Adaptive: distribute available time proportionally to remaining sub-goals
        const availableTurns = remainingSec
            ? Math.max(ordered.length, Math.floor(remainingSec / 45))
            : ordered.length * (plan.deep.maxTurnsPerTopic || 2);
        const totalRemaining = ordered.reduce((sum, id) => {
            const topic = botTopics.find(t => t.id === id);
            return sum + (topic ? getRemainingSubGoals(topic, history).length : 0);
        }, 0);

        for (const topicId of ordered) {
            const topic = botTopics.find(t => t.id === topicId);
            if (!topic) continue;
            const remaining = getRemainingSubGoals(topic, history).length;
            // Proportional allocation: each topic gets turns based on its share of remaining sub-goals
            const proportion = totalRemaining > 0 ? remaining / totalRemaining : 1 / ordered.length;
            const maxTurns = Math.max(1, Math.min(remaining, Math.round(availableTurns * proportion)));
            deepTurnsByTopic[topicId] = Math.max(1, maxTurns);
        }
        return { deepTopicOrder: ordered, deepTurnsByTopic };
    }

    const fallbackCount = Math.max(1, plan.deep.fallbackTurns || 2);
    const ordered = buildDeepTopicOrder(botTopics, interestingTopics, history).slice(0, fallbackCount);
    const deepTurnsByTopic: Record<string, number> = {};
    ordered.forEach(id => {
        deepTurnsByTopic[id] = 1;
    });
    return { deepTopicOrder: ordered, deepTurnsByTopic };
}

function normalizeCandidateFieldIds(rawFields: any[]): string[] {
    if (!Array.isArray(rawFields)) return [];
    const normalized = rawFields
        .map((f: any) => (typeof f === 'string' ? f : (f?.id || f?.field || '')))
        .map((f: string) => String(f || '').trim())
        .filter(Boolean);
    return Array.from(new Set(normalized));
}

function responseMentionsCandidateField(responseText: string, fieldId: string): boolean {
    const text = String(responseText || '').toLowerCase();
    if (!text || !fieldId) return false;
    if (text.includes(fieldId.toLowerCase())) return true;

    if (fieldId === 'name' || fieldId === 'fullName') {
        return /\b(nome|cognome|name)\b/i.test(text);
    }
    if (fieldId === 'email') {
        return /\b(email|mail)\b/i.test(text);
    }
    if (fieldId === 'phone') {
        return /\b(telefono|phone|numero)\b/i.test(text);
    }
    if (fieldId === 'company') {
        return /\b(azienda|company|organizzazione)\b/i.test(text);
    }
    if (fieldId === 'role') {
        return /\b(ruolo|role|posizione)\b/i.test(text);
    }
    if (fieldId === 'linkedin') {
        return /\b(linkedin|profilo|profile)\b/i.test(text);
    }
    if (fieldId === 'portfolio') {
        return /\b(portfolio|sito web|website|url)\b/i.test(text);
    }
    if (fieldId === 'location') {
        return /\b(citt[àa]|city|location|localit[àa])\b/i.test(text);
    }
    if (fieldId === 'budget') {
        return /\b(budget)\b/i.test(text);
    }
    if (fieldId === 'availability') {
        return /\b(disponibilit[àa]|availability)\b/i.test(text);
    }
    return false;
}

function extractDeterministicFieldValue(fieldName: string, userMessage: string): string | null {
    const text = userMessage.trim();
    if (!text) return null;

    if (fieldName === 'email') {
        const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return emailMatch ? emailMatch[0] : null;
    }

    if (fieldName === 'phone') {
        const phoneMatch = text.match(/\+?[0-9][0-9\s().-]{6,}[0-9]/);
        return phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null;
    }

    if (fieldName === 'linkedin' || fieldName === 'portfolio') {
        const urlMatch = text.match(/https?:\/\/[^\s]+/i);
        return urlMatch ? urlMatch[0] : null;
    }

    return null;
}

// ============================================================================
// HELPER: Extract field from user message
// ============================================================================
async function extractFieldFromMessage(
    fieldName: string,
    userMessage: string,
    apiKey: string,
    language: string = 'en'
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
        // Field-specific extraction rules
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
        return { value: result.object.extractedValue, confidence: result.object.confidence };
    } catch (e) {
        console.error(`Field extraction failed for "${fieldName}":`, e);
        return { value: null, confidence: 'none' };
    }
}

// ============================================================================
// HELPER: Check user intent (consent/refusal/neutral)
// ============================================================================
async function checkUserIntent(
    userMessage: string,
    apiKey: string,
    language: string,
    context: 'consent' | 'deep_offer' | 'stop_confirmation'
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
        return result.object.intent;
    } catch (e) {
        console.error('Intent check failed:', e);
        return 'NEUTRAL';
    }
}

async function generateQuestionOnly(params: {
    model: any;
    language: string;
    topicLabel: string;
    topicCue?: string | null;
    subGoal?: string | null;
    lastUserMessage?: string | null;
    requireAcknowledgment?: boolean;
    transitionMode?: 'bridge' | 'clean_pivot';
}) {
    const { model, language, topicLabel, topicCue, subGoal, lastUserMessage, requireAcknowledgment, transitionMode } = params;
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

    const prompt = [
        `Language: ${language}`,
        `Topic title (internal): ${topicLabel}`,
        topicCue ? `Natural topic cue for user-facing wording: ${topicCue}` : null,
        subGoal ? `Sub-goal: ${subGoal}` : null,
        lastUserMessage ? `User last message: "${lastUserMessage}"` : null,
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

    let question = normalizeSingleQuestion(String(result.object.question || '').trim());
    if (topicCue) {
        question = replaceLiteralTopicTitle(question, topicLabel, topicCue);
    }
    return question;
}

async function generateDeepOfferOnly(params: {
    model: any;
    language: string;
}) {
    const schema = z.object({
        question: z.string().describe('A single yes/no continuation question ending with a question mark.')
    });

    const prompt = [
        `Language: ${params.language}`,
        `Task: Ask exactly ONE yes/no question to understand if the user wants to extend the interview by a few minutes and continue.`,
        `Do NOT ask topic questions. Do NOT ask for contacts. Do NOT close the interview.`,
        `Keep it natural and concise. End with exactly one question mark.`
    ].join('\n');

    const result = await generateObject({
        model: params.model,
        schema,
        prompt,
        temperature: 0.2
    });

    return normalizeSingleQuestion(String(result.object.question || '').trim());
}

function isExtensionOfferQuestion(message: string, language: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text || !text.includes('?')) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(ti va di continuare|vuoi continuare|qualche minuto in più|hai ancora qualche minuto|estendere(?:\s+l')?\s*intervista|proseguire)\b/i;
    const enPattern = /\b(would you like to continue|do you want to continue|few more minutes|extend the interview|continue for a few more minutes)\b/i;
    return isItalian ? itPattern.test(text) : enPattern.test(text);
}

async function generateConsentQuestionOnly(params: {
    model: any;
    language: string;
}) {
    const schema = z.object({
        question: z.string().describe('A single yes/no consent question ending with a question mark.')
    });

    const prompt = [
        `Language: ${params.language}`,
        `Task: Write a natural transition into data collection and ask exactly ONE yes/no question asking permission to collect contact details for follow-up.`,
        `Structure: (1) one short linking sentence acknowledging content interview closure; (2) one yes/no consent question.`,
        `Do NOT ask for any specific field yet. Do NOT ask topic questions. Do NOT close the interview.`,
        `Keep it natural and concise. End with exactly one question mark.`
    ].join('\n');

    const result = await generateObject({
        model: params.model,
        schema,
        prompt,
        temperature: 0.2
    });

    return normalizeSingleQuestion(String(result.object.question || '').trim());
}

async function generateFieldQuestionOnly(params: {
    model: any;
    language: string;
    fieldLabel: string;
}) {
    const schema = z.object({
        question: z.string().describe('A single field collection question ending with a question mark.')
    });

    const prompt = [
        `Language: ${params.language}`,
        `Target field to collect now: ${params.fieldLabel}`,
        `Task: Ask exactly ONE concise question to collect this field only.`,
        `Do NOT ask for other fields. Do NOT ask topic questions. Do NOT close the interview.`,
        `Keep it natural and concise. End with exactly one question mark.`
    ].join('\n');

    const result = await generateObject({
        model: params.model,
        schema,
        prompt,
        temperature: 0.2
    });

    return normalizeSingleQuestion(String(result.object.question || '').trim());
}

function sanitizeUserSnippet(input: string, maxWords: number = 10): string {
    const compact = (input || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const withoutPunctuation = compact.replace(/[?!.,;:()[\]{}"“”'’`]/g, '').trim();
    return withoutPunctuation.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

function escapeRegexLiteral(input: string): string {
    return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceLiteralTopicTitle(text: string, topicLabel: string, replacement: string): string {
    const source = String(text || '').trim();
    const label = String(topicLabel || '').trim();
    const repl = String(replacement || '').trim();
    if (!source || !label || !repl) return source;
    const re = new RegExp(escapeRegexLiteral(label), 'gi');
    return source.replace(re, repl);
}

function normalizeSingleQuestion(question: string): string {
    let normalized = String(question || '').trim();
    const questionMarkCount = (normalized.match(/\?/g) || []).length;
    if (questionMarkCount > 1) {
        const firstQuestionIdx = normalized.indexOf('?');
        normalized = normalized.slice(0, firstQuestionIdx + 1).trim();
    }
    if (!normalized.endsWith('?')) {
        normalized = `${normalized.replace(/[.!?…]+$/g, '').trim()}?`;
    }
    return normalized;
}

function isClarificationSignal(input: string, language: string): boolean {
    const text = String(input || '').trim().toLowerCase();
    if (!text) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const genericPattern = /^(boh|eh|mh|hmm|\?+|ok\??)$/i;
    if (genericPattern.test(text)) return true;
    const itPattern = /\b(non capisco|non ho capito|non mi è chiaro|puoi chiarire|puoi spiegare meglio)\b/i;
    const enPattern = /\b(i don't understand|i do not understand|not clear|can you clarify|can you explain)\b/i;
    return isItalian ? itPattern.test(text) : enPattern.test(text);
}

function buildNaturalTopicCue(topicLabel: string, language: string): string {
    const label = String(topicLabel || '').trim();
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    if (!label) return isItalian ? 'questo tema' : 'this topic';

    // Extract meaningful keywords from topic label dynamically
    const anchors = buildMessageAnchors(label, language).anchors;
    if (anchors.length === 0) return isItalian ? 'questo tema' : 'this topic';

    // Use the most meaningful anchor (longest, most specific)
    const bestAnchor = anchors.sort((a, b) => b.length - a.length)[0];
    return isItalian ? bestAnchor : `this aspect about ${bestAnchor}`;
}

const GENERIC_TOPIC_ANCHORS_IT = new Set([
    'tema', 'temi', 'aspetto', 'aspetti', 'punto', 'punti',
    'progetto', 'progetti', 'iniziativa', 'iniziative', 'azienda', 'aziende',
    'soluzione', 'soluzioni', 'impatto', 'valore', 'processo', 'processi',
    'sistema', 'sistemi', 'approccio', 'uso'
]);

const GENERIC_TOPIC_ANCHORS_EN = new Set([
    'topic', 'topics', 'aspect', 'aspects', 'point', 'points',
    'project', 'projects', 'initiative', 'initiatives', 'company', 'companies',
    'solution', 'solutions', 'impact', 'value', 'process', 'processes',
    'system', 'systems', 'approach', 'usage', 'use'
]);

function getGenericTopicAnchors(language: string): Set<string> {
    return (language || 'en').toLowerCase().startsWith('it')
        ? GENERIC_TOPIC_ANCHORS_IT
        : GENERIC_TOPIC_ANCHORS_EN;
}

function hasMeaningfulTopicOverlap(params: {
    userMessage?: string;
    nextTopic: any;
    language: string;
}): { hasSignal: boolean; overlaps: string[] } {
    const userMessage = String(params.userMessage || '').trim();
    if (!userMessage || !params.nextTopic) return { hasSignal: false, overlaps: [] };
    if (isClarificationSignal(userMessage, params.language)) return { hasSignal: false, overlaps: [] };

    const genericAnchors = getGenericTopicAnchors(params.language);
    const userAnchors = buildMessageAnchors(userMessage, params.language).anchors
        .map(a => a.toLowerCase())
        .filter(a => !genericAnchors.has(a));
    const topicAnchors = buildTopicAnchors(params.nextTopic, params.language).anchors
        .map(a => a.toLowerCase())
        .filter(a => !genericAnchors.has(a));

    const overlapSet = new Set<string>();
    for (const u of userAnchors) {
        for (const t of topicAnchors) {
            if (u === t) {
                overlapSet.add(u);
                continue;
            }
            if (u.length >= 8 && t.length >= 8) {
                if (u.startsWith(t.slice(0, 8)) || t.startsWith(u.slice(0, 8))) {
                    overlapSet.add(u.length <= t.length ? u : t);
                }
            }
        }
    }

    if (overlapSet.size > 0) {
        return { hasSignal: true, overlaps: Array.from(overlapSet) };
    }

    const labelTokens = String(params.nextTopic.label || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(token => token.length >= 4 && !genericAnchors.has(token));
    const lowerUser = userMessage.toLowerCase();
    const labelHits = labelTokens.filter(token => lowerUser.includes(token));
    if (labelHits.length > 0) {
        return { hasSignal: true, overlaps: labelHits };
    }

    return { hasSignal: false, overlaps: [] };
}

function isUsableBridgeSnippet(snippet: string, language: string): boolean {
    const clean = String(snippet || '').replace(/\s+/g, ' ').trim();
    if (!clean) return false;
    if (isClarificationSignal(clean, language)) return false;

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 3) return false;

    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const lowSignalPattern = isItalian
        ? /\b(te l[’']?ho gi[aà] detto|non capisco|preferisco non dirlo|boh|ok|s[iì]|no)\b/i
        : /\b(i already told you|i don.t understand|prefer not to say|ok|yes|no)\b/i;
    return !lowSignalPattern.test(clean);
}

// ============================================================================
// HELPER: Complete interview and save profile
// ============================================================================
async function completeInterview(
    conversationId: string,
    messages: any[],
    apiKey: string,
    existingProfile: any,
    options?: { simulationMode?: boolean }
): Promise<void> {
    // Run profile extraction and completion marking in PARALLEL
    // This saves time by not waiting for one before starting the other
    const [extractedProfile] = await Promise.all([
        // Profile extraction (slow LLM call)
        (async () => {
            try {
                const { CandidateExtractor } = await import('@/lib/llm/candidate-extractor');
                return await CandidateExtractor.extractProfile(messages, apiKey, conversationId);
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

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function POST(req: Request) {
    const startTime = Date.now();
    try {
        const simulationMode = isLocalSimulationRequest(req);
        const body = await req.json();
        const parsedBody = ChatRequestSchema.safeParse(body);
        if (!parsedBody.success) {
            return Response.json(
                { error: 'Invalid chat payload', details: parsedBody.error.issues },
                { status: 400 }
            );
        }

        const {
            messages: incomingMessages,
            conversationId,
            botId,
            effectiveDuration,
            introMessage,
            clientMessageId
        } = parsedBody.data;
        console.log(`\n🚀 [CHAT_API] Processing message for conversation: ${conversationId}`);
        if (simulationMode) {
            console.log('🧪 [CHAT_API] Local simulation mode enabled (credits and usage side effects disabled).');
        }

        // ====================================================================
        // 1. LOAD DATA (with parallel operations for speed)
        // ====================================================================
        const loadStart = Date.now();
        const conversation = await ChatService.loadConversation(conversationId, botId);
        console.log(`⏱️ [TIMING] Data load: ${Date.now() - loadStart}ms`);
        const bot = conversation.bot;
        const language = bot.language || 'en';
        const shouldCollectData = (bot as any).collectCandidateData;
        const lastIncomingMessage = incomingMessages[incomingMessages.length - 1];

        // Idempotent replay: if we already answered this client message, return the saved answer.
        if (clientMessageId) {
            const replayedAssistant = await prisma.message.findFirst({
                where: {
                    conversationId,
                    role: 'assistant',
                    metadata: {
                        path: ['replyToClientMessageId'],
                        equals: clientMessageId
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (replayedAssistant) {
                return Response.json({
                    text: replayedAssistant.content,
                    currentTopicId: conversation.currentTopicId,
                    isCompleted: conversation.status === 'COMPLETED'
                });
            }
        }

        if (!simulationMode) {
            const creditsCheck = await checkCreditsForAction(
                'interview_question',
                undefined,
                (bot as any).project?.id,
                (bot as any).project?.organization?.id
            );
            if (!creditsCheck.allowed) {
                return Response.json(
                    {
                        code: (creditsCheck as any).code || 'ACCESS_DENIED',
                        error: creditsCheck.error,
                        creditsNeeded: creditsCheck.creditsNeeded,
                        creditsAvailable: creditsCheck.creditsAvailable
                    },
                    { status: creditsCheck.status || 403 }
                );
            }
        }

        // Run these operations in parallel - they don't depend on each other
        const parallelStart = Date.now();
        const previousEffectiveDuration = Number(conversation.effectiveDuration || 0);
        const parsedEffectiveDuration = Number(effectiveDuration ?? previousEffectiveDuration);
        const safeEffectiveDuration = Number.isFinite(parsedEffectiveDuration)
            ? Math.min(
                Math.max(previousEffectiveDuration, parsedEffectiveDuration),
                previousEffectiveDuration + 600 // Prevent extreme client-side jumps in one turn.
            )
            : previousEffectiveDuration;

        const saveUserMessagePromise = (async () => {
            if (lastIncomingMessage?.role !== 'user') return null;

            if (clientMessageId) {
                const existingUserMessage = await prisma.message.findFirst({
                    where: {
                        conversationId,
                        role: 'user',
                        metadata: {
                            path: ['clientMessageId'],
                            equals: clientMessageId
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                if (existingUserMessage) {
                    return existingUserMessage;
                }

                return prisma.message.create({
                    data: {
                        conversationId,
                        role: 'user',
                        content: lastIncomingMessage.content,
                        metadata: { clientMessageId }
                    }
                });
            }

            return ChatService.saveUserMessage(conversationId, lastIncomingMessage.content);
        })();

        const [savedUserMessage, , openAIKey, prefetchedModel] = await Promise.all([
            saveUserMessagePromise,
            // Update progress
            ChatService.updateProgress(conversationId, safeEffectiveDuration),
            // Get API key
            LLMService.getApiKey(bot, 'openai').then(key => key || process.env.OPENAI_API_KEY || ''),
            // Pre-fetch model (this also warms up the connection)
            LLMService.getModel(bot)
        ]);
        console.log(`⏱️ [TIMING] Parallel ops: ${Date.now() - parallelStart}ms`);

        const canonicalMessages: ClientMessage[] = conversation.messages.map(m => ({
            role: (m.role as ClientMessage['role']) || 'assistant',
            content: m.content
        }));

        if (savedUserMessage && !conversation.messages.some(m => m.id === savedUserMessage.id)) {
            canonicalMessages.push({
                role: 'user',
                content: savedUserMessage.content
            });
        }

        const lastMessage = canonicalMessages[canonicalMessages.length - 1];

        const assistantTurnsSoFar = canonicalMessages.reduce(
            (count, message) => (message.role === 'assistant' ? count + 1 : count),
            0
        );
        const reachedSafetyCap =
            assistantTurnsSoFar >= CONFIG.SAFETY_MAX_ASSISTANT_TURNS ||
            canonicalMessages.length >= CONFIG.SAFETY_MAX_TOTAL_MESSAGES;

        if (reachedSafetyCap) {
            const safetyMessage = language === 'it'
                ? 'Per sicurezza concludo qui l’intervista. Grazie per il contributo: le informazioni raccolte sono già molto utili.'
                : 'For safety, I will conclude the interview here. Thank you: the information collected is already very useful.';

            await completeInterview(
                conversationId,
                canonicalMessages,
                openAIKey,
                conversation.candidateProfile || {},
                { simulationMode }
            );
            await prisma.message.create({
                data: {
                    conversationId,
                    role: 'assistant',
                    content: safetyMessage,
                    metadata: clientMessageId
                        ? { replyToClientMessageId: clientMessageId, safetyStop: true }
                        : { safetyStop: true }
                }
            });

            return Response.json({
                text: safetyMessage,
                currentTopicId: conversation.currentTopicId,
                isCompleted: true
            });
        }

        // Topics
        const botTopics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
        const numTopics = botTopics.length;
        const interviewPlan = await getOrCreateInterviewPlan(bot);
        console.log("📊 [PLAN] Meta:", {
            maxDurationMins: interviewPlan.meta.maxDurationMins,
            totalTimeSec: interviewPlan.meta.totalTimeSec,
            perTopicTimeSec: interviewPlan.meta.perTopicTimeSec,
            secondsPerTurn: interviewPlan.meta.secondsPerTurn,
            topics: interviewPlan.scan.topics.map(t => ({
                topicId: t.topicId,
                label: t.label,
                minTurns: t.minTurns,
                maxTurns: t.maxTurns
            }))
        });

        // ====================================================================
        // 2. LOAD STATE
        // ====================================================================
        const rawMetadata = (conversation as any).metadata || {};
        const state: InterviewState = {
            phase: rawMetadata.phase || 'SCAN',
            topicIndex: rawMetadata.topicIndex ?? 0,
            turnInTopic: rawMetadata.turnInTopic ?? 0,
            deepAccepted: rawMetadata.deepAccepted ?? null,
            consentGiven: rawMetadata.consentGiven ?? null,
            lastAskedField: rawMetadata.lastAskedField ?? null,
            dataCollectionAttempts: rawMetadata.dataCollectionAttempts ?? 0,
            fieldAttemptCounts: rawMetadata.fieldAttemptCounts ?? {},
            closureAttempts: rawMetadata.closureAttempts ?? 0,
            interestingTopics: rawMetadata.interestingTopics ?? [],
            deepTopicOrder: rawMetadata.deepTopicOrder ?? [],
            deepTurnsByTopic: rawMetadata.deepTurnsByTopic ?? {},
            topicSubGoalHistory: rawMetadata.topicSubGoalHistory ?? {},
            lastUserTopicId: rawMetadata.lastUserTopicId ?? null,
            deepLastSubGoalByTopic: rawMetadata.deepLastSubGoalByTopic ?? {},
            forceConsentQuestion: rawMetadata.forceConsentQuestion ?? false,
            clarificationTurnsByTopic: rawMetadata.clarificationTurnsByTopic ?? {},
            extensionReturnPhase: rawMetadata.extensionReturnPhase ?? null,
            extensionReturnTopicIndex: rawMetadata.extensionReturnTopicIndex ?? null,
            extensionReturnTurnInTopic: rawMetadata.extensionReturnTurnInTopic ?? null,
            extensionOfferAttempts: rawMetadata.extensionOfferAttempts ?? 0,
        };

        const activeTopics = state.phase === 'DEEP' ? getDeepTopics(botTopics, state.deepTopicOrder) : botTopics;
        const currentTopic = activeTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number.isFinite(safeEffectiveDuration)
            ? safeEffectiveDuration
            : Number(conversation.effectiveDuration || 0);
        const maxDurationMins = bot.maxDurationMins || 10;

        console.log(`📊 [STATE] Phase: ${state.phase}, Topic: ${currentTopic.label}, Index: ${state.topicIndex}, Turn: ${state.turnInTopic}`);
        console.log(`⏱️ [TIME] Effective: ${effectiveSec}s / Max: ${maxDurationMins}m`);
        if (lastMessage?.role === 'user') {
            const userPreview = String(lastMessage.content || '').slice(0, 400);
            console.log("💬 [USER] Preview:", userPreview);
        }

        console.log("📊 [CHAT] State:", {
            phase: state.phase,
            topic: currentTopic.label,
            topicIndex: state.topicIndex,
            turnInTopic: state.turnInTopic,
            effectiveSec,
            maxDurationMins
        });

        // ====================================================================
        // 3. PHASE MACHINE
        // ====================================================================
        const nextState = { ...state };
        let systemPrompt = "";
        let nextTopicId = currentTopic.id;
        let supervisorInsight: any = { status: 'SCANNING' };

        if (lastMessage?.role === 'user') {
            nextState.lastUserTopicId = currentTopic.id;
        }

        // --------------------------------------------------------------------
        // PHASE: MACHINE
        // --------------------------------------------------------------------
        if (supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT') {

            if (state.phase === 'SCAN') {
                const scanMaxTurns = getScanPlanTurns(interviewPlan, currentTopic.id);
                const scanPlanTopic = interviewPlan.scan.topics.find(t => t.topicId === currentTopic.id);
                console.log(`📊 [SCAN] Topic "${currentTopic.label}" turn=${state.turnInTopic} maxTurns=${scanMaxTurns} plan=`, {
                    minTurns: scanPlanTopic?.minTurns,
                    maxTurns: scanPlanTopic?.maxTurns
                });
                // Check if we should transition to next topic (use dynamic budget)
                if (state.turnInTopic >= scanMaxTurns) {
                    const shouldClarifyBeforeTransition =
                        lastMessage?.role === 'user' &&
                        isClarificationSignal(lastMessage.content, language) &&
                        ((state.clarificationTurnsByTopic || {})[currentTopic.id] || 0) < 1;

                    if (shouldClarifyBeforeTransition) {
                        const usedSubGoals = (state.topicSubGoalHistory || {})[currentTopic.id] || [];
                        const availableSubGoals = (currentTopic.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
                        const clarifySubGoal = availableSubGoals[0] || currentTopic.label;
                        nextState.clarificationTurnsByTopic = {
                            ...(state.clarificationTurnsByTopic || {}),
                            [currentTopic.id]: ((state.clarificationTurnsByTopic || {})[currentTopic.id] || 0) + 1
                        };
                        nextState.turnInTopic = state.turnInTopic;
                        supervisorInsight = { status: 'SCANNING', nextSubGoal: clarifySubGoal };
                        console.log(`🧩 [SCAN] Clarification detected on "${currentTopic.label}". Adding one clarification turn before transition.`);
                        // Keep current topic for one extra clarification question.
                    } else {
                        // Move to next topic
                        if (state.topicIndex + 1 < numTopics) {
                            nextState.topicIndex = state.topicIndex + 1;
                            nextState.turnInTopic = 0;
                            nextTopicId = botTopics[nextState.topicIndex].id;

                            console.log(`➡️ [SCAN] Topic transition: ${currentTopic.label} → ${botTopics[nextState.topicIndex].label}`);
                            const nextTopic = botTopics[nextState.topicIndex];
                            const nextAvailableSubGoals = getRemainingSubGoals(nextTopic, state.topicSubGoalHistory);
                            const transitionUserMessage = lastMessage?.role === 'user'
                                ? String(lastMessage.content || '').slice(0, 300)
                                : undefined;
                            const transitionWordCount = transitionUserMessage
                                ? transitionUserMessage.split(/\s+/).filter(Boolean).length
                                : 0;
                            const overlap = hasMeaningfulTopicOverlap({
                                userMessage: transitionUserMessage,
                                nextTopic,
                                language
                            });
                            const userTouchesNextTopic = overlap.hasSignal;
                            const transitionMode = (userTouchesNextTopic && transitionWordCount >= 5) ? 'bridge' : 'clean_pivot';
                            const transitionSnippetCandidate = transitionUserMessage
                                ? sanitizeUserSnippet(transitionUserMessage, 7)
                                : '';
                            const transitionBridgeSnippet = transitionMode === 'bridge' && isUsableBridgeSnippet(transitionSnippetCandidate, language)
                                ? transitionSnippetCandidate
                                : undefined;
                            console.log(`🧭 [TRANSITION] mode=${transitionMode} userTouchesNextTopic=${userTouchesNextTopic} words=${transitionWordCount} overlaps=${overlap.overlaps.join('|') || '-'}`);
                            supervisorInsight = {
                                status: 'TRANSITION',
                                nextTopic: nextTopic.label,
                                nextSubGoal: nextAvailableSubGoals[0] || nextTopic.label,
                                transitionUserMessage,
                                transitionMode,
                                transitionBridgeSnippet
                            };
                        } else {
                            // End of SCAN: always move to DEEP.
                            // Time gate is handled only in DEEP (extension offer there).
                            const maxDurationSec = maxDurationMins * 60;
                            const remainingSec = maxDurationSec - effectiveSec;
                            console.log("📊 [SCAN] Complete.", `remainingSec: ${remainingSec}`);

                            nextState.phase = 'DEEP';
                            nextState.deepAccepted = state.deepAccepted === true ? true : null;
                            nextState.topicIndex = 0;
                            nextState.turnInTopic = 0;
                            const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics, remainingSec);
                            nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                            nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                            const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);
                            nextTopicId = deepTopics[0]?.id || botTopics[0].id;
                            const bestSnippet = (state.interestingTopics || []).find(
                                (it: InterestingTopic) => it.topicId === deepTopics[0]?.id
                            )?.bestSnippet || '';
                            supervisorInsight = { status: 'START_DEEP', engagingSnippet: bestSnippet };
                            console.log(`✅ [SCAN→DEEP] SCAN complete. Starting DEEP.`);
                        }
                    }
                } else {
                    // Continue SCAN on current topic
                    nextState.turnInTopic = state.turnInTopic + 1;
                    console.log(`📊 [SCAN] Increment turn -> ${nextState.turnInTopic}`);

                    // Track engagement for value-based DEEP ordering
                    if (lastMessage?.role === 'user') {
                        const engagementScore = computeEngagementScore(lastMessage.content, language);
                        const snippet = extractSnippet(lastMessage.content);

                        const existingTopics = [...(nextState.interestingTopics || [])];
                        const existingIndex = existingTopics.findIndex(t => t.topicId === currentTopic.id);

                        if (existingIndex >= 0) {
                            // Update with running average
                            const prev = existingTopics[existingIndex];
                            const averaged = (prev.engagementScore + engagementScore) / 2;
                            existingTopics[existingIndex] = {
                                ...prev,
                                engagementScore: averaged,
                                bestSnippet: engagementScore >= prev.engagementScore ? snippet : prev.bestSnippet
                            };
                        } else {
                            existingTopics.push({
                                topicId: currentTopic.id,
                                topicLabel: currentTopic.label,
                                engagementScore,
                                bestSnippet: snippet
                            });
                        }
                        nextState.interestingTopics = existingTopics;
                        console.log(`📊 [ENGAGEMENT] Topic "${currentTopic.label}" score: ${engagementScore.toFixed(2)}`);
                    }

                    // Ask TopicManager for next sub-goal
                    const usedSubGoals = (state.topicSubGoalHistory || {})[currentTopic.id] || [];
                    const availableSubGoals = (currentTopic.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
                    let nextSubGoal = '';

                    if (availableSubGoals.length > 0) {
                        const insight = await TopicManager.generateScanQuestion(
                            currentTopic,
                            state.turnInTopic,
                            openAIKey,
                            language,
                            availableSubGoals
                        );
                        nextSubGoal = insight.nextSubGoal;
                        nextState.topicSubGoalHistory = {
                            ...(state.topicSubGoalHistory || {}),
                            [currentTopic.id]: [...usedSubGoals, nextSubGoal]
                        };
                    } else {
                        // Sub-goals exhausted: deepen on user's last detail
                        const fallbackSnippet = lastMessage?.role === 'user' ? extractSnippet(lastMessage.content) : '';
                        const deepenVerb = language === 'it' ? 'Approfondisci' : 'Explore further';
                        nextSubGoal = fallbackSnippet ? `${deepenVerb}: "${fallbackSnippet}"` : `${deepenVerb}: "${currentTopic.label}"`;
                    }

                    supervisorInsight = { status: 'SCANNING', nextSubGoal };
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DEEP_OFFER
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEP_OFFER') {
                console.log(`🎁 [DEEP_OFFER] State: deepAccepted=${state.deepAccepted} returnPhase=${state.extensionReturnPhase || 'DEEP'} attempts=${state.extensionOfferAttempts || 0}`);
                const hasUserReply = lastMessage?.role === 'user' && String(lastMessage.content || '').trim().length > 0;
                const waitingForAnswer = state.deepAccepted === false || state.deepAccepted === null;
                const lastAssistantMessage = [...canonicalMessages]
                    .reverse()
                    .find((m: any) => m.role === 'assistant')?.content || '';
                const previousWasOffer = isExtensionOfferQuestion(lastAssistantMessage, language);

                if (!hasUserReply || !waitingForAnswer || !previousWasOffer) {
                    if (hasUserReply && waitingForAnswer && !previousWasOffer) {
                        console.log(`⚠️ [DEEP_OFFER] Previous assistant message was not a valid extension offer. Re-asking offer.`);
                    } else {
                        console.log(`🎁 [DEEP_OFFER] Asking extension offer.`);
                    }
                    supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                    nextState.deepAccepted = false;
                    nextState.extensionOfferAttempts = state.extensionOfferAttempts ?? 0;
                } else {
                    console.log(`🎁 [DEEP_OFFER] Checking user response`);
                    const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'deep_offer');
                    console.log(`🎁 [DEEP_OFFER] Intent detected: ${intent}`);

                    if (intent === 'ACCEPT') {
                        const returnPhase = state.extensionReturnPhase || 'DEEP';
                        nextState.deepAccepted = true;
                        nextState.extensionOfferAttempts = 0;
                        nextState.extensionReturnPhase = null;
                        nextState.extensionReturnTopicIndex = null;
                        nextState.extensionReturnTurnInTopic = null;

                        if (returnPhase === 'SCAN') {
                            nextState.phase = 'SCAN';
                            nextState.topicIndex = Math.max(0, state.extensionReturnTopicIndex ?? state.topicIndex ?? 0);
                            nextState.turnInTopic = Math.max(0, state.extensionReturnTurnInTopic ?? state.turnInTopic ?? 0);
                            const resumeTopic = botTopics[nextState.topicIndex] || botTopics[0];
                            nextTopicId = resumeTopic?.id || botTopics[0].id;
                            const usedSubGoals = (state.topicSubGoalHistory || {})[resumeTopic.id] || [];
                            const availableSubGoals = (resumeTopic.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
                            supervisorInsight = { status: 'SCANNING', nextSubGoal: availableSubGoals[0] || resumeTopic.label };
                            console.log(`✅ [DEEP_OFFER] User accepted extension. Resuming SCAN at topicIndex=${nextState.topicIndex}, turn=${nextState.turnInTopic}`);
                        } else {
                            nextState.phase = 'DEEP';
                            nextState.topicIndex = Math.max(0, state.extensionReturnTopicIndex ?? state.topicIndex ?? 0);
                            nextState.turnInTopic = Math.max(0, state.extensionReturnTurnInTopic ?? state.turnInTopic ?? 0);

                            const maxDurationSec = maxDurationMins * 60;
                            const remainingSecForDeep = maxDurationSec - effectiveSec;
                            const hasDeepPlan = Boolean(state.deepTurnsByTopic && Object.keys(state.deepTurnsByTopic).length > 0);
                            if (!hasDeepPlan) {
                                const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics, remainingSecForDeep);
                                nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                                nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                            }

                            const deepOrder = (nextState.deepTopicOrder && nextState.deepTopicOrder.length > 0)
                                ? nextState.deepTopicOrder
                                : (state.deepTopicOrder || []);
                            const deepTopics = getDeepTopics(botTopics, deepOrder);
                            const deepCurrent = deepTopics[nextState.topicIndex] || botTopics[nextState.topicIndex] || botTopics[0];
                            nextTopicId = deepCurrent?.id || botTopics[0].id;
                            const usedSubGoals = (state.topicSubGoalHistory || {})[deepCurrent.id] || [];
                            const availableSubGoals = (deepCurrent.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
                            const engagingSnippet = (state.interestingTopics || []).find(
                                (it: InterestingTopic) => it.topicId === deepCurrent.id
                            )?.bestSnippet || '';
                            supervisorInsight = { status: 'DEEPENING', focusPoint: availableSubGoals[0] || deepCurrent.label, engagingSnippet };
                            console.log(`✅ [DEEP_OFFER] User accepted extension. Resuming DEEP at topicIndex=${nextState.topicIndex}, turn=${nextState.turnInTopic}`);
                        }
                    } else if (intent === 'REFUSE') {
                        console.log("❌ [DEEP_OFFER] User declined extension");
                        nextState.extensionOfferAttempts = 0;
                        nextState.extensionReturnPhase = null;
                        nextState.extensionReturnTopicIndex = null;
                        nextState.extensionReturnTurnInTopic = null;
                        if (shouldCollectData) {
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                            nextState.consentGiven = false;
                            nextState.forceConsentQuestion = true;
                        } else {
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                        }
                    } else {
                        const extensionAttempts = (state.extensionOfferAttempts ?? (state as any).deepOfferNeutralAttempts ?? 0);

                        if (extensionAttempts >= 2) {
                            // No explicit consent after multiple attempts: default to no extension.
                            console.log(`🎁 [DEEP_OFFER] Neutral responses reached limit. Defaulting to no extension.`);
                            nextState.extensionOfferAttempts = 0;
                            nextState.extensionReturnPhase = null;
                            nextState.extensionReturnTopicIndex = null;
                            nextState.extensionReturnTurnInTopic = null;
                            if (shouldCollectData) {
                                nextState.phase = 'DATA_COLLECTION';
                                supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                                nextState.consentGiven = false;
                                nextState.forceConsentQuestion = true;
                            } else {
                                nextState.phase = 'DATA_COLLECTION';
                                supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            }
                        } else {
                            console.log(`🎁 [DEEP_OFFER] Neutral response (attempt ${extensionAttempts + 1}), re-asking extension offer`);
                            supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                            nextState.deepAccepted = false;
                            nextState.extensionOfferAttempts = extensionAttempts + 1;
                        }
                    }
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DEEP
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEP') {
                if (!state.deepTurnsByTopic || Object.keys(state.deepTurnsByTopic).length === 0) {
                    const maxDurationSecForPlan = maxDurationMins * 60;
                    const remainingSecForPlan = maxDurationSecForPlan - effectiveSec;
                    const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics, remainingSecForPlan);
                    nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                    nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                }
                const deepOrder = (nextState.deepTopicOrder && nextState.deepTopicOrder.length > 0)
                    ? nextState.deepTopicOrder
                    : state.deepTopicOrder;
                const deepTurnsMap = (nextState.deepTurnsByTopic && Object.keys(nextState.deepTurnsByTopic).length > 0)
                    ? nextState.deepTurnsByTopic
                    : state.deepTurnsByTopic;
                const deepTopics = getDeepTopics(botTopics, deepOrder);
                const deepCurrent = deepTopics[state.topicIndex] || currentTopic;
                const turnsLimit = Math.max(1, (deepTurnsMap || {})[deepCurrent.id] || getDeepPlanTurns(interviewPlan, deepCurrent.id));
                const deepTotal = deepTopics.length || numTopics;

                console.log(`📊 [DEEP] Topic ${state.topicIndex + 1}/${deepTotal}, Turn ${state.turnInTopic + 1}/${turnsLimit}`);

                // If time is over during DEEP, offer extra time before continuing
                const maxDurationSec = maxDurationMins * 60;
                const remainingSec = maxDurationSec - effectiveSec;
                if (remainingSec <= 0 && state.deepAccepted !== true) {
                    nextState.phase = 'DEEP_OFFER';
                    nextState.deepAccepted = false;
                    nextState.extensionReturnPhase = 'DEEP';
                    nextState.extensionReturnTopicIndex = state.topicIndex;
                    nextState.extensionReturnTurnInTopic = state.turnInTopic;
                    nextState.extensionOfferAttempts = 0;
                    supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                    console.log(`🎁 [DEEP→DEEP_OFFER] Time limit reached during DEEP. Asking extension consent.`);
                }

                if (nextState.phase === 'DEEP_OFFER') {
                    // Skip DEEP progression until user responds to offer
                } else if (state.turnInTopic >= turnsLimit) {
                    // Move to next topic
                    if (state.topicIndex + 1 < deepTotal) {
                        nextState.topicIndex = state.topicIndex + 1;
                        nextState.turnInTopic = 0;
                        nextTopicId = deepTopics[nextState.topicIndex]?.id || botTopics[nextState.topicIndex]?.id;

                        console.log(`➡️ [DEEP] Topic transition: ${deepCurrent.label} → ${deepTopics[nextState.topicIndex]?.label || botTopics[nextState.topicIndex]?.label}`);
                        const nextDeepTopic = deepTopics[nextState.topicIndex] || botTopics[nextState.topicIndex];
                        const nextAvailableSubGoals = nextDeepTopic ? getRemainingSubGoals(nextDeepTopic, nextState.topicSubGoalHistory || state.topicSubGoalHistory) : [];
                        const transitionUserMessage = lastMessage?.role === 'user'
                            ? String(lastMessage.content || '').slice(0, 300)
                            : undefined;
                        const transitionWordCount = transitionUserMessage
                            ? transitionUserMessage.split(/\s+/).filter(Boolean).length
                            : 0;
                        const overlap = hasMeaningfulTopicOverlap({
                            userMessage: transitionUserMessage,
                            nextTopic: nextDeepTopic,
                            language
                        });
                        const userTouchesNextTopic = overlap.hasSignal;
                        const transitionMode = (userTouchesNextTopic && transitionWordCount >= 5) ? 'bridge' : 'clean_pivot';
                        const transitionSnippetCandidate = transitionUserMessage
                            ? sanitizeUserSnippet(transitionUserMessage, 7)
                            : '';
                        const transitionBridgeSnippet = transitionMode === 'bridge' && isUsableBridgeSnippet(transitionSnippetCandidate, language)
                            ? transitionSnippetCandidate
                            : undefined;
                        console.log(`🧭 [TRANSITION] mode=${transitionMode} userTouchesNextTopic=${userTouchesNextTopic} words=${transitionWordCount} overlaps=${overlap.overlaps.join('|') || '-'}`);
                        supervisorInsight = {
                            status: 'TRANSITION',
                            nextTopic: nextDeepTopic?.label || botTopics[nextState.topicIndex]?.label,
                            nextSubGoal: nextAvailableSubGoals[0] || nextDeepTopic?.label,
                            transitionUserMessage,
                            transitionMode,
                            transitionBridgeSnippet
                        };
                    } else {
                        // End of DEEP - ALL topics done, move to DATA_COLLECTION
                        console.log(`✅ [DEEP] All ${deepTotal} topics completed. Moving to DATA_COLLECTION.`);
                        const maxDurationSec = maxDurationMins * 60;
                        const remainingSecAfterDeep = maxDurationSec - effectiveSec;
                        console.log(`✅ [DEEP] Remaining time after DEEP: ${remainingSecAfterDeep}s. Proceeding to DATA_COLLECTION.`);

                        if (shouldCollectData) {
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                            nextState.consentGiven = false;
                        } else {
                            // Let the AI say goodbye
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                        }
                    }
                } else {
                    // Continue DEEP on current topic
                    nextState.turnInTopic = state.turnInTopic + 1;

                    // Ask for a DEEP focus point (avoid repetition)
                    const usedSubGoals = (state.topicSubGoalHistory || {})[deepCurrent.id] || [];
                    const lastDeepGoal = (state.deepLastSubGoalByTopic || {})[deepCurrent.id];
                    const availableSubGoals = (deepCurrent.subGoals || [])
                        .filter((sg: string) => !usedSubGoals.includes(sg))
                        .filter((sg: string) => (lastDeepGoal ? sg !== lastDeepGoal : true));

                    // Get engaging snippet from SCAN phase for this topic
                    const matchingTopic = (nextState.interestingTopics || state.interestingTopics || []).find(
                        (it: InterestingTopic) => it.topicId === deepCurrent.id
                    );
                    const engagingSnippet = matchingTopic?.bestSnippet || '';

                    if (availableSubGoals.length === 0) {
                        const fallbackSnippet = lastMessage?.role === 'user' ? extractSnippet(lastMessage.content) : '';
                        const deepenVerb = language === 'it' ? 'Approfondisci' : 'Explore further';
                        const focusPoint = fallbackSnippet ? `${deepenVerb}: "${fallbackSnippet}"` : `${deepenVerb}: "${deepCurrent.label}"`;
                        supervisorInsight = { status: 'DEEPENING', focusPoint, engagingSnippet };
                    } else {
                        const focusPoint = availableSubGoals[0];
                        nextState.topicSubGoalHistory = {
                            ...(state.topicSubGoalHistory || {}),
                            [deepCurrent.id]: [...usedSubGoals, focusPoint]
                        };
                        nextState.deepLastSubGoalByTopic = {
                            ...(state.deepLastSubGoalByTopic || {}),
                            [deepCurrent.id]: focusPoint
                        };
                        supervisorInsight = { status: 'DEEPENING', focusPoint, engagingSnippet };
                    }

                    console.log(`🔍 [DEEP] Continuing topic "${deepCurrent.label}", turn ${nextState.turnInTopic}/${turnsLimit}`);
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DATA_COLLECTION
            // --------------------------------------------------------------------
            else if (state.phase === 'DATA_COLLECTION') {
                console.log(`📋 [DATA_COLLECTION] State: consentGiven=${state.consentGiven}, lastAskedField=${state.lastAskedField}, attempts=${state.dataCollectionAttempts}`);

                // Anti-loop protection
                if (state.dataCollectionAttempts >= CONFIG.MAX_DATA_COLLECTION_ATTEMPTS) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                }

                if (state.dataCollectionRefused) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    nextState.dataCollectionRefused = true;
                }

                const shouldContinueDataCollection = supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA';
                if (shouldContinueDataCollection) {
                    const candidateFields = (bot.candidateDataFields as any[]) || [];
                    const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
                    let currentProfile = (conversation.candidateProfile as any) || {};
                    console.log(`📋 [DATA_COLLECTION] Fields to collect: ${candidateFieldIds.join(', ')}`);
                    console.log(`📋 [DATA_COLLECTION] Current profile keys: ${Object.keys(currentProfile).join(', ') || 'none'}`);

                    // STEP 1: Handle consent flow
                    if (state.consentGiven === null) {
                        // First time in DATA_COLLECTION - ask for consent
                        console.log(`📋 [DATA_COLLECTION] Asking for consent (first time)`);
                        supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        nextState.consentGiven = false; // Mark that we're waiting for response
                        nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                    } else if (state.consentGiven === false) {
                        // We asked for consent, now check user's response
                        console.log(`📋 [DATA_COLLECTION] Checking consent response`);
                        const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'consent');
                        console.log(`📋 [DATA_COLLECTION] Intent detected: ${intent}`);

                        if (intent === 'ACCEPT') {
                            nextState.consentGiven = true;
                            console.log(`📋 [DATA_COLLECTION] User accepted, will ask first field`);
                            // Don't set supervisorInsight here - let it fall through to ask first field
                        } else if (intent === 'REFUSE') {
                            console.log(`📋 [DATA_COLLECTION] User refused consent.`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode }
                            );
                            // Set status for AI to say goodbye
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
                            nextState.consentGiven = false;
                            nextState.lastAskedField = null;
                            nextState.dataCollectionRefused = true;
                        } else {
                            // NEUTRAL - re-ask consent
                            console.log(`📋 [DATA_COLLECTION] Neutral response, re-asking consent`);
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                            nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                        }
                    }

                    // STEP 2: If consent given (now or before), handle field collection
                    if (nextState.consentGiven === true || state.consentGiven === true) {
                        console.log(`📋 [DATA_COLLECTION] Consent given, processing fields`);
                        let haltCollection = false;

                        // CHECK: Did user change their mind mid-collection? ("basta", "non voglio", "stop")
                        const REFUSAL_MID_COLLECTION_IT = /\b(basta|non voglio|stop|preferisco fermarmi|non continuare|lascia stare)\b/i;
                        const REFUSAL_MID_COLLECTION_EN = /\b(stop|enough|i don't want|let's stop|never mind|forget it)\b/i;
                        const refusalPattern = language === 'it' ? REFUSAL_MID_COLLECTION_IT : REFUSAL_MID_COLLECTION_EN;

                        // CHECK: Is user frustrated/complaining about repeated questions?
                        const FRUSTRATION_IT = /\b(già (detto|chiesto)|te l'ho (già|appena)|incantato|bloccato|ripeti|sempre la stessa|loop)\b/i;
                        const FRUSTRATION_EN = /\b(already (told|said|asked)|just (told|said)|stuck|loop|same question|repeating)\b/i;
                        const frustrationPattern = language === 'it' ? FRUSTRATION_IT : FRUSTRATION_EN;
                        const userFrustrated = lastMessage?.role === 'user' && frustrationPattern.test(lastMessage.content);

                        if (lastMessage?.role === 'user' && refusalPattern.test(lastMessage.content)) {
                            console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode }
                            );
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            nextState.dataCollectionRefused = true;
                            haltCollection = true;
                        }

                        // If user is frustrated about repeated questions, try to extract info from conversation history
                        // and complete the interview with what we have
                        if (userFrustrated) {
                            console.log(`⚠️ [DATA_COLLECTION] User frustrated - attempting to extract from history and complete`);

                            // Determine which name field is configured (name or fullName)
                            const configuredNameField = candidateFieldIds.find((fieldName: string) =>
                                fieldName === 'name' || fieldName === 'fullName'
                            );
                            const nameFieldKey = configuredNameField || 'fullName';

                            // Try to find the name in previous messages if we don't have it
                            if (!currentProfile[nameFieldKey]) {
                                // Look for a short reply (1-3 words) after a "name" question
                                for (let i = canonicalMessages.length - 1; i >= 0; i--) {
                                    const msg = canonicalMessages[i];
                                    if (msg.role === 'user') {
                                        const content = msg.content.trim();
                                        const words = content.split(/\s+/);
                                        // Short response that looks like a name
                                        if (words.length <= 3 && content.length < 30 && !/[@\d]/.test(content)) {
                                            const cleanedName = content.replace(/[.!?,;:]/g, '').trim();
                                            if (cleanedName.length > 1) {
                                                currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                                console.log(`✅ [DATA_COLLECTION] Recovered name from history for "${nameFieldKey}"`);
                                                await prisma.conversation.update({
                                                    where: { id: conversationId },
                                                    data: { candidateProfile: currentProfile }
                                                });
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            // Complete with what we have
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode }
                            );
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            haltCollection = true;
                        }

                        if (!haltCollection) {
                            // CHECK: Did user say they don't have this field? ("non ho email", "I don't have")
                            const SKIP_FIELD_IT = /\b(non ho|non ce l'ho|non posso|preferisco non)\b/i;
                            const SKIP_FIELD_EN = /\b(i don't have|don't have|can't provide|prefer not to)\b/i;
                            const skipPattern = language === 'it' ? SKIP_FIELD_IT : SKIP_FIELD_EN;
                            const userWantsToSkip = lastMessage?.role === 'user' && skipPattern.test(lastMessage.content);

                            // Targeted extraction strategy:
                            // 1) prioritize the field we just asked,
                            // 2) opportunistically capture deterministic structured fields (email/phone/url),
                            // 3) avoid broad multi-field LLM extraction to reduce false positives.
                            if (lastMessage?.role === 'user' && !userWantsToSkip) {
                                const missingFieldIds = candidateFieldIds.filter((fieldName: string) =>
                                    !currentProfile[fieldName] && currentProfile[fieldName] !== '__SKIPPED__'
                                );
                                const lastAsked = state.lastAskedField;
                                const prioritizedField = (lastAsked && missingFieldIds.includes(lastAsked))
                                    ? lastAsked
                                    : (missingFieldIds[0] || null);

                                console.log(`📋 [DATA_COLLECTION] Missing fields: ${missingFieldIds.join(', ') || 'none'}`);
                                console.log(`📋 [DATA_COLLECTION] Prioritized field: ${prioritizedField || 'none'}`);

                                const userReply = lastMessage.content.trim();
                                const wordCount = userReply.split(/\s+/).length;
                                let profileChanged = false;

                                // Opportunistic deterministic extraction for structured fields present in free text.
                                const opportunisticFields = missingFieldIds.filter((fieldName: string) =>
                                    ['email', 'phone', 'linkedin', 'portfolio'].includes(fieldName) && fieldName !== prioritizedField
                                );
                                for (const fieldName of opportunisticFields) {
                                    const deterministicValue = extractDeterministicFieldValue(fieldName, lastMessage.content);
                                    if (deterministicValue) {
                                        currentProfile = { ...currentProfile, [fieldName]: deterministicValue };
                                        profileChanged = true;
                                        console.log(`✅ [DATA_COLLECTION] Opportunistic deterministic capture for "${fieldName}"`);
                                    }
                                }

                                if (prioritizedField) {
                                    // Direct capture for NAME (1-3 words, no special chars)
                                    const isNameField = prioritizedField === 'fullName' || prioritizedField === 'name';
                                    const nameFieldKey = prioritizedField === 'name' ? 'name' : 'fullName';
                                    if (isNameField && wordCount <= 3 && !currentProfile[nameFieldKey]) {
                                        const cleanedName = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedName.length > 0 && cleanedName.length < 50 && !/[@\d]/.test(cleanedName)) {
                                            currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct name capture for "${nameFieldKey}"`);
                                        }
                                    }

                                    // Direct capture for COMPANY (1-5 words, reasonable length)
                                    if (prioritizedField === 'company' && wordCount <= 5 && !currentProfile.company) {
                                        const cleanedCompany = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedCompany.length > 1 && cleanedCompany.length < 100 &&
                                            !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedCompany)) {
                                            currentProfile = { ...currentProfile, company: cleanedCompany };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct company capture`);
                                        }
                                    }

                                    // Direct capture for ROLE (1-4 words)
                                    if (prioritizedField === 'role' && wordCount <= 4 && !currentProfile.role) {
                                        const cleanedRole = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedRole.length > 1 && cleanedRole.length < 50 &&
                                            !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedRole)) {
                                            currentProfile = { ...currentProfile, role: cleanedRole };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct role capture`);
                                        }
                                    }

                                    if (!currentProfile[prioritizedField]) {
                                        const deterministicValue = extractDeterministicFieldValue(prioritizedField, lastMessage.content);
                                        if (deterministicValue) {
                                            currentProfile = { ...currentProfile, [prioritizedField]: deterministicValue };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Deterministic extraction for "${prioritizedField}"`);
                                        }
                                    }

                                    if (!currentProfile[prioritizedField]) {
                                        const extraction = await extractFieldFromMessage(
                                            prioritizedField,
                                            lastMessage.content,
                                            openAIKey,
                                            language
                                        );
                                        console.log(`🔍 [DATA_COLLECTION] Extraction result for "${prioritizedField}": confidence="${extraction.confidence}"`);
                                        if (extraction.value && extraction.confidence !== 'none') {
                                            currentProfile = { ...currentProfile, [prioritizedField]: extraction.value };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] LLM extraction for "${prioritizedField}"`);
                                        } else {
                                            console.log(`⚠️ [DATA_COLLECTION] Could not extract "${prioritizedField}" (confidence=${extraction.confidence})`);
                                        }
                                    }
                                }

                                // Save only when profile changed in this turn.
                                if (profileChanged) {
                                    await prisma.conversation.update({
                                        where: { id: conversationId },
                                        data: { candidateProfile: currentProfile }
                                    });
                                    console.log(`✅ [DATA_COLLECTION] Saved profile`);
                                }
                            } else if (userWantsToSkip && state.lastAskedField) {
                                // User wants to skip this field - mark it as skipped so we don't ask again
                                console.log(`📋 [DATA_COLLECTION] User wants to skip "${state.lastAskedField}"`);
                                currentProfile = { ...currentProfile, [state.lastAskedField]: '__SKIPPED__' };
                                await prisma.conversation.update({
                                    where: { id: conversationId },
                                    data: { candidateProfile: currentProfile }
                                });
                            }

                            // Find next missing field (skip fields marked as __SKIPPED__ or asked too many times)
                            const MAX_FIELD_ATTEMPTS = 3; // Skip field if asked more than 3 times
                            const nextField = getNextMissingCandidateField(
                                candidateFieldIds,
                                currentProfile,
                                state.fieldAttemptCounts,
                                MAX_FIELD_ATTEMPTS
                            );
                            console.log(`📋 [DATA_COLLECTION] Next field to ask: ${nextField || 'NONE - all collected/skipped'}`);

                            if (!nextField) {
                                // All fields collected or skipped!
                                console.log(`✅ [DATA_COLLECTION] All fields collected/skipped, letting AI say final goodbye`);
                                supervisorInsight = { status: 'FINAL_GOODBYE' };
                                nextState.lastAskedField = null;
                            } else {
                                // Set up to ask next field - track attempt count
                                nextState.lastAskedField = nextField;
                                nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                                nextState.consentGiven = true;
                                nextState.fieldAttemptCounts = {
                                    ...state.fieldAttemptCounts,
                                    [nextField]: (state.fieldAttemptCounts[nextField] || 0) + 1
                                };
                                supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextField };
                            }
                        }
                    }
                } else {
                    nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
                }
            }
        }

        // Log supervisor insight and next state transition for visibility
        console.log(`📊 [SUPERVISOR] Insight: ${supervisorInsight?.status || 'N/A'}, NextSubGoal: ${supervisorInsight?.nextSubGoal || 'N/A'}`);
        console.log(`🧭 [FLOW] Phase Transition: ${state.phase} -> ${nextState.phase}`);
        if (state.topicIndex !== nextState.topicIndex) {
            console.log(`🔄 [TOPIC] Pivot: Topic Index ${state.topicIndex} -> ${nextState.topicIndex}`);
        }

        // ====================================================================
        // 4. BUILD PROMPT
        // ====================================================================
        const methodology = LLMService.getMethodology();
        const model = prefetchedModel; // Use pre-fetched model from parallel init
        const nextActiveTopics = nextState.phase === 'DEEP'
            ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
            : botTopics;
        const targetTopic = nextActiveTopics[nextState.topicIndex] || currentTopic;


        systemPrompt = await PromptBuilder.build(
            bot,
            conversation,
            targetTopic,
            methodology,
            effectiveSec,
            supervisorInsight,
            interviewPlan
        );

        console.log("📝 [PROMPT_BUILDER] System Prompt length:", systemPrompt.length);
        console.log("📝 [PROMPT_BUILDER] System Prompt snippet:", systemPrompt.substring(0, 1000) + "...");

        // Inject intro message at start
        if (introMessage && canonicalMessages.length <= 1) {
            systemPrompt += `\n\nIMPORTANT: Start your response with exactly:\n"${introMessage}"\nThen follow with your first question.`;
        }

        // Phase-specific injections

        // Final reinforcement based on phase - CLEAR STATUS BANNER
        const shouldShowStatusBanner = (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') &&
            ['SCANNING', 'DEEPENING', 'TRANSITION', 'START_DEEP', 'START_DEEP_BRIEF'].includes(supervisorInsight?.status);

        if (shouldShowStatusBanner) {
            const bannerTopics = nextState.phase === 'DEEP'
                ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
                : botTopics;
            const bannerTopic = bannerTopics[nextState.topicIndex] || currentTopic;
            const currentTopicLabel = bannerTopic?.label || 'current topic';
            const targetTopicId = bannerTopic?.id || currentTopic.id;
            const scanMaxTurns = getScanPlanTurns(interviewPlan, targetTopicId);
            const deepTurns = Math.max(1, (nextState.deepTurnsByTopic || {})[targetTopicId] || getDeepPlanTurns(interviewPlan, targetTopicId));
            const turnsInfo = nextState.phase === 'SCAN'
                ? `Turn ${nextState.turnInTopic}/${scanMaxTurns}`
                : `Turn ${nextState.turnInTopic}/${deepTurns}`;

            systemPrompt += `
[SUPERVISOR_RUNTIME]
phase=${nextState.phase}
topic="${currentTopicLabel}" (${nextState.topicIndex + 1}/${numTopics})
progress=${turnsInfo}
hard_rules:
- Ask exactly ONE question about "${currentTopicLabel}".
- Do NOT ask for contacts.
- Do NOT close or wrap up.
- Do NOT add promo/CTA.
`;
        }

        const shouldEndWithQuestion = !['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'].includes(supervisorInsight?.status);
        if (shouldEndWithQuestion) {
            systemPrompt += `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;
        }

        // ====================================================================
        // 5. GENERATE RESPONSE
        // ====================================================================
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional()
        });

        let messagesForAI = canonicalMessages.map((m: any) => ({ role: m.role, content: m.content }));
        if (supervisorInsight?.status === 'DATA_COLLECTION_CONSENT' || supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            // Keep last few messages for context so the LLM can reference the conversation
            const recentMessages = canonicalMessages.slice(-4).map((m: any) => ({ role: m.role, content: m.content }));
            messagesForAI = recentMessages;
        }

        console.log("⏳ [CHAT] Generating response...");
        console.time("LLM");

        let result: any;
        try {
            result = await Promise.race([
                generateObject({ model, schema, messages: messagesForAI, system: systemPrompt, temperature: 0.7 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 45000))
            ]);
        } catch (error: any) {
            if (error.message === "TIMEOUT") {
                const fallback = language === 'it'
                    ? "Mi scuso, ho bisogno di un momento. Puoi ripetere?"
                    : "I apologize, I need a moment. Could you repeat that?";
                await prisma.message.create({
                    data: {
                        conversationId,
                        role: 'assistant',
                        content: fallback,
                        metadata: clientMessageId
                            ? { replyToClientMessageId: clientMessageId, type: 'timeout_fallback' }
                            : { type: 'timeout_fallback' }
                    }
                });
                return Response.json({ text: fallback, currentTopicId: nextTopicId, isCompleted: false });
            }
            throw error;
        }

        console.timeEnd("LLM");
        let responseText = result.object.response;
        console.log(`🧠 [LLM_REASONING]: ${result.object.meta_comment || 'N/A'}`);
        console.log(`🤖 [LLM_RESPONSE]: "${responseText.substring(0, 100)}..."`);
        console.log("💬 [BOT] Preview:", responseText.slice(0, 400));

        // ====================================================================
        // 5.4 TRANSITION / EXTENSION OFFER ENFORCEMENT (AI-generated, no hardcoded phrasing)
        // ====================================================================
        let didRegenerate = false;
        const qualityTelemetry: QualityTelemetry = {
            eligible: false,
            evaluated: false,
            score: null,
            passed: null,
            gateTriggered: false,
            regenerated: false,
            fallbackUsed: false,
            issues: []
        };
        const flowTelemetry: FlowGuardTelemetry = {
            topicClosureIntercepted: false,
            deepOfferClosureIntercepted: false,
            completionGuardIntercepted: false,
            completionBlockedForConsent: false,
            completionBlockedForMissingField: false
        };

        if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            const openai = createOpenAI({ apiKey: openAIKey });
            const offerSchema = z.object({ isOffer: z.boolean() });
            try {
                const offerCheck = await generateObject({
                    model: openai('gpt-4o-mini'),
                    schema: offerSchema,
                    prompt: `Determine if the assistant is explicitly asking (lightly) whether the user wants to extend the interview by a few minutes and continue, and is waiting for a yes/no.\nAssistant message: "${responseText}"\nReturn { isOffer: true/false }.`,
                    temperature: 0
                });
                if (!offerCheck.object.isOffer) {
                    console.log(`⚠️ [SUPERVISOR] Deep offer response not an offer. Regenerating.`);
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: You must ONLY ask (lightly) if the user wants to extend the interview by a few minutes to continue, and wait for yes/no. Do NOT ask any topic question.`;
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    didRegenerate = true;
                }
            } catch (e) {
                console.error('Deep offer validation failed:', e);
            }
        }

        const isTopicPhase = nextState.phase === 'SCAN' || nextState.phase === 'DEEP';
        if (isTopicPhase && targetTopic && !didRegenerate) {
            const anchorData = buildTopicAnchors(targetTopic, language);
            const allowUserAnchors = supervisorInsight?.status === 'SCANNING' || supervisorInsight?.status === 'DEEPENING';
            const userAnchorData = allowUserAnchors && lastMessage?.role === 'user'
                ? buildMessageAnchors(lastMessage.content, language)
                : { anchorRoots: [], anchors: [] };
            const mentionsTopicAnchor = responseMentionsAnchors(responseText, anchorData.anchorRoots);
            const mentionsUserAnchor = allowUserAnchors && responseMentionsAnchors(responseText, userAnchorData.anchorRoots);

            if (anchorData.anchorRoots.length > 0 && !mentionsTopicAnchor && !mentionsUserAnchor) {
                console.log(`⚠️ [SUPERVISOR] Possible topic drift from "${targetTopic.label}". Regenerating with anchors.`);
                const anchorList = anchorData.anchors.slice(0, 5).join(', ');
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Your question must stay on topic "${targetTopic.label}". Include at least ONE of these anchor terms: ${anchorList}. Ask exactly one question.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        // Track token usage - NUOVO: usa userId (owner del progetto) per il sistema crediti
        const organizationId = (bot as any).project?.organization?.id;
        const projectOwnerId = (bot as any).project?.ownerId;
        if (!simulationMode && projectOwnerId && result.usage) {
            try {
                await TokenTrackingService.logTokenUsage({
                    userId: projectOwnerId,
                    organizationId,
                    projectId: (bot as any).project?.id,
                    inputTokens: result.usage.inputTokens || 0,
                    outputTokens: result.usage.outputTokens || 0,
                    category: 'INTERVIEW',
                    model: model.modelId || 'gpt-4o',
                    operation: 'interview-response',
                    resourceType: 'interview',
                    resourceId: bot.id
                });
            } catch (err) {
                console.error('Token tracking failed:', err);
            }
        }

        // ====================================================================
        // 5.5 POST-PROCESSING: Detect premature closures and vague responses
        // ====================================================================
        const GOODBYE_PATTERNS_IT = /\b(arrivederci|buona giornata|buona serata|a presto|ci sentiamo|grazie per il tuo tempo|è stato un piacere|ti auguro|in bocca al lupo|ti contatteremo|ti terremo aggiornato)\b/i;
        const GOODBYE_PATTERNS_EN = /\b(goodbye|see you|take care|have a great day|it was a pleasure|best wishes|all the best|farewell|we will contact you|we'll be in touch)\b/i;
        const goodbyePattern = language === 'it' ? GOODBYE_PATTERNS_IT : GOODBYE_PATTERNS_EN;

        // Vague data collection patterns - bot is not asking for specific field
        const VAGUE_DATA_PATTERNS_IT = /\b(quali contatti|che tipo di dati|le informazioni che preferisci|condividi.*contatti|c'è qualcos'altro|qualcos'altro da aggiungere|altri temi|altre domande|vuoi aggiungere)\b/i;
        const VAGUE_DATA_PATTERNS_EN = /\b(which contact|what type of data|information you prefer|share.*contact|anything else|something to add|other topics|other questions|want to add)\b/i;
        const vagueDataPattern = language === 'it' ? VAGUE_DATA_PATTERNS_IT : VAGUE_DATA_PATTERNS_EN;

        const isGoodbyeResponse = goodbyePattern.test(responseText);
        const isVagueDataRequest = vagueDataPattern.test(responseText);
        const hasNoQuestion = !responseText.includes('?');
        const hasCompletionTag = /INTERVIEW_COMPLETED/i.test(responseText);

        // CRITICAL: Detect "goodbye with question" pattern (e.g., "Buona giornata! Ci vediamo?")
        // This is a closure attempt disguised as a question
        const isGoodbyeWithQuestion = isGoodbyeResponse && responseText.includes('?');
        if (isGoodbyeWithQuestion) {
            console.log(`⚠️ [SUPERVISOR] Detected goodbye phrase WITH question mark - treating as closure attempt`);
        }

        // CRITICAL: Detect premature contact requests (bot asking for contacts during SCAN/DEEP)
        const CONTACT_REQUEST_PATTERNS_IT = /\b(posso chiederti i tuoi contatti|i tuoi dati di contatto|la tua email|il tuo numero|come ti chiami|qual è la tua email|prima di salutarci|prima di concludere.*contatt)/i;
        const CONTACT_REQUEST_PATTERNS_EN = /\b(may i ask for your contact|your contact details|your email|your phone|what is your name|before we say goodbye.*contact|before we wrap up.*contact)/i;
        const contactRequestPattern = language === 'it' ? CONTACT_REQUEST_PATTERNS_IT : CONTACT_REQUEST_PATTERNS_EN;
        const isPrematureContactRequest = contactRequestPattern.test(responseText) && nextState.phase !== 'DATA_COLLECTION';
        if (isPrematureContactRequest) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to ask for contacts during ${nextState.phase} phase - intercepting!`);
        }

        console.log("🔎 [SUPERVISOR] Flags:", {
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            hasCompletionTag,
            isPrematureContactRequest,
            isVagueDataRequest,
            responseLength: responseText.length
        });

        const shouldBlockTopicClosure = shouldInterceptTopicPhaseClosure({
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            isPrematureContactRequest,
            hasCompletionTag
        });
        const shouldBlockDeepOfferClosure = shouldInterceptDeepOfferClosure({
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            hasCompletionTag
        });

        const PROMO_PATTERNS = /\b(www\.|https?:\/\/|@|email|scrivi a|contatta|offerta|promo|premio|reward|coupon|sconto)\b/i;
        const isPromoContent = PROMO_PATTERNS.test(responseText) && (nextState.phase === 'SCAN' || nextState.phase === 'DEEP' || nextState.phase === 'DEEP_OFFER');
        if (isPromoContent) {
            console.log(`⚠️ [SUPERVISOR] Promo/CTA detected during active phase. Regenerating.`);
            const enforceTopic = targetTopic?.label || currentTopic.label;
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Remove any promo/CTA. Ask exactly ONE question about "${enforceTopic}".`;
            const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

        // If in DATA_COLLECTION phase, ALWAYS ensure we ask for the specific field
        if (nextState.phase === 'DATA_COLLECTION') {
            if (nextState.dataCollectionRefused || supervisorInsight?.status === 'COMPLETE_WITHOUT_DATA') {
                console.log(`⚠️ [SUPERVISOR] Forcing final closure after data collection refusal/completion.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Conclude the interview now. Thank the user, and if a reward is configured, provide it. Do NOT ask any questions. Append "INTERVIEW_COMPLETED".`;
                try {
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Final closure regeneration failed:', e);
                }
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                }
            } else {
                const candidateFields = (bot.candidateDataFields as any[]) || [];
                const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);

                // CRITICAL: Re-read profile from DB to get updated values after extraction
                // The `conversation.candidateProfile` is stale (from start of request)
                const freshConversation = await prisma.conversation.findUnique({
                    where: { id: conversationId },
                    select: { candidateProfile: true }
                });
                const currentProfile = (freshConversation?.candidateProfile as any) || {};

                // Find first missing field (must match logic in data collection phase)
                // Consider: already collected, explicitly skipped, or asked too many times
                const MAX_FIELD_ATTEMPTS_SUPERVISOR = 3;
                const missingField = getNextMissingCandidateField(
                    candidateFieldIds,
                    currentProfile,
                    nextState.fieldAttemptCounts,
                    MAX_FIELD_ATTEMPTS_SUPERVISOR
                );

                // CONSENT PHASE: bot should ask for permission
                const forceConsent = nextState.forceConsentQuestion === true;
                if ((forceConsent || nextState.consentGiven === false) && !nextState.dataCollectionRefused) {
                    const openai = createOpenAI({ apiKey: openAIKey });
                    const consentSchema = z.object({ isConsent: z.boolean() });
                    let isConsent = false;
                    try {
                        const consentCheck = await generateObject({
                            model: openai('gpt-4o-mini'),
                            schema: consentSchema,
                            prompt: `Determine if the assistant is explicitly asking for permission to collect contact details and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isConsent: true/false }.`,
                            temperature: 0
                        });
                        isConsent = consentCheck.object.isConsent;
                    } catch (e) {
                        console.error('Consent validation failed:', e);
                    }

                    if (!isConsent || forceConsent) {
                        console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. OVERRIDING with consent question.`);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Start with one short linking sentence acknowledging the content interview is complete, then ask ONLY one yes/no consent question to collect contact details. Do not ask topic questions.`;
                        const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                        responseText = retry.object.response?.trim() || responseText;

                        try {
                            const consentCheck2 = await generateObject({
                                model: openai('gpt-4o-mini'),
                                schema: consentSchema,
                                prompt: `Determine if the assistant is explicitly asking for permission to collect contact details and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isConsent: true/false }.`,
                                temperature: 0
                            });
                            if (!consentCheck2.object.isConsent) {
                                const enforcedSystem2 = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                                const retry2 = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem2, temperature: 0.1 });
                                responseText = retry2.object.response?.trim() || responseText;
                            }
                        } catch (e) {
                            console.error('Consent validation retry failed:', e);
                        }
                    }
                    if (forceConsent) {
                        nextState.forceConsentQuestion = false;
                    }
                }
                // FIELD COLLECTION PHASE: bot should ask for specific field
                else if (nextState.consentGiven === true && missingField) {
                    // Only override if the response doesn't already ask for this field
                    const fieldMentioned = responseMentionsCandidateField(responseText, missingField);

                    if (!fieldMentioned || hasNoQuestion) {
                        console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". OVERRIDING with field question.`);
                        const fieldLabel = getFieldLabel(missingField, language);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask ONLY for ${fieldLabel}. One question only.`;
                        const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                        responseText = retry.object.response?.trim() || responseText;
                    }
                }
                // ALL FIELDS COLLECTED but bot didn't complete
                else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                    console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append \"INTERVIEW_COMPLETED\". Do not ask any questions.`;
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                        responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                    }
                }
            }
        }
        // Other phases - Handle bot trying to close during SCAN/DEEP
        // NEW STRATEGY: Track closure attempts and respect user's intent after 2 attempts
        else if (shouldBlockTopicClosure) {
            flowTelemetry.topicClosureIntercepted = true;
            const maxDurationSec = maxDurationMins * 60;
            const remainingSec = maxDurationSec - effectiveSec;
            const shouldOfferExtraTime = nextState.phase === 'DEEP' && remainingSec <= 0 && state.deepAccepted !== true;

            if (shouldOfferExtraTime) {
                console.log(`⚠️ [SUPERVISOR] Closure attempt while time is over. Switching to extension offer.`);
                const returnPhase: 'SCAN' | 'DEEP' = state.phase === 'SCAN' ? 'SCAN' : 'DEEP';
                nextState.phase = 'DEEP_OFFER';
                nextState.deepAccepted = false;
                nextState.extensionReturnPhase = returnPhase;
                nextState.extensionReturnTopicIndex = state.topicIndex;
                nextState.extensionReturnTurnInTopic = state.turnInTopic;
                nextState.extensionOfferAttempts = 0;
                supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                try {
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask (lightly) if the user wants to extend the interview by a few minutes to continue. One question only.`;
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Extension offer regeneration after closure failed:', e);
                }
            } else {
                nextState.closureAttempts = (state.closureAttempts || 0) + 1;
                console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Forcing topic question. Attempt #${nextState.closureAttempts}`);

                const enforceTopic = targetTopic?.label || currentTopic.label;
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT end the interview. Ask exactly ONE question about the topic "${enforceTopic}". Do not mention contacts, rewards, or closing. The response MUST end with a question mark.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                console.log("🧭 [SUPERVISOR] Override response:", responseText.slice(0, 300));

                // If the override still isn't a proper question, use fallback question-only generation (MAX 1 retry)
                const stillBad = !responseText.includes('?') || goodbyePattern.test(responseText);
                if (stillBad) {
                    console.log("🧭 [SUPERVISOR] Override still invalid, using fallback question-only generation.");
                    try {
                        responseText = await generateQuestionOnly({
                            model,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                            requireAcknowledgment: true
                        });
                        console.log("🧭 [SUPERVISOR] Question-only response:", responseText.slice(0, 300));
                    } catch (e) {
                        console.error("Question-only generation failed:", e);
                        // Final fallback: simple question
                        const fallbackQuestion = language === 'it'
                            ? `Puoi dirmi di più su ${enforceTopic}?`
                            : `Can you tell me more about ${enforceTopic}?`;
                        responseText = fallbackQuestion;
                    }
                }
            }
        }
        // Reset closure attempts when bot generates a valid question (not trying to close)
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && !isGoodbyeResponse && !hasNoQuestion) {
            nextState.closureAttempts = 0;
        }
        else if (shouldBlockDeepOfferClosure) {
            flowTelemetry.deepOfferClosureIntercepted = true;
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. OVERRIDING with offer question.`);
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Offer the choice to extend the interview by a few minutes and continue. One question only. Do not ask any topic question.`;
            const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // ====================================================================
        // QUALITATIVE GUARDRAILS (naturalness-first, light-touch corrections)
        // ====================================================================
        const qualityGatePhases = new Set(['SCAN', 'DEEP', 'DEEP_OFFER']);
        qualityTelemetry.eligible = qualityGatePhases.has(nextState.phase);

        if (qualityGatePhases.has(nextState.phase) && lastMessage?.role === 'user' && !/INTERVIEW_COMPLETED/i.test(responseText)) {
            qualityTelemetry.evaluated = true;
            const phaseForQuality = nextState.phase as 'SCAN' | 'DEEP' | 'DEEP_OFFER';
            const qualityTopicLabel = targetTopic?.label || currentTopic?.label || 'current topic';
            const lastAssistantBeforeCurrent = [...canonicalMessages]
                .reverse()
                .find(m => m.role === 'assistant')?.content || null;

            const qualitative = evaluateInterviewQuestionQuality({
                phase: phaseForQuality,
                topicLabel: qualityTopicLabel,
                userResponse: lastMessage.content,
                assistantResponse: responseText,
                previousAssistantResponse: lastAssistantBeforeCurrent,
                language
            });

            qualityTelemetry.score = qualitative.score;
            qualityTelemetry.passed = qualitative.passed;
            qualityTelemetry.issues = qualitative.issues.slice(0, 8);

            // Log quality issues for monitoring, but don't block
            if (!qualitative.passed) {
                console.log(`📊 [QUALITY] Score: ${qualitative.score}%, Issues: ${qualitative.issues.join(', ')}`);
            }

            // Soft correction only for the two high-impact issues requested by product:
            // - double question / malformed question count
            // - repetitive question compared to previous assistant turn
            const needsQuestionCountFix = !qualitative.checks.oneQuestion;
            const needsRepetitionFix = !qualitative.checks.nonRepetitive;
            const isTopicQuestionPhase = nextState.phase === 'SCAN' || nextState.phase === 'DEEP';

            if (isTopicQuestionPhase && (needsQuestionCountFix || needsRepetitionFix)) {
                qualityTelemetry.gateTriggered = true;
                const enforceTopic = targetTopic?.label || currentTopic.label;
                const previousAssistant = String(lastAssistantBeforeCurrent || '').slice(0, 180);
                const userContext = String(lastMessage.content || '').slice(0, 180);
                const correctionPrompt = language === 'it'
                    ? `Rigenera in modo naturale.
Vincoli:
1) Mantieni una breve frase di legame con l'ultimo messaggio utente.
2) Fai ESATTAMENTE una sola domanda.
3) Evita ripetizioni rispetto alla domanda precedente.
4) Rimani sul topic "${enforceTopic}".
5) Non chiudere e non chiedere contatti.
Ultimo messaggio utente: "${userContext}"
Domanda precedente assistente (da non ripetere): "${previousAssistant}"`
                    : `Regenerate naturally.
Constraints:
1) Keep a short bridging sentence with the user's latest message.
2) Ask EXACTLY one question.
3) Avoid repeating the previous assistant question.
4) Stay on topic "${enforceTopic}".
5) Do not close and do not ask for contacts.
Latest user message: "${userContext}"
Previous assistant question (do not repeat): "${previousAssistant}"`;

                try {
                    const retry = await generateObject({
                        model,
                        schema,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\n${correctionPrompt}`,
                        temperature: 0.35
                    });
                    responseText = retry.object.response?.trim() || responseText;
                    if ((responseText.match(/\?/g) || []).length !== 1) {
                        responseText = normalizeSingleQuestion(responseText);
                    }
                    qualityTelemetry.regenerated = true;
                    didRegenerate = true;
                } catch (e) {
                    console.error('Qualitative soft correction failed:', e);
                    qualityTelemetry.fallbackUsed = true;
                    try {
                        responseText = await generateQuestionOnly({
                            model,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                            lastUserMessage: lastMessage?.content || null,
                            requireAcknowledgment: true,
                            transitionMode: supervisorInsight?.transitionMode
                        });
                    } catch (innerError) {
                        console.error('Qualitative fallback question generation failed:', innerError);
                    }
                }
            }
        }

        // ====================================================================
        // FINAL SAFETY NET: Only intervene for critical issues
        // Strategy: ADDITIVE fix (keep original + add question) instead of full regeneration
        // ====================================================================
        if (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') {
            const hasGoodbyeNow = goodbyePattern.test(responseText);
            const hasNoQuestionNow = !responseText.includes('?');
            const hasMultipleQuestionsNow = (responseText.match(/\?/g) || []).length > 1;
            const hasCompletionNow = /INTERVIEW_COMPLETED/i.test(responseText);
            const hasPrematureContactNow = contactRequestPattern.test(responseText);

            // Only intervene for critical conversational integrity issues
            const needsIntervention =
                hasGoodbyeNow ||
                hasNoQuestionNow ||
                hasMultipleQuestionsNow ||
                hasCompletionNow ||
                hasPrematureContactNow;

            if (needsIntervention) {
                flowTelemetry.topicClosureIntercepted = true;
                const enforceTopic = targetTopic?.label || currentTopic.label;
                const userContext = lastMessage?.role === 'user' ? lastMessage.content.slice(0, 150) : '';

                console.log(`🛡️ [SAFETY_NET] Issue detected in ${nextState.phase}: goodbye=${hasGoodbyeNow}, noQuestion=${hasNoQuestionNow}, multiQuestion=${hasMultipleQuestionsNow}, completion=${hasCompletionNow}, contact=${hasPrematureContactNow}`);

                // ADDITIVE APPROACH: Ask LLM to add a follow-up question to the existing response
                const additivePrompt = language === 'it'
                    ? `La tua risposta è buona ma ${hasMultipleQuestionsNow ? 'contiene più di una domanda' : 'manca la domanda'}.
Mantieni il riconoscimento della risposta dell'utente e usa una sola domanda naturale di follow-up su "${enforceTopic}".
${userContext ? `Contesto utente: "${userContext}"` : ''}
Rispondi con il messaggio completo (riconoscimento + domanda).`
                    : `Your response is good but ${hasMultipleQuestionsNow ? 'contains more than one question' : 'is missing the question'}.
Keep your acknowledgment of the user's response and use one natural follow-up question about "${enforceTopic}".
${userContext ? `User context: "${userContext}"` : ''}
Reply with the complete message (acknowledgment + question).`;

                try {
                    // Clean the response first
                    const cleanedResponse = responseText
                        .replace(/INTERVIEW_COMPLETED/gi, '')
                        .replace(goodbyePattern, '')
                        .replace(contactRequestPattern, '')
                        .trim();

                    // If there's still meaningful content, try to add a question to it
                    if (cleanedResponse.length > 20 && !hasNoQuestionNow) {
                        // Response has content and a question, just clean it
                        responseText = cleanedResponse;
                    } else {
                        // Need to generate/add a question
                        const additiveRetry = await generateObject({
                            model,
                            schema,
                            messages: [
                                ...messagesForAI.slice(0, -1),
                                { role: 'user' as const, content: lastMessage?.content || '' }
                            ],
                            system: `${systemPrompt}\n\n${additivePrompt}`,
                            temperature: 0.4  // Slightly higher for more natural responses
                        });
                        responseText = additiveRetry.object.response?.trim() || responseText;
                    }

                    // Final check: if still no question, append a simple one
                    if (!responseText.includes('?')) {
                        const simpleFollowUp = language === 'it'
                            ? ` Puoi dirmi di più su questo aspetto?`
                            : ` Can you tell me more about this?`;
                        responseText = responseText.replace(/[.!]+$/, '') + simpleFollowUp;
                    }

                    // Clean any remaining closure markers
                    responseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();

                } catch (e) {
                    console.error('Additive fix failed:', e);
                    // Fallback: just append a question
                    const fallbackQuestion = language === 'it'
                        ? ` Puoi approfondire questo punto?`
                        : ` Can you elaborate on this?`;
                    responseText = responseText
                        .replace(/INTERVIEW_COMPLETED/gi, '')
                        .replace(/[.!]+$/, '') + fallbackQuestion;
                }
            }
        }

        // DEEP_OFFER safety: must be an extension-consent question
        if (nextState.phase === 'DEEP_OFFER') {
            const invalidDeepOffer =
                !responseText.includes('?') ||
                goodbyePattern.test(responseText) ||
                /INTERVIEW_COMPLETED/i.test(responseText);
            if (invalidDeepOffer) {
                flowTelemetry.deepOfferClosureIntercepted = true;
                console.log(`🛡️ [SAFETY_NET] Invalid DEEP_OFFER response, fixing...`);

                // Simple additive fix for DEEP_OFFER
                let offerQuestion = language === 'it'
                    ? `Ti ringrazio per le risposte finora. Ti va di estendere l'intervista di qualche minuto per continuare?`
                    : `Thanks for your answers so far. Would you like to extend the interview by a few minutes to continue?`;
                try {
                    offerQuestion = await generateDeepOfferOnly({ model, language });
                } catch (e) {
                    console.error('DEEP_OFFER fallback generation failed, using static fallback:', e);
                }

                // Try to keep acknowledgment if present, otherwise use default
                const cleanedResponse = responseText
                    .replace(/INTERVIEW_COMPLETED/gi, '')
                    .replace(goodbyePattern, '')
                    .trim();

                if (cleanedResponse.length > 10 && !cleanedResponse.includes('?')) {
                    responseText = cleanedResponse.replace(/[.!]+$/, '') + ` ${language === 'it' ? `Ti va di estendere l'intervista di qualche minuto?` : `Would you like to extend the interview by a few minutes?`}`;
                } else {
                    responseText = offerQuestion;
                }
            }
        }

        // Final fail-safe for DATA_COLLECTION:
        // keep phase-consistent behavior even when previous regenerations drift.
        if (nextState.phase === 'DATA_COLLECTION' && !nextState.dataCollectionRefused && supervisorInsight?.status !== 'COMPLETE_WITHOUT_DATA') {
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const freshConvForDataGuard = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfileForDataGuard = (freshConvForDataGuard?.candidateProfile as any) || {};
            const missingFieldForDataGuard = getNextMissingCandidateField(
                candidateFieldIds,
                currentProfileForDataGuard,
                nextState.fieldAttemptCounts,
                3
            );

            const needsConsentQuestion = nextState.forceConsentQuestion === true || nextState.consentGiven === false;
            const hasQuestionNow = responseText.includes('?');
            const hasCompletionTagNow = /INTERVIEW_COMPLETED/i.test(responseText);
            const hasGoodbyeNow = goodbyePattern.test(responseText);

            if (needsConsentQuestion) {
                const consentCuePattern = language === 'it'
                    ? /\b(posso|permesso|consenso|contatt|restare in contatto)\b/i
                    : /\b(may i|permission|consent|contact|stay in touch)\b/i;
                const invalidConsentResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !consentCuePattern.test(responseText);
                if (invalidConsentResponse) {
                    console.log('🛡️ [FINAL_GUARD] DATA_COLLECTION consent response invalid. Forcing consent question.');
                    try {
                        responseText = await generateConsentQuestionOnly({ model, language });
                    } catch (e) {
                        console.error('Consent question fallback failed:', e);
                        responseText = normalizeSingleQuestion(String(responseText || '').replace(/INTERVIEW_COMPLETED/gi, '').trim());
                    }
                }
                nextState.forceConsentQuestion = false;
            } else if (nextState.consentGiven === true && missingFieldForDataGuard) {
                const fieldMentioned = responseMentionsCandidateField(responseText, missingFieldForDataGuard);
                const invalidFieldResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !fieldMentioned;
                if (invalidFieldResponse) {
                    console.log(`🛡️ [FINAL_GUARD] DATA_COLLECTION field response invalid for "${missingFieldForDataGuard}". Forcing field question.`);
                    const fieldLabel = getFieldLabel(missingFieldForDataGuard, language);
                    try {
                        responseText = await generateFieldQuestionOnly({
                            model,
                            language,
                            fieldLabel
                        });
                    } catch (e) {
                        console.error('Field question fallback failed:', e);
                        responseText = normalizeSingleQuestion(String(responseText || '').replace(/INTERVIEW_COMPLETED/gi, '').trim());
                    }
                }
            } else if (nextState.consentGiven === true && !missingFieldForDataGuard && !hasCompletionTagNow) {
                console.log('🛡️ [FINAL_GUARD] DATA_COLLECTION complete but missing completion tag. Forcing final goodbye.');
                try {
                    const retry = await generateObject({
                        model,
                        schema,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append "INTERVIEW_COMPLETED". Do NOT ask any questions.`,
                        temperature: 0.2
                    });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Final goodbye fallback failed:', e);
                }
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    const noQuestionTail = String(responseText || '').replace(/[?]+$/g, '').trim();
                    responseText = `${noQuestionTail} INTERVIEW_COMPLETED`.trim();
                }
            }
        }

        const buildAssistantMetadata = (isCompletion: boolean = false): Prisma.InputJsonObject => {
            return {
                ...(clientMessageId ? { replyToClientMessageId: clientMessageId } : {}),
                phase: nextState.phase,
                supervisorStatus: supervisorInsight?.status ?? null,
                reasoning: result?.object?.meta_comment ?? null,
                topicLabel: targetTopic?.label || currentTopic.label,
                topicId: targetTopic?.id || currentTopic.id,
                quality: qualityTelemetry as unknown as Prisma.InputJsonValue,
                flowFlags: flowTelemetry as unknown as Prisma.InputJsonValue,
                responseLatencyMs: Date.now() - startTime,
                simulationMode,
                ...(isCompletion ? { isCompletion: true } : {})
            };
        };

        // Check for completion tag - only valid if we're actually done
        if (/INTERVIEW_COMPLETED/i.test(responseText)) {
            // Verify we're actually done - MUST re-read from DB for fresh data
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const freshConvForCompletion = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfileForCompletion = (freshConvForCompletion?.candidateProfile as any) || {};
            // A field is considered "done" if: collected, skipped, or asked too many times
            const MAX_FIELD_ATTEMPTS_COMPLETION = 3;
            const missingFieldForCompletion = getNextMissingCandidateField(
                candidateFieldIds,
                currentProfileForCompletion,
                nextState.fieldAttemptCounts,
                MAX_FIELD_ATTEMPTS_COMPLETION
            );
            const completionGuardAction = getCompletionGuardAction({
                shouldCollectData,
                candidateFieldIds,
                consentGiven: nextState.consentGiven,
                dataCollectionRefused: nextState.dataCollectionRefused,
                missingField: missingFieldForCompletion
            });

            if (completionGuardAction === 'ask_consent') {
                flowTelemetry.completionGuardIntercepted = true;
                flowTelemetry.completionBlockedForConsent = true;
                // Guardrail: never allow completion before an explicit contact-consent step.
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED before consent resolution. OVERRIDING with consent question.`);
                const enforcedSystem = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                try {
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Consent regeneration after completion failed:', e);
                }
            } else if (completionGuardAction === 'ask_missing_field' && missingFieldForCompletion) {
                flowTelemetry.completionGuardIntercepted = true;
                flowTelemetry.completionBlockedForMissingField = true;
                // Guardrail: consent granted but fields still missing -> ask the specific field, not completion.
                const fieldLabel = getFieldLabel(missingFieldForCompletion, language);
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED but "${missingFieldForCompletion}" is still missing. OVERRIDING with field question.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT conclude. Ask ONLY for ${fieldLabel}. One question only.`;
                try {
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Field regeneration after premature completion failed:', e);
                }
            } else {
                // Actually complete
                await completeInterview(
                    conversationId,
                    canonicalMessages,
                    openAIKey,
                    currentProfileForCompletion || {},
                    { simulationMode }
                );
                const finalResponseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();
                await prisma.message.create({
                    data: {
                        conversationId,
                        role: 'assistant',
                        content: finalResponseText,
                        metadata: buildAssistantMetadata(true)
                    }
                });
                return Response.json({
                    text: finalResponseText,
                    currentTopicId: nextTopicId,
                    isCompleted: true
                });
            }
        }

        // ====================================================================
        // 6. SAVE & UPDATE STATE (parallelized for speed)
        // ====================================================================
        // Run save operations in parallel - they're independent
        await Promise.all([
            // Save assistant message
            prisma.message.create({
                data: {
                    conversationId,
                    role: 'assistant',
                    content: responseText,
                    metadata: buildAssistantMetadata(false)
                }
            }),
            // Update conversation state (metadata + topic in one query)
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: nextState as any,
                    currentTopicId: nextTopicId
                }
            })
        ]);

        const totalTime = Date.now() - startTime;
        console.log(`✅ [CHAT_API] Finished. Response sent. Next Phase: ${nextState.phase}`);
        console.log(`⏱️ [TIMING] TOTAL REQUEST: ${totalTime}ms`);

        // Memory update (fire and forget - don't block response)
        if (lastMessage?.role === 'user') {
            MemoryManager.updateAfterUserResponse(
                conversationId,
                lastMessage.content,
                currentTopic.id,
                currentTopic.label,
                openAIKey
            ).catch(err => console.error("Memory update failed", err));
        }

        return Response.json({
            text: responseText,
            currentTopicId: nextTopicId,
            isCompleted: false
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

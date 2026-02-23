
import { ChatService } from '@/services/chat-service';
import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { LLMService, type InterviewRuntimeModels } from '@/services/llmService';
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
// NOTE: v2 post-processing moved to post-processing-v2.ts - quality gates removed
import { extractDeterministicFieldValue, isLikelyNonValueAck, normalizeCandidateFieldIds, responseMentionsCandidateField } from '@/lib/interview/data-collection-guard';
import { createDeepOfferInsight, createDefaultSupervisorInsight, runDeepOfferPhase, type InterviewStateLike, type Phase, type SupervisorInsight, type TransitionMode } from '@/lib/interview/interview-supervisor';
import { findDuplicateQuestionMatch } from '@/lib/interview/question-dedup';
import { handleExplorePhase, handleDeepenPhase } from '@/lib/interview/explore-deepen-machine';
import { computeSignalScore } from '@/lib/interview/signal-score';
import { buildTurnGuidanceBlock, buildGuardsBlock } from '@/lib/llm/runtime-prompt-blocks';
import { runPostProcessing } from '@/lib/interview/post-processing-v2';
import {
    buildManualKnowledgePromptBlock,
    buildRuntimeInterviewKnowledgeSignature,
    buildRuntimeKnowledgePromptBlock,
    extractManualInterviewGuideSource,
    generateRuntimeInterviewKnowledge,
    isRuntimeInterviewKnowledgeValid,
    type RuntimeInterviewKnowledge
} from '@/lib/interview/runtime-knowledge';
import {
    buildMicroPlannerDecision,
    buildMicroPlannerPromptBlock
} from '@/lib/interview/micro-planner';

export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
    SAFETY_MAX_ASSISTANT_TURNS: 120,
    SAFETY_MAX_TOTAL_MESSAGES: 260,
};
const ENABLE_SOFT_QUALITY_GUARDS = false;
const ENABLE_NON_HARD_SAFETY_REGENERATIONS = false;
type InterviewAbVariant = 'control' | 'treatment';

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
interface InterestingTopic {
    topicId: string;
    topicLabel: string;
    engagementScore: number;  // 0-1 based on response length
    bestSnippet?: string;
}

interface TopicBudget {
    baseTurns: number;
    minTurns: number;
    maxTurns: number;
    turnsUsed: number;
    bonusTurnsGranted: number;
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

    // v2: Elastic turn budget tracking
    topicBudgets: Record<string, TopicBudget>;
    turnsUsedTotal: number;
    turnsBudgetTotal: number;
    uncoveredTopics: string[];  // Topic IDs with remaining subgoals
    topicEngagementScores: Record<string, number>;  // Signal scores per topic
    topicKeyInsights: Record<string, string>;  // Best snippet per topic
    lastSignalScore: number;  // Last computed signal score (0-1)

    // Legacy DEEP fields (being phased out)
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
    runtimeInterviewKnowledge?: RuntimeInterviewKnowledge | null;
    runtimeInterviewKnowledgeSignature?: string | null;
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
    questionDedupIntercepted: boolean;
}

interface LLMUsagePayload {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
}

type LLMUsageCollector = (payload: {
    source: string;
    model?: string | null;
    usage?: LLMUsagePayload | null;
}) => void;

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

function shouldUseCriticalModelForTopicTurn(params: {
    phase: Phase;
    supervisorStatus?: string;
    userTurnSignal: 'none' | 'clarification' | 'off_topic_question';
    userMessage?: string | null;
    language: string;
}): { useCritical: boolean; reason: string } {
    if (params.phase !== 'SCAN' && params.phase !== 'DEEP') {
        return { useCritical: false, reason: 'not_topic_phase' };
    }

    if (params.userTurnSignal === 'clarification') {
        return { useCritical: true, reason: 'clarification_turn' };
    }
    if (params.userTurnSignal === 'off_topic_question') {
        return { useCritical: true, reason: 'scope_recovery_turn' };
    }

    const supervisorStatus = String(params.supervisorStatus || '');
    if (supervisorStatus === 'TRANSITION' || supervisorStatus === 'START_DEEP' || supervisorStatus === 'START_DEEP_BRIEF') {
        return { useCritical: true, reason: 'topic_transition_turn' };
    }

    const userMessage = String(params.userMessage || '').trim();
    const userWords = userMessage.split(/\s+/).filter(Boolean).length;
    const signalScore = userMessage ? computeEngagementScore(userMessage, params.language) : 0;
    const highSignalAnswer = userWords >= 35 || signalScore >= 0.28;
    if (supervisorStatus === 'DEEPENING' && highSignalAnswer) {
        return { useCritical: true, reason: 'high_signal_deepening' };
    }

    return { useCritical: false, reason: 'standard_turn' };
}

const ITALIAN_STOPWORDS = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
    'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
    'e', 'o', 'ma', 'se', 'che', 'non', 'piu', 'più',
    'del', 'dello', 'della', 'dei', 'degli', 'delle',
    'al', 'allo', 'alla', 'ai', 'agli', 'alle',
    'nel', 'nello', 'nella', 'nei', 'negli', 'nelle'
]);
const ENGLISH_STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
    'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'this', 'that', 'these', 'those', 'it', 'its', 'their', 'them'
]);

function tokenizeForScoring(text: string, language: string): Set<string> {
    const source = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

    const stopwords = language === 'it' ? ITALIAN_STOPWORDS : ENGLISH_STOPWORDS;
    const tokens = source.filter(t => t.length >= 3 && !stopwords.has(t));
    return new Set(tokens);
}

function lexicalOverlapScore(aText: string, bText: string, language: string): number {
    const a = tokenizeForScoring(aText, language);
    const b = tokenizeForScoring(bText, language);
    if (!a.size || !b.size) return 0;

    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) intersection++;
    }
    return intersection / Math.max(1, Math.min(a.size, b.size));
}

function buildTopicSemanticText(topic: any): string {
    const subGoals = Array.isArray(topic?.subGoals) ? topic.subGoals.join(' ') : '';
    return `${topic?.label || ''} ${subGoals}`.trim();
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
    history?: Record<string, string[]>,
    interviewObjective?: string,
    language: string = 'en'
): string[] {
    const scored = botTopics.map((t, idx) => {
        const match = (interestingTopics || []).find(it => it.topicId === t.id);
        const remainingSubGoals = getRemainingSubGoals(t, history).length;
        const totalSubGoals = Math.max(1, Array.isArray(t?.subGoals) ? t.subGoals.length : 1);
        const uncoveredRatio = Math.max(0, Math.min(1, remainingSubGoals / totalSubGoals));
        const topicText = buildTopicSemanticText(t);
        const snippetText = match?.bestSnippet || '';
        const interestScore = match?.engagementScore ?? 0;
        const snippetAlignment = snippetText
            ? lexicalOverlapScore(topicText, snippetText, language)
            : 0;
        const objectiveAlignment = interviewObjective
            ? lexicalOverlapScore(topicText, interviewObjective, language)
            : 0;
        // Naturalness-first weighting:
        // 1) what remains uncovered, 2) what sounded interesting, 3) what aligns with interview objective.
        const priorityScore = (
            uncoveredRatio * 0.4 +
            interestScore * 0.25 +
            snippetAlignment * 0.15 +
            objectiveAlignment * 0.2
        );

        return {
            id: t.id,
            score: priorityScore,
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
    remainingSec?: number,
    interviewObjective?: string,
    language: string = 'en'
) {
    const topicsWithRemaining = botTopics.filter(t => getRemainingSubGoals(t, history).length > 0);
    if (topicsWithRemaining.length > 0) {
        const ordered = buildDeepTopicOrder(
            botTopics,
            interestingTopics,
            history,
            interviewObjective,
            language
        ).filter(id =>
            topicsWithRemaining.some(t => t.id === id)
        );
        const deepTurnsByTopic: Record<string, number> = {};

        // Naturalness-first allocation:
        // - guarantee at least 1 turn per remaining topic
        // - then add extra turns in priority order, capped by uncovered sub-goals and plan max.
        const availableTurnsRaw = typeof remainingSec === 'number'
            ? Math.floor(Math.max(0, remainingSec) / 45)
            : ordered.length * (plan.deep.maxTurnsPerTopic || 2);
        const availableTurns = Math.max(ordered.length, availableTurnsRaw);

        for (const topicId of ordered) {
            deepTurnsByTopic[topicId] = 1;
        }

        const maxTurnsByTopic: Record<string, number> = {};
        for (const topicId of ordered) {
            const topic = botTopics.find(t => t.id === topicId);
            if (!topic) continue;
            const remainingSubGoals = getRemainingSubGoals(topic, history).length;
            const planMax = getDeepPlanTurns(plan, topicId);
            maxTurnsByTopic[topicId] = Math.max(1, Math.min(planMax, remainingSubGoals));
        }

        let remainingBudget = Math.max(0, availableTurns - ordered.length);
        while (remainingBudget > 0) {
            let allocatedInRound = false;
            for (const topicId of ordered) {
                if (remainingBudget <= 0) break;
                const current = deepTurnsByTopic[topicId] || 1;
                const maxForTopic = maxTurnsByTopic[topicId] || 1;
                if (current < maxForTopic) {
                    deepTurnsByTopic[topicId] = current + 1;
                    remainingBudget -= 1;
                    allocatedInRound = true;
                }
            }
            if (!allocatedInRound) break;
        }
        return { deepTopicOrder: ordered, deepTurnsByTopic };
    }

    const fallbackCount = Math.max(1, plan.deep.fallbackTurns || 2);
    const ordered = buildDeepTopicOrder(
        botTopics,
        interestingTopics,
        history,
        interviewObjective,
        language
    ).slice(0, fallbackCount);
    const deepTurnsByTopic: Record<string, number> = {};
    ordered.forEach(id => {
        deepTurnsByTopic[id] = 1;
    });
    return { deepTopicOrder: ordered, deepTurnsByTopic };
}

function selectDeepFocusPoint(params: {
    topic: any;
    availableSubGoals: string[];
    engagingSnippet?: string;
    interviewObjective?: string;
    lastUserMessage?: string;
    language: string;
}): string {
    const { topic, availableSubGoals, engagingSnippet, interviewObjective, lastUserMessage, language } = params;
    if (!availableSubGoals || availableSubGoals.length === 0) {
        return topic?.label || '';
    }

    const contextText = [engagingSnippet || '', lastUserMessage || '']
        .filter(Boolean)
        .join(' ')
        .trim();
    const objectiveText = String(interviewObjective || '').trim();

    let bestSubGoal = availableSubGoals[0];
    let bestScore = -1;

    for (const subGoal of availableSubGoals) {
        const objectiveScore = objectiveText
            ? lexicalOverlapScore(subGoal, objectiveText, language)
            : 0;
        const contextScore = contextText
            ? lexicalOverlapScore(subGoal, contextText, language)
            : 0;
        const score = objectiveScore * 0.6 + contextScore * 0.4;

        if (score > bestScore) {
            bestScore = score;
            bestSubGoal = subGoal;
        }
    }

    return bestSubGoal;
}

function buildExtensionPreviewHints(params: {
    botTopics: any[];
    deepOrder?: string[];
    history?: Record<string, string[]>;
    interestingTopics?: InterestingTopic[];
    interviewObjective?: string;
    language: string;
    startIndex?: number;
    maxItems?: number;
}): string[] {
    const {
        botTopics,
        deepOrder,
        history,
        interestingTopics,
        interviewObjective,
        language,
        startIndex = 0,
        maxItems = 2
    } = params;

    const deepTopics = getDeepTopics(botTopics, deepOrder);
    const baseTopics = deepTopics.length > 0 ? deepTopics : botTopics;
    if (!baseTopics.length) return [];

    const safeStart = Math.max(0, Math.min(startIndex, Math.max(0, baseTopics.length - 1)));
    const rotatedTopics = [
        ...baseTopics.slice(safeStart),
        ...baseTopics.slice(0, safeStart)
    ];

    const preview: string[] = [];
    for (const topic of rotatedTopics) {
        const availableSubGoals = getRemainingSubGoals(topic, history);
        if (availableSubGoals.length === 0) continue;

        const engagingSnippet = (interestingTopics || []).find(
            (it: InterestingTopic) => it.topicId === topic.id
        )?.bestSnippet || '';

        const focusPoint = selectDeepFocusPoint({
            topic,
            availableSubGoals,
            engagingSnippet,
            interviewObjective,
            lastUserMessage: '',
            language
        });

        const compactFocus = sanitizeUserSnippet(focusPoint, 10) || focusPoint;
        preview.push(compactFocus || topic.label);
        if (preview.length >= maxItems) break;
    }

    if (preview.length > 0) return preview;
    return rotatedTopics.slice(0, maxItems).map(t => t.label).filter(Boolean);
}

// ============================================================================
// HELPER: Extract field from user message
// ============================================================================
async function extractFieldFromMessage(
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

// ============================================================================
// HELPER: Check user intent (consent/refusal/neutral)
// ============================================================================
async function checkUserIntent(
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

    // Fast-path deterministic intent for extension consent to avoid accidental accepts
    // on unrelated content replies.
    if (context === 'deep_offer') {
        if (isClarificationSignal(userMessage, language)) return 'NEUTRAL';

        const refuseSet = new Set([
            'no',
            'no grazie',
            'direi di no',
            'anche no',
            'non ora',
            'meglio di no',
            'preferisco di no',
            'stop',
            'basta'
        ]);
        const acceptSet = new Set([
            'si',
            'sì',
            'yes',
            'ok',
            'va bene',
            'certo',
            'volontieri',
            'continuiamo',
            'proseguiamo',
            'andiamo avanti'
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

// ============================================================================
// HELPER: Detect explicit user intent to conclude the interview now
// ============================================================================
async function detectExplicitClosureIntent(
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

async function generateQuestionOnly(params: {
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

async function generateDeepOfferOnly(params: {
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

async function enforceDeepOfferQuestion(params: {
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
            : `Grazie per il tempo e per i contributi condivisi fin qui. Il tempo previsto per l'intervista sarebbe terminato: se vuoi, possiamo continuare con qualche domanda in piu su uno dei punti piu utili emersi. Ti va di proseguire ancora per qualche minuto?`)
        : (hintText
            ? `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions, starting from one point that emerged, for example ${hintText}. Would you like to continue for a few more minutes?`
            : `Thank you for your time and the insights shared so far. The planned interview time would now be over: if you want, we can continue with a few extra questions on one useful point that emerged. Would you like to continue for a few more minutes?`);
}

function isExtensionOfferQuestion(message: string, language: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text || !text.includes('?')) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(ti va di continuare|vuoi continuare|qualche minuto in più|hai ancora qualche minuto|hai disponibilità|estendere(?:\s+l')?\s*intervista|proseguire|ulteriore(?:i)? domanda(?:e)? di approfondimento)\b/i;
    const enPattern = /\b(would you like to continue|do you want to continue|few more minutes|are you available|extend the interview|continue for a few more minutes|follow-up questions|deep-dive questions)\b/i;
    return isItalian ? itPattern.test(text) : enPattern.test(text);
}

async function generateConsentQuestionOnly(params: {
    model: any;
    language: string;
    onUsage?: LLMUsageCollector;
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
    params.onUsage?.({
        source: 'generate_consent_question_only',
        model: (params.model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    return normalizeSingleQuestion(String(result.object.question || '').trim());
}

async function generateFieldQuestionOnly(params: {
    model: any;
    language: string;
    fieldLabel: string;
    onUsage?: LLMUsageCollector;
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
    params.onUsage?.({
        source: 'generate_field_question_only',
        model: (params.model as any)?.modelId || null,
        usage: (result as any)?.usage
    });

    return normalizeSingleQuestion(String(result.object.question || '').trim());
}

function sanitizeUserSnippet(input: string, maxWords: number = 10): string {
    const compact = (input || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const withoutPunctuation = compact.replace(/[?!.,;:()[\]{}"“”'’`]/g, '').trim();
    return withoutPunctuation.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

function extractLastAssistantQuestion(input?: string | null): string {
    const text = String(input || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || !text.includes('?')) return '';

    const pieces = text
        .split('?')
        .map(chunk => chunk.trim())
        .filter(Boolean);
    if (pieces.length === 0) return '';
    return `${pieces[pieces.length - 1]}?`;
}

function getUserResponseDepth(input?: string | null): 'brief' | 'balanced' | 'rich' {
    const words = String(input || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    if (words <= 10) return 'brief';
    if (words >= 35) return 'rich';
    return 'balanced';
}

function buildUserBridgeHint(input: string, language: string): string {
    const signal = sanitizeUserSnippet(input, 14);
    if (!signal) return '';
    return language === 'it'
        ? `Apri collegandoti semanticamente al punto utente su "${signal}" senza citazione letterale.`
        : `Open by semantically linking to the user point about "${signal}" without literal quoting.`;
}

function buildRuntimeSemanticContextPrompt(params: {
    language: string;
    phase: Phase;
    targetTopicLabel: string;
    supervisorInsight?: SupervisorInsight;
    lastUserMessage?: string | null;
    previousAssistantMessage?: string | null;
    recentBridgeStems?: string[];
}): string {
    const lastUserMessage = String(params.lastUserMessage || '').trim();
    if (!lastUserMessage) return '';

    const language = params.language || 'en';
    const userSignal = sanitizeUserSnippet(lastUserMessage, 18);
    const previousQuestion = extractLastAssistantQuestion(params.previousAssistantMessage);
    const responseDepth = getUserResponseDepth(lastUserMessage);
    const transitionMode: TransitionMode | undefined = params.supervisorInsight?.transitionMode;
    const phase = params.phase;
    const clarificationRequested = isClarificationSignal(lastUserMessage, language);

    const depthHintIt: Record<'brief' | 'balanced' | 'rich', string> = {
        brief: 'Risposta breve: usa una domanda semplice e concreta, con un solo focus.',
        balanced: 'Risposta equilibrata: approfondisci un dettaglio specifico emerso ora.',
        rich: 'Risposta ricca: seleziona un solo elemento ad alto valore e approfondiscilo.'
    };
    const depthHintEn: Record<'brief' | 'balanced' | 'rich', string> = {
        brief: 'Short answer: use one simple, concrete follow-up with a single focus.',
        balanced: 'Balanced answer: deepen one specific detail that just emerged.',
        rich: 'Rich answer: pick one high-value element and probe that only.'
    };

    const transitionHintIt = transitionMode === 'bridge'
        ? 'Transizione: usa un ponte naturale dal punto utente al nuovo focus.'
        : transitionMode === 'clean_pivot'
            ? 'Transizione: pivot pulito con aggancio neutro, senza forzare dettagli non pertinenti.'
            : 'Transizione: mantieni continuità naturale col turno precedente.';
    const transitionHintEn = transitionMode === 'bridge'
        ? 'Transition: use a natural bridge from the user point into the new focus.'
        : transitionMode === 'clean_pivot'
            ? 'Transition: use a clean pivot with a neutral bridge, no forced irrelevant details.'
            : 'Transition: keep natural continuity from the previous turn.';

    const recentStems = (params.recentBridgeStems || []).slice(0, 5);
    const stemsHintIt = recentStems.length > 0
        ? `8. NON iniziare con nessuna di queste aperture già usate di recente: ${recentStems.map(s => `"${s}"`).join(', ')}. Usa un incipit diverso e naturale.`
        : '8. Varia l\'incipit: non usare la stessa apertura del turno precedente.';
    const stemsHintEn = recentStems.length > 0
        ? `8. Do NOT start with any of these recently used openings: ${recentStems.map(s => `"${s}"`).join(', ')}. Use a different, natural opening.`
        : '8. Vary your opening: do not reuse the same opening as the previous turn.';

    if ((language || '').toLowerCase().startsWith('it')) {
        return `
## RUNTIME SEMANTIC CONTEXT
- Fase attiva: ${phase}
- Topic target: "${params.targetTopicLabel}"
- Segnale utente da valorizzare (parafrasi, non citazione): "${userSignal || 'N/A'}"
- Ultima domanda assistente da NON ripetere: "${previousQuestion || 'N/A'}"
- Profondità risposta utente: ${responseDepth}

Istruzioni di coerenza:
1. Inizia con una frase breve che riconosce genuinamente il contenuto della risposta utente (non una formula).
2. Mantieni la nuova domanda semanticamente diversa dalla precedente.
3. ${depthHintIt[responseDepth]}
4. ${transitionHintIt}
5. Evita formule rigide ("ora passiamo a", "cambio argomento") e chiusure premature.
6. Evita aperture generiche/retoriche ("molto interessante", "e un punto importante", "grazie per aver condiviso"): reagisci al merito con un dettaglio concreto.
7. Se naturale, preferisci una lente diagnostica (esempio, impatto, priorita o azione) con un vincolo leggero (tempo, segmento, canale o metrica). Se risulta forzato o fuori tema, resta su una domanda semplice.
${stemsHintIt}
${clarificationRequested
                ? '9. L\'utente sta chiedendo un chiarimento/disambiguazione: chiarisci prima in modo diretto la domanda precedente e poi fai una sola domanda di follow-up coerente.'
                : ''}
`.trim();
    }

    return `
## RUNTIME SEMANTIC CONTEXT
- Active phase: ${phase}
- Target topic: "${params.targetTopicLabel}"
- User signal to leverage (paraphrase, no literal quote): "${userSignal || 'N/A'}"
- Previous assistant question to avoid repeating: "${previousQuestion || 'N/A'}"
- User response depth: ${responseDepth}

Coherence instructions:
1. Open with one short sentence that genuinely acknowledges the content of the user's response (not a formula).
2. Keep the new question semantically distinct from the previous one.
3. ${depthHintEn[responseDepth]}
4. ${transitionHintEn}
5. Avoid rigid templates ("now let's move to") and premature closure cues.
6. Avoid generic/ceremonial openers ("very interesting", "that's an important point", "thanks for sharing"): respond to the substance using one concrete detail.
7. If natural, prefer a diagnostic lens (example, impact, priority, or action) with one light constraint (timeframe, segment, channel, or metric). If this feels forced or off-topic, keep a simple focused question.
${stemsHintEn}
${clarificationRequested
            ? '9. The user is asking for clarification/disambiguation: first clarify your previous question directly, then ask one coherent follow-up question.'
            : ''}
`.trim();
}

function buildSoftDiagnosticHint(params: {
    language: string;
    lastUserMessage?: string | null;
    topicLabel?: string | null;
    subGoal?: string | null;
}): string {
    const language = String(params.language || 'en');
    const isItalian = language.toLowerCase().startsWith('it');
    const userText = String(params.lastUserMessage || '').trim();
    const words = userText.split(/\s+/).filter(Boolean).length;
    if (!userText || words < 5) return '';
    if (isClarificationSignal(userText, language)) return '';

    const lower = userText.toLowerCase();
    const hasNegativeSignal = /(problema|critic|risch|limite|debolezz|poco|scarso|difficolt|non )/i.test(lower);
    const hasPrioritySignal = /(priorit|prima|subito|urgent|urgente|piu importante|più importante)/i.test(lower);
    const hasImpactSignal = /(impatto|effetto|risultato|crescita|calo|mercato|client|kpi|vendite|margine|tempo|costo)/i.test(lower);

    let lens: 'example' | 'impact' | 'priority' | 'action' = 'example';
    if (hasPrioritySignal || words >= 35) {
        lens = 'priority';
    } else if (hasNegativeSignal) {
        lens = 'action';
    } else if (hasImpactSignal || words >= 14) {
        lens = 'impact';
    }

    if (isItalian) {
        const lensLabel = lens === 'priority'
            ? 'priorita'
            : lens === 'action'
                ? 'azione'
                : lens === 'impact'
                    ? 'impatto'
                    : 'esempio';
        return `Suggerimento soft: se coerente con il topic, prova una domanda diagnostica sul piano "${lensLabel}" con un vincolo leggero (tempo, segmento, canale o metrica). Se rischia di essere forzata, ignora questo suggerimento.`;
    }

    const lensLabel = lens === 'priority'
        ? 'priority'
        : lens === 'action'
            ? 'action'
            : lens === 'impact'
                ? 'impact'
                : 'example';
    return `Soft suggestion: if coherent with the topic, use a diagnostic "${lensLabel}" follow-up with one light constraint (timeframe, segment, channel, or metric). If this feels forced, ignore this suggestion.`;
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

const GENERIC_BRIDGE_OPENERS_IT = [
    /^capisco\b/i,
    /^chiaro\b/i,
    /^perfetto\b/i,
    /^ottimo\b/i,
    /^bene\b/i,
    /^grazie\b/i,
    /^molto interessante\b/i,
    /^e un punto importante\b/i,
    /^è un punto importante\b/i,
    /^quello che dici\b/i
];

const GENERIC_BRIDGE_OPENERS_EN = [
    /^i see\b/i,
    /^got it\b/i,
    /^perfect\b/i,
    /^great\b/i,
    /^thanks\b/i,
    /^very interesting\b/i,
    /^that'?s an important point\b/i
];

function normalizeBridgeStem(text: string): string {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractBridgeStem(text: string): string {
    const compact = String(text || '').trim();
    if (!compact) return '';
    const firstSentence = compact.split(/[?!\.]/)[0] || compact;
    return normalizeBridgeStem(firstSentence.split(',')[0]);
}

function collectRecentBridgeStems(
    messages: Array<{ role: string; content: string }>,
    limit: number = 14
): string[] {
    const assistantMessages = messages
        .filter((m) => m.role === 'assistant')
        .slice(-Math.max(limit * 2, limit));
    const seen = new Set<string>();
    const stems: string[] = [];
    for (let i = assistantMessages.length - 1; i >= 0; i -= 1) {
        const normalizedStem = normalizeBridgeStem(extractBridgeStem(assistantMessages[i].content));
        if (!normalizedStem || seen.has(normalizedStem)) continue;
        seen.add(normalizedStem);
        stems.push(normalizedStem);
        if (stems.length >= limit) break;
    }
    return stems;
}

function startsWithGenericBridgeOpener(text: string, language: string): boolean {
    const firstSentence = String(text || '').trim().split(/[?!\.]/)[0] || '';
    const patterns = String(language || 'en').toLowerCase().startsWith('it')
        ? GENERIC_BRIDGE_OPENERS_IT
        : GENERIC_BRIDGE_OPENERS_EN;
    return patterns.some((pattern) => pattern.test(firstSentence.trim()));
}

function isClarificationSignal(input: string, language: string): boolean {
    const text = String(input || '').trim().toLowerCase();
    if (!text) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const genericPattern = /^(boh|eh|mh|hmm|\?+|ok\??)$/i;
    if (genericPattern.test(text)) return true;
    const words = text.split(/\s+/).filter(Boolean);
    const shortEitherOrQuestion = text.includes('?') && words.length <= 12 && (/\bo\b/.test(text) || /\bor\b/.test(text));
    const itPattern = /\b(non capisco|non ho capito|non mi [eè] chiaro|puoi chiarire|puoi spiegare meglio|cosa intendi|intendi dire|ti riferisci|in che senso|parli di|quale dei due)\b/i;
    const enPattern = /\b(i don't understand|i do not understand|not clear|can you clarify|can you explain|what do you mean|do you mean|are you referring to|which one)\b/i;
    if (isItalian ? itPattern.test(text) : enPattern.test(text)) return true;
    return shortEitherOrQuestion;
}

type UserTurnSignal = 'none' | 'clarification' | 'off_topic_question';

function isLikelyUserQuestion(input: string, language: string): boolean {
    const text = String(input || '').trim().toLowerCase();
    if (!text) return false;
    if (text.includes('?')) return true;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itQuestionStarters = /^(come|cosa|perch[eé]|quando|dove|chi|quale|quali|quanto|in che modo|mi spieghi|puoi spiegare)/i;
    const enQuestionStarters = /^(how|what|why|when|where|who|which|can you|could you|would you|please explain)/i;
    return isItalian ? itQuestionStarters.test(text) : enQuestionStarters.test(text);
}

function hasAnyAnchorOverlap(source: string[], target: string[]): boolean {
    if (!source.length || !target.length) return false;
    const targetSet = new Set(target);
    return source.some((root) => targetSet.has(root));
}

function detectUserTurnSignal(params: {
    userMessage?: string | null;
    language: string;
    phase: Phase;
    currentTopic: any;
    targetTopic: any;
    interviewObjective?: string;
}): UserTurnSignal {
    const userMessage = String(params.userMessage || '').trim();
    if (!userMessage) return 'none';
    if (params.phase !== 'SCAN' && params.phase !== 'DEEP') return 'none';

    if (isClarificationSignal(userMessage, params.language)) {
        return 'clarification';
    }

    if (!isLikelyUserQuestion(userMessage, params.language)) {
        return 'none';
    }

    const language = params.language || 'en';
    const isItalian = language.toLowerCase().startsWith('it');
    const userAnchorRoots = buildMessageAnchors(userMessage, language).anchorRoots;
    const currentAnchorRoots = buildTopicAnchors(params.currentTopic, language).anchorRoots;
    const targetAnchorRoots = buildTopicAnchors(params.targetTopic, language).anchorRoots;
    const objectiveAnchorRoots = buildMessageAnchors(String(params.interviewObjective || ''), language).anchorRoots;

    const overlapsTopic =
        hasAnyAnchorOverlap(userAnchorRoots, currentAnchorRoots) ||
        hasAnyAnchorOverlap(userAnchorRoots, targetAnchorRoots) ||
        hasAnyAnchorOverlap(userAnchorRoots, objectiveAnchorRoots);

    if (overlapsTopic) return 'none';

    const explicitOffTopicPattern = isItalian
        ? /\b(che ore|che tempo|meteo|oroscopo|barzelletta|storia divertente|chi sei|come stai|quanti anni hai|dove vivi|che modello usi|chatgpt|openai|calcio|sport|borsa|bitcoin|criptovalute|ricetta)\b/i
        : /\b(what time|weather|horoscope|joke|funny story|who are you|how are you|how old are you|where do you live|what model do you use|chatgpt|openai|football|soccer|sports|stock market|bitcoin|crypto|recipe)\b/i;
    if (explicitOffTopicPattern.test(userMessage)) return 'off_topic_question';

    const metaQuestionPattern = isItalian
        ? /\b(tu|ti|te|sei|puoi)\b/i
        : /\b(you|your|are you|can you)\b/i;
    const words = userMessage.split(/\s+/).filter(Boolean).length;
    if (words <= 10 && metaQuestionPattern.test(userMessage)) return 'off_topic_question';

    return 'none';
}

function isClarificationHandledResponse(response: string, language: string): boolean {
    const text = String(response || '');
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(per chiarire|intendo|mi riferivo|in altre parole|pi[uù] chiaramente|cio[eè]|parlavo di)\b/i;
    const enPattern = /\b(to clarify|i meant|i was referring to|in other words|more clearly|that is|i was talking about)\b/i;
    return (isItalian ? itPattern.test(text) : enPattern.test(text)) && text.includes('?');
}

function isScopeBoundaryHandledResponse(response: string, language: string): boolean {
    const text = String(response || '');
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(fuori(?:\s+dallo)?\s+scopo|esula dallo scopo|nell'ambito di questa intervista|restiamo su|torniamo a|per questa intervista)\b/i;
    const enPattern = /\b(out of scope|outside the scope|for this interview|let's stay on|let's get back to|within this interview)\b/i;
    return (isItalian ? itPattern.test(text) : enPattern.test(text)) && text.includes('?');
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
    options?: { simulationMode?: boolean; onLlmUsage?: LLMUsageCollector }
): Promise<void> {
    // Run profile extraction and completion marking in PARALLEL
    // This saves time by not waiting for one before starting the other
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

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function POST(req: Request) {
    const startTime = Date.now();
    let flushInterviewTokenUsage: (operationSuffix: string) => Promise<void> = async () => {};
    try {
        const simulationMode = isLocalSimulationRequest(req);
        const abVariantHeader = String(req.headers.get('x-interview-ab') || '').trim().toLowerCase();
        const abVariant: InterviewAbVariant = abVariantHeader === 'control' ? 'control' : 'treatment';
        const softQualityGuardsEnabled = abVariant === 'control' ? true : ENABLE_SOFT_QUALITY_GUARDS;
        const nonHardSafetyRegenerationsEnabled = abVariant === 'control' ? true : ENABLE_NON_HARD_SAFETY_REGENERATIONS;
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
        console.log(`🧪 [AB] Variant=${abVariant} softGuards=${softQualityGuardsEnabled} nonHardRegens=${nonHardSafetyRegenerationsEnabled}`);

        // ====================================================================
        // 1. LOAD DATA (with parallel operations for speed)
        // ====================================================================
        const loadStart = Date.now();
        const conversation = await ChatService.loadConversation(conversationId, botId);
        console.log(`⏱️ [TIMING] Data load: ${Date.now() - loadStart}ms`);
        const bot = conversation.bot;
        const language = bot.language || 'en';
        const interviewObjective = String((bot as any).researchGoal || '').trim();
        const shouldCollectData = (bot as any).collectCandidateData;
        const lastIncomingMessage = incomingMessages[incomingMessages.length - 1];
        const interviewProject = (bot as any).project || {};
        const interviewOrganizationId: string | null =
            interviewProject?.organization?.id ||
            interviewProject?.organizationId ||
            null;
        const interviewProjectId: string | undefined = interviewProject?.id || undefined;

        const llmUsageTotals = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            calls: 0
        };
        const llmUsageByModel = new Map<string, {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            calls: number;
        }>();

        const normalizeLlmUsage = (usage?: LLMUsagePayload | null) => {
            const inputTokens = Number(usage?.inputTokens || 0);
            const outputTokens = Number(usage?.outputTokens || 0);
            const fallbackTotal = Math.max(0, inputTokens) + Math.max(0, outputTokens);
            const totalTokens = Number(usage?.totalTokens || fallbackTotal);
            return {
                inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : 0,
                outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens)) : 0,
                totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : 0
            };
        };

        const resolveModelIdForUsage = (modelLike: unknown): string => {
            if (!modelLike) return 'unknown';
            if (typeof modelLike === 'string') return modelLike;
            if (typeof modelLike === 'object') {
                const asObj = modelLike as Record<string, unknown>;
                const direct = asObj.modelId;
                if (typeof direct === 'string' && direct.trim()) return direct;
                const spec = asObj.specification as Record<string, unknown> | undefined;
                if (spec && typeof spec.modelId === 'string' && spec.modelId.trim()) {
                    return spec.modelId;
                }
            }
            return 'unknown';
        };

        const collectLlmUsage: LLMUsageCollector = ({ source, model, usage }) => {
            const normalized = normalizeLlmUsage(usage);
            if (normalized.totalTokens <= 0) return;

            llmUsageTotals.inputTokens += normalized.inputTokens;
            llmUsageTotals.outputTokens += normalized.outputTokens;
            llmUsageTotals.totalTokens += normalized.totalTokens;
            llmUsageTotals.calls += 1;

            const modelKey = String(model || 'unknown').trim() || 'unknown';
            const modelUsage = llmUsageByModel.get(modelKey) || {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                calls: 0
            };
            modelUsage.inputTokens += normalized.inputTokens;
            modelUsage.outputTokens += normalized.outputTokens;
            modelUsage.totalTokens += normalized.totalTokens;
            modelUsage.calls += 1;
            llmUsageByModel.set(modelKey, modelUsage);

            console.log(
                `📉 [LLM_USAGE] source=${source} model=${modelKey} in=${normalized.inputTokens} out=${normalized.outputTokens} total=${normalized.totalTokens}`
            );
        };

        const trackedGenerateObject = (async (...args: Parameters<typeof generateObject>) => {
            const result = await (generateObject as any)(...args);
            const firstArg = (args[0] || {}) as { model?: unknown };
            collectLlmUsage({
                source: 'chat_route_generate_object',
                model: resolveModelIdForUsage(firstArg.model),
                usage: (result as any)?.usage
            });
            return result;
        }) as typeof generateObject;

        const trackedGenerateText = (async (...args: Parameters<typeof generateText>) => {
            const result = await (generateText as any)(...args);
            const firstArg = (args[0] || {}) as { model?: unknown };
            collectLlmUsage({
                source: 'chat_route_generate_text',
                model: resolveModelIdForUsage(firstArg.model),
                usage: (result as any)?.usage
            });
            return result;
        }) as typeof generateText;

        const getLlmUsageSnapshot = () => ({
            inputTokens: llmUsageTotals.inputTokens,
            outputTokens: llmUsageTotals.outputTokens,
            totalTokens: llmUsageTotals.totalTokens,
            calls: llmUsageTotals.calls,
            byModel: [...llmUsageByModel.entries()].map(([model, usage]) => ({
                model,
                ...usage
            }))
        });

        let llmUsageFlushed = false;
        flushInterviewTokenUsage = async (operationSuffix: string) => {
            if (llmUsageFlushed || simulationMode) return;
            llmUsageFlushed = true;

            if (llmUsageTotals.totalTokens <= 0) return;

            if (!interviewOrganizationId) {
                console.warn('[TokenTracking] Missing interview owner organization. Skipping token charge.', {
                    conversationId,
                    botId: bot.id,
                    totalTokens: llmUsageTotals.totalTokens
                });
                return;
            }

            const dominantModel = [...llmUsageByModel.entries()]
                .sort((a, b) => b[1].totalTokens - a[1].totalTokens)[0]?.[0]
                || String((bot as any).modelName || 'gpt-4o-mini');

            try {
                await TokenTrackingService.logTokenUsage({
                    userId: undefined,
                    organizationId: interviewOrganizationId,
                    projectId: interviewProjectId,
                    inputTokens: llmUsageTotals.inputTokens,
                    outputTokens: llmUsageTotals.outputTokens,
                    category: 'INTERVIEW',
                    model: dominantModel,
                    operation: `interview-response:${operationSuffix}`,
                    resourceType: 'interview',
                    resourceId: bot.id
                });
            } catch (err) {
                console.error('[TokenTracking] Interview usage flush failed:', err);
            }
        };

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
                const userFacingError = (language || 'en').toLowerCase().startsWith('it')
                    ? 'Intervista temporaneamente non disponibile per limiti di accesso o crediti. Riprova tra poco oppure contatta il team.'
                    : 'Interview temporarily unavailable due to access or credit limits. Please try again shortly or contact the team.';
                return Response.json(
                    {
                        text: userFacingError,
                        currentTopicId: conversation.currentTopicId,
                        isCompleted: false,
                        degraded: true,
                        code: (creditsCheck as any).code || 'ACCESS_DENIED',
                        error: creditsCheck.error,
                        creditsNeeded: creditsCheck.creditsNeeded,
                        creditsAvailable: creditsCheck.creditsAvailable
                    },
                    { status: 200 }
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

        const [savedUserMessage, , openAIKey, runtimeModels] = await Promise.all([
            saveUserMessagePromise,
            // Update progress
            ChatService.updateProgress(conversationId, safeEffectiveDuration),
            // Get API key
            LLMService.getApiKey(bot, 'openai').then(key => key || process.env.OPENAI_API_KEY || ''),
            // Pre-fetch routed models (primary + critical paths)
            LLMService.getInterviewRuntimeModels(bot)
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
        const previousAssistantMessage = [...canonicalMessages]
            .reverse()
            .find(message => message.role === 'assistant')?.content || null;

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
                { simulationMode, onLlmUsage: collectLlmUsage }
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

            await flushInterviewTokenUsage('safety_cap_completion');
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
            runtimeInterviewKnowledge: rawMetadata.runtimeInterviewKnowledge ?? null,
            runtimeInterviewKnowledgeSignature: rawMetadata.runtimeInterviewKnowledgeSignature ?? null,
        };

        const activeTopics = state.phase === 'DEEP' ? getDeepTopics(botTopics, state.deepTopicOrder) : botTopics;
        const currentTopic = activeTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number.isFinite(safeEffectiveDuration)
            ? safeEffectiveDuration
            : Number(conversation.effectiveDuration || 0);
        const maxDurationMins = bot.maxDurationMins || 10;

        const runtimeKnowledgeSignature = buildRuntimeInterviewKnowledgeSignature({
            language,
            researchGoal: bot.researchGoal || '',
            targetAudience: bot.targetAudience || '',
            plan: interviewPlan
        });
        const manualInterviewGuide = extractManualInterviewGuideSource(
            (bot.knowledgeSources || []).map((source: any) => ({
                type: source.type,
                title: source.title,
                content: source.content
            }))
        );
        const hasValidRuntimeKnowledge = isRuntimeInterviewKnowledgeValid(
            state.runtimeInterviewKnowledge,
            runtimeKnowledgeSignature
        );
        const shouldPrepareRuntimeKnowledge =
            (state.phase === 'SCAN' || state.phase === 'DEEP') &&
            !manualInterviewGuide &&
            !hasValidRuntimeKnowledge;
        const runtimeInterviewKnowledgePromise: Promise<RuntimeInterviewKnowledge | null> = shouldPrepareRuntimeKnowledge
            ? generateRuntimeInterviewKnowledge({
                model: runtimeModels.quality,
                signature: runtimeKnowledgeSignature,
                language,
                interviewGoal: bot.researchGoal || '',
                targetAudience: bot.targetAudience || '',
                topics: interviewPlan.scan.topics.map((topic) => ({
                    topicId: topic.topicId,
                    topicLabel: topic.label,
                    subGoals: topic.subGoals || []
                })),
                timeoutMs: 1200,
                onUsage: collectLlmUsage
            })
            : Promise.resolve(hasValidRuntimeKnowledge ? state.runtimeInterviewKnowledge || null : null);

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
        let supervisorInsight: SupervisorInsight = createDefaultSupervisorInsight();
        const buildDeepOfferInsight = (sourceState: InterviewState) => {
            const extensionPreview = buildExtensionPreviewHints({
                botTopics,
                deepOrder: sourceState.deepTopicOrder,
                history: sourceState.topicSubGoalHistory,
                interestingTopics: sourceState.interestingTopics,
                interviewObjective,
                language,
                startIndex: sourceState.topicIndex,
                maxItems: 2
            });
            return createDeepOfferInsight(extensionPreview);
        };

        if (lastMessage?.role === 'user') {
            nextState.lastUserTopicId = currentTopic.id;
        }

        let forceEarlyClosureFromUser = false;
        if (lastMessage?.role === 'user' && state.phase !== 'DATA_COLLECTION') {
            const closureIntent = await detectExplicitClosureIntent(
                lastMessage.content,
                openAIKey,
                language,
                { onUsage: collectLlmUsage }
            );
            if (closureIntent.wantsToConclude && closureIntent.confidence !== 'low') {
                forceEarlyClosureFromUser = true;
                console.log(`🛑 [SUPERVISOR] Explicit user intent to conclude detected. reason="${closureIntent.reason}" confidence=${closureIntent.confidence}`);

                // Reset extension state to avoid offer loops and move straight to closure path.
                nextState.deepAccepted = false;
                nextState.extensionOfferAttempts = 0;
                nextState.extensionReturnPhase = null;
                nextState.extensionReturnTopicIndex = null;
                nextState.extensionReturnTurnInTopic = null;
                nextState.closureAttempts = 0;

                if (shouldCollectData) {
                    nextState.phase = 'DATA_COLLECTION';
                    nextState.consentGiven = false;
                    nextState.forceConsentQuestion = true;
                    supervisorInsight = {
                        status: 'DATA_COLLECTION_CONSENT',
                        stopReason: closureIntent.reason
                    };
                } else {
                    nextState.phase = 'DATA_COLLECTION';
                    supervisorInsight = {
                        status: 'COMPLETE_WITHOUT_DATA',
                        stopReason: closureIntent.reason
                    };
                }
            }
        }

        // --------------------------------------------------------------------
        // PHASE: MACHINE
        // --------------------------------------------------------------------
        if (!forceEarlyClosureFromUser && supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT') {

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
                            // End of SCAN: prepare DEEP and decide whether to offer extension first.
                            const maxDurationSec = maxDurationMins * 60;
                            const remainingSec = maxDurationSec - effectiveSec;
                            console.log("📊 [SCAN] Complete.", `remainingSec: ${remainingSec}`);
                            const deepPlan = buildDeepPlan(
                                botTopics,
                                interviewPlan,
                                state.topicSubGoalHistory,
                                state.interestingTopics,
                                remainingSec,
                                interviewObjective,
                                language
                            );
                            nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                            nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                            const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);
                            nextTopicId = deepTopics[0]?.id || botTopics[0].id;

                            if (remainingSec <= 0 && state.deepAccepted !== true) {
                                nextState.phase = 'DEEP_OFFER';
                                nextState.deepAccepted = false;
                                nextState.topicIndex = 0;
                                nextState.turnInTopic = 0;
                                nextState.extensionReturnPhase = 'DEEP';
                                nextState.extensionReturnTopicIndex = 0;
                                nextState.extensionReturnTurnInTopic = 0;
                                nextState.extensionOfferAttempts = 0;
                                supervisorInsight = buildDeepOfferInsight(nextState);
                                console.log(`🎁 [SCAN→DEEP_OFFER] SCAN complete with no remaining time. Asking extension consent.`);
                            } else {
                                nextState.phase = 'DEEP';
                                nextState.deepAccepted = state.deepAccepted === true ? true : null;
                                nextState.topicIndex = 0;
                                nextState.turnInTopic = 0;
                                const bestSnippet = (state.interestingTopics || []).find(
                                    (it: InterestingTopic) => it.topicId === deepTopics[0]?.id
                                )?.bestSnippet || '';
                                supervisorInsight = { status: 'START_DEEP', engagingSnippet: bestSnippet };
                                console.log(`✅ [SCAN→DEEP] SCAN complete. Starting DEEP.`);
                            }
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
                const deepOfferResult = await runDeepOfferPhase({
                    state: state as InterviewStateLike,
                    nextState: nextState as InterviewStateLike,
                    botTopics,
                    canonicalMessages,
                    lastUserMessage: lastMessage?.role === 'user' ? (lastMessage.content || '') : '',
                    shouldCollectData,
                    maxDurationMins,
                    effectiveSec,
                    deps: {
                        checkUserIntent: async (userMessage: string, context: 'deep_offer') =>
                            checkUserIntent(userMessage, openAIKey, language, context, { onUsage: collectLlmUsage }),
                        isExtensionOfferQuestion: (message: string) => isExtensionOfferQuestion(message, language),
                        buildDeepOfferInsight: (sourceState: InterviewStateLike) =>
                            buildDeepOfferInsight(sourceState as InterviewState),
                        buildDeepPlan: (remainingSec: number) =>
                            buildDeepPlan(
                                botTopics,
                                interviewPlan,
                                state.topicSubGoalHistory,
                                state.interestingTopics,
                                remainingSec,
                                interviewObjective,
                                language
                            ),
                        getDeepTopics: (deepOrder?: string[]) => getDeepTopics(botTopics, deepOrder),
                        getRemainingSubGoals: (topic: any, history?: Record<string, string[]>) => getRemainingSubGoals(topic, history),
                        selectDeepFocusPoint: ({ topic, availableSubGoals, engagingSnippet, lastUserMessage }) =>
                            selectDeepFocusPoint({
                                topic,
                                availableSubGoals,
                                engagingSnippet,
                                interviewObjective,
                                lastUserMessage,
                                language
                            })
                    }
                });
                Object.assign(nextState, deepOfferResult.nextState);
                supervisorInsight = deepOfferResult.supervisorInsight;
                if (deepOfferResult.nextTopicId) {
                    nextTopicId = deepOfferResult.nextTopicId;
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DEEP
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEP') {
                if (!state.deepTurnsByTopic || Object.keys(state.deepTurnsByTopic).length === 0) {
                    const maxDurationSecForPlan = maxDurationMins * 60;
                    const remainingSecForPlan = maxDurationSecForPlan - effectiveSec;
                    const deepPlan = buildDeepPlan(
                        botTopics,
                        interviewPlan,
                        state.topicSubGoalHistory,
                        state.interestingTopics,
                        remainingSecForPlan,
                        interviewObjective,
                        language
                    );
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
                let usedClarificationTurnInDeep = false;
                if (remainingSec <= 0 && state.deepAccepted !== true) {
                    const shouldClarifyBeforeOffer =
                        lastMessage?.role === 'user' &&
                        isClarificationSignal(lastMessage.content, language) &&
                        ((state.clarificationTurnsByTopic || {})[deepCurrent.id] || 0) < 1;

                    if (shouldClarifyBeforeOffer) {
                        usedClarificationTurnInDeep = true;
                        nextState.turnInTopic = state.turnInTopic;
                        nextState.clarificationTurnsByTopic = {
                            ...(state.clarificationTurnsByTopic || {}),
                            [deepCurrent.id]: ((state.clarificationTurnsByTopic || {})[deepCurrent.id] || 0) + 1
                        };
                        const usedSubGoals = (state.topicSubGoalHistory || {})[deepCurrent.id] || [];
                        const lastDeepGoal = (state.deepLastSubGoalByTopic || {})[deepCurrent.id];
                        const availableSubGoals = (deepCurrent.subGoals || [])
                            .filter((sg: string) => !usedSubGoals.includes(sg))
                            .filter((sg: string) => (lastDeepGoal ? sg !== lastDeepGoal : true));
                        const matchingTopic = (nextState.interestingTopics || state.interestingTopics || []).find(
                            (it: InterestingTopic) => it.topicId === deepCurrent.id
                        );
                        const engagingSnippet = matchingTopic?.bestSnippet || '';
                        const focusPoint = selectDeepFocusPoint({
                            topic: deepCurrent,
                            availableSubGoals: availableSubGoals.length > 0 ? availableSubGoals : (deepCurrent.subGoals || [deepCurrent.label]),
                            engagingSnippet,
                            interviewObjective,
                            lastUserMessage: lastMessage.content,
                            language
                        });
                        supervisorInsight = { status: 'DEEPENING', focusPoint: focusPoint || deepCurrent.label, engagingSnippet };
                        console.log(`🧩 [DEEP] Clarification detected on "${deepCurrent.label}" at time boundary. Adding one clarification turn before extension offer.`);
                    } else {
                        nextState.phase = 'DEEP_OFFER';
                        nextState.deepAccepted = false;
                        nextState.extensionReturnPhase = 'DEEP';
                        nextState.extensionReturnTopicIndex = state.topicIndex;
                        nextState.extensionReturnTurnInTopic = state.turnInTopic;
                        nextState.extensionOfferAttempts = 0;
                        supervisorInsight = buildDeepOfferInsight(state);
                        console.log(`🎁 [DEEP→DEEP_OFFER] Time limit reached during DEEP. Asking extension consent.`);
                    }
                }

                if (nextState.phase === 'DEEP_OFFER') {
                    // Skip DEEP progression until user responds to offer
                } else if (usedClarificationTurnInDeep) {
                    // Keep current DEEP topic/turn for one clarification response.
                } else if (state.turnInTopic >= turnsLimit) {
                    // Move to next topic
                    if (state.topicIndex + 1 < deepTotal) {
                        nextState.topicIndex = state.topicIndex + 1;
                        nextState.turnInTopic = 0;
                        nextTopicId = deepTopics[nextState.topicIndex]?.id || botTopics[nextState.topicIndex]?.id;

                        console.log(`➡️ [DEEP] Topic transition: ${deepCurrent.label} → ${deepTopics[nextState.topicIndex]?.label || botTopics[nextState.topicIndex]?.label}`);
                        const nextDeepTopic = deepTopics[nextState.topicIndex] || botTopics[nextState.topicIndex];
                        const nextAvailableSubGoals = nextDeepTopic ? getRemainingSubGoals(nextDeepTopic, nextState.topicSubGoalHistory || state.topicSubGoalHistory) : [];
                        const nextEngagingSnippet = (nextState.interestingTopics || state.interestingTopics || []).find(
                            (it: InterestingTopic) => it.topicId === nextDeepTopic?.id
                        )?.bestSnippet || '';
                        const nextFocusPoint = nextDeepTopic ? selectDeepFocusPoint({
                            topic: nextDeepTopic,
                            availableSubGoals: nextAvailableSubGoals,
                            engagingSnippet: nextEngagingSnippet,
                            interviewObjective,
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
                            language
                        }) : '';
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
                            nextSubGoal: nextFocusPoint || nextDeepTopic?.label,
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
                        const focusPoint = selectDeepFocusPoint({
                            topic: deepCurrent,
                            availableSubGoals,
                            engagingSnippet,
                            interviewObjective,
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
                            language
                        });
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
                        { simulationMode, onLlmUsage: collectLlmUsage }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                }

                if (state.dataCollectionRefused) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode, onLlmUsage: collectLlmUsage }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    nextState.dataCollectionRefused = true;
                }

                const shouldContinueDataCollection = supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA';
                if (shouldContinueDataCollection) {
                    const candidateFields = (bot.candidateDataFields as any[]) || [];
                    const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
                    let currentProfile = (conversation.candidateProfile as any) || {};
                    let justAcceptedConsentThisTurn = false;
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
                        const intent = await checkUserIntent(
                            lastMessage?.content || '',
                            openAIKey,
                            language,
                            'consent',
                            { onUsage: collectLlmUsage }
                        );
                        console.log(`📋 [DATA_COLLECTION] Intent detected: ${intent}`);

                        if (intent === 'ACCEPT') {
                            nextState.consentGiven = true;
                            justAcceptedConsentThisTurn = true;
                            console.log(`📋 [DATA_COLLECTION] User accepted, will ask first field`);
                            // Don't set supervisorInsight here - let it fall through to ask first field
                        } else if (intent === 'REFUSE') {
                            console.log(`📋 [DATA_COLLECTION] User refused consent.`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode, onLlmUsage: collectLlmUsage }
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
                        if (justAcceptedConsentThisTurn) {
                            const nextFieldAfterConsent = getNextMissingCandidateField(
                                candidateFieldIds,
                                currentProfile,
                                state.fieldAttemptCounts,
                                3
                            );
                            if (nextFieldAfterConsent) {
                                nextState.lastAskedField = nextFieldAfterConsent;
                                nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                                nextState.consentGiven = true;
                                nextState.fieldAttemptCounts = {
                                    ...state.fieldAttemptCounts,
                                    [nextFieldAfterConsent]: (state.fieldAttemptCounts[nextFieldAfterConsent] || 0) + 1
                                };
                                supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextFieldAfterConsent };
                                console.log(`📋 [DATA_COLLECTION] Consent accepted this turn. Skipping extraction and asking first field "${nextFieldAfterConsent}".`);
                            } else {
                                supervisorInsight = { status: 'FINAL_GOODBYE' };
                                nextState.lastAskedField = null;
                                console.log(`📋 [DATA_COLLECTION] Consent accepted but no missing fields. Closing data collection.`);
                            }
                            // Critical: do not process the consent message as field content.
                        } else {
                            let haltCollection = false;

                        // CHECK (semantic): Did user change their mind mid-collection?
                        const midCollectionClosureIntent = lastMessage?.role === 'user'
                            ? await detectExplicitClosureIntent(lastMessage.content, openAIKey, language, { onUsage: collectLlmUsage })
                            : { wantsToConclude: false, confidence: 'low' as const, reason: 'no_user_message' };
                        const userWantsToStopMidCollection =
                            midCollectionClosureIntent.wantsToConclude && midCollectionClosureIntent.confidence !== 'low';

                        // CHECK: Is user frustrated/complaining about repeated questions?
                        const FRUSTRATION_IT = /\b(già (detto|chiesto)|te l'ho (già|appena)|incantato|bloccato|ripeti|sempre la stessa|loop)\b/i;
                        const FRUSTRATION_EN = /\b(already (told|said|asked)|just (told|said)|stuck|loop|same question|repeating)\b/i;
                        const frustrationPattern = language === 'it' ? FRUSTRATION_IT : FRUSTRATION_EN;
                        const userFrustrated = lastMessage?.role === 'user' && frustrationPattern.test(lastMessage.content);

                        if (userWantsToStopMidCollection) {
                            console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection (semantic). reason="${midCollectionClosureIntent.reason}" confidence=${midCollectionClosureIntent.confidence}`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode, onLlmUsage: collectLlmUsage }
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
                                        if (words.length <= 3 && content.length < 30 && !/[@\d]/.test(content) && !isLikelyNonValueAck(content)) {
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
                                { simulationMode, onLlmUsage: collectLlmUsage }
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
                            if (lastMessage?.role === 'user' && !userWantsToSkip && !justAcceptedConsentThisTurn) {
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
                                    if (isNameField && wordCount <= 3 && !currentProfile[nameFieldKey] && !isLikelyNonValueAck(userReply)) {
                                        const cleanedName = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedName.length > 0 && cleanedName.length < 50 && !/[@\d]/.test(cleanedName)) {
                                            currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct name capture for "${nameFieldKey}"`);
                                        }
                                    }

                                    // Direct capture for COMPANY (1-5 words, reasonable length)
                                    if (prioritizedField === 'company' && wordCount <= 5 && !currentProfile.company && !isLikelyNonValueAck(userReply)) {
                                        const cleanedCompany = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedCompany.length > 1 && cleanedCompany.length < 100 &&
                                            !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedCompany)) {
                                            currentProfile = { ...currentProfile, company: cleanedCompany };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct company capture`);
                                        }
                                    }

                                    // Direct capture for ROLE (1-4 words)
                                    if (prioritizedField === 'role' && wordCount <= 4 && !currentProfile.role && !isLikelyNonValueAck(userReply)) {
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
                                            language,
                                            { onUsage: collectLlmUsage }
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
                            } else if (justAcceptedConsentThisTurn) {
                                console.log(`📋 [DATA_COLLECTION] Consent just accepted: skip extraction this turn and ask first missing field.`);
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
        const modelRegistry: InterviewRuntimeModels = runtimeModels;
        const model = modelRegistry.primary;
        const criticalModel = modelRegistry.critical;
        const qualityModel = modelRegistry.quality;
        const dataCollectionModel = modelRegistry.dataCollection;
        console.log("🧠 [MODEL_ROUTING]", modelRegistry.names);
        const nextActiveTopics = nextState.phase === 'DEEP'
            ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
            : botTopics;
        const targetTopic = nextActiveTopics[nextState.topicIndex] || currentTopic;
        const runtimeInterviewKnowledge = await runtimeInterviewKnowledgePromise;
        if (runtimeInterviewKnowledge) {
            nextState.runtimeInterviewKnowledge = runtimeInterviewKnowledge;
            nextState.runtimeInterviewKnowledgeSignature = runtimeKnowledgeSignature;
        } else if (!manualInterviewGuide && !hasValidRuntimeKnowledge) {
            nextState.runtimeInterviewKnowledge = null;
            nextState.runtimeInterviewKnowledgeSignature = null;
        }
        const userTurnSignal: UserTurnSignal = lastMessage?.role === 'user'
            ? detectUserTurnSignal({
                userMessage: lastMessage.content,
                language,
                phase: nextState.phase,
                currentTopic,
                targetTopic,
                interviewObjective
            })
            : 'none';
        const previousAssistantQuestion = extractLastAssistantQuestion(previousAssistantMessage);
        const recentBridgeStems = collectRecentBridgeStems(canonicalMessages, 14);
        const plannerTopic = targetTopic || currentTopic;
        const plannerTopicId = plannerTopic?.id || currentTopic.id;
        const plannerMaxTurns = nextState.phase === 'DEEP'
            ? getDeepPlanTurns(interviewPlan, plannerTopicId)
            : getScanPlanTurns(interviewPlan, plannerTopicId);
        const plannerUsedSubGoals = (nextState.topicSubGoalHistory || {})[plannerTopicId] || [];
        const microPlannerDecision = buildMicroPlannerDecision({
            language,
            phase: nextState.phase,
            topicId: plannerTopicId,
            topicLabel: plannerTopic?.label || currentTopic.label,
            topicSubGoals: plannerTopic?.subGoals || currentTopic.subGoals || [],
            usedSubGoals: plannerUsedSubGoals,
            turnInTopic: nextState.turnInTopic,
            maxTurnsInTopic: plannerMaxTurns,
            userMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
            userTurnSignal,
            previousAssistantQuestion,
            manualGuide: manualInterviewGuide,
            runtimeKnowledge: runtimeInterviewKnowledge || state.runtimeInterviewKnowledge || null
        });


        systemPrompt = await PromptBuilder.build(
            bot,
            conversation,
            targetTopic,
            methodology,
            effectiveSec,
            supervisorInsight,
            interviewPlan
        );
        const manualKnowledgePrompt = buildManualKnowledgePromptBlock({
            manualGuide: manualInterviewGuide,
            phase: nextState.phase,
            language,
            topicLabel: targetTopic?.label || currentTopic.label,
            topicSubGoals: targetTopic?.subGoals || currentTopic.subGoals || []
        });
        const generatedKnowledgePrompt = manualKnowledgePrompt
            ? ''
            : buildRuntimeKnowledgePromptBlock({
                knowledge: runtimeInterviewKnowledge || state.runtimeInterviewKnowledge || null,
                phase: nextState.phase,
                targetTopicId: targetTopic?.id || currentTopic.id,
                language
            });
        if (manualKnowledgePrompt || generatedKnowledgePrompt) {
            systemPrompt += `\n\n${manualKnowledgePrompt || generatedKnowledgePrompt}`;
        }

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
            const isItalianPrompt = (language || '').toLowerCase().startsWith('it');
            const turnsInfo = nextState.phase === 'SCAN'
                ? (isItalianPrompt
                    ? `Turno ${nextState.turnInTopic}/${scanMaxTurns}`
                    : `Turn ${nextState.turnInTopic}/${scanMaxTurns}`)
                : (isItalianPrompt
                    ? `Turno ${nextState.turnInTopic}/${deepTurns}`
                    : `Turn ${nextState.turnInTopic}/${deepTurns}`);
            const statusBanner = isItalianPrompt
                ? `
[SUPERVISOR_RUNTIME]
fase=${nextState.phase}
topic="${currentTopicLabel}" (${nextState.topicIndex + 1}/${numTopics})
progresso=${turnsInfo}
regole_dure:
- Fai esattamente UNA domanda su "${currentTopicLabel}".
- Non chiedere contatti.
- Non chiudere l'intervista.
- Non aggiungere promo/CTA.
`
                : `
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
            systemPrompt += statusBanner;
        }

        if (lastMessage?.role === 'user') {
            const runtimeSemanticContext = buildRuntimeSemanticContextPrompt({
                language,
                phase: nextState.phase,
                targetTopicLabel: targetTopic?.label || currentTopic.label,
                supervisorInsight,
                lastUserMessage: lastMessage.content,
                previousAssistantMessage,
                recentBridgeStems
            });
            if (runtimeSemanticContext) {
                systemPrompt += `\n\n${runtimeSemanticContext}`;
            }
        }
        if (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') {
            const microPlannerPrompt = buildMicroPlannerPromptBlock({
                language,
                phase: nextState.phase,
                topicLabel: plannerTopic?.label || currentTopic.label,
                decision: microPlannerDecision
            });
            if (microPlannerPrompt) {
                systemPrompt += `\n\n${microPlannerPrompt}`;
            }
            console.log("🧭 [MICRO_PLANNER]", {
                mode: microPlannerDecision.mode,
                commentStyle: microPlannerDecision.commentStyle,
                focusSubGoal: microPlannerDecision.focusSubGoal,
                signalScore: Number(microPlannerDecision.signalScore.toFixed(2)),
                coverage: microPlannerDecision.topicCoverage,
                knowledgeSource: microPlannerDecision.knowledgeSource
            });
        }

        if (userTurnSignal === 'clarification') {
            systemPrompt += language === 'it'
                ? `\n\n## CLARIFICATION GUARD (OBBLIGATORIO)\nL'utente sta chiedendo un chiarimento: NON ignorarlo.\n1) Rispondi gentilmente chiarendo in modo diretto la domanda precedente, senza formule vaghe.\n2) Se l'utente mette due opzioni (es. "X o Y"), specifica chiaramente quale intendevi.\n3) Dopo il chiarimento, fai UNA sola domanda di follow-up coerente con il topic corrente.`
                : `\n\n## CLARIFICATION GUARD (MANDATORY)\nThe user is asking for clarification: do NOT ignore it.\n1) Reply kindly by directly clarifying your previous question.\n2) If the user offers two options (e.g. "X or Y"), state clearly which one you meant.\n3) After clarifying, ask ONE coherent follow-up question on the current topic.`;
        } else if (userTurnSignal === 'off_topic_question') {
            systemPrompt += language === 'it'
                ? `\n\n## SCOPE GUARD (OBBLIGATORIO)\nL'utente ha fatto una domanda fuori dallo scopo dell'intervista.\n1) Rispondi con una frase gentile che spieghi che la domanda esula dallo scopo di questa intervista.\n2) Riporta subito il focus al topic corrente con UNA sola domanda mirata.\n3) Non sviluppare il tema fuori scopo in dettaglio.`
                : `\n\n## SCOPE GUARD (MANDATORY)\nThe user asked a question outside the interview scope.\n1) Reply with one polite sentence stating that the question is outside the scope of this interview.\n2) Immediately redirect to the current topic with ONE focused question.\n3) Do not expand on the off-topic question.`;
        }

        const shouldEndWithQuestion = !['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'].includes(supervisorInsight?.status);
        if (shouldEndWithQuestion) {
            systemPrompt += (language || '').toLowerCase().startsWith('it')
                ? `\n\n## OBBLIGATORIO: La risposta deve terminare con un punto interrogativo (?).`
                : `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;
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
            // Keep recent messages for context so the LLM can preserve continuity in sensitive transitions.
            const recentMessages = canonicalMessages.slice(-6).map((m: any) => ({ role: m.role, content: m.content }));
            messagesForAI = recentMessages;
        }

        const criticalTurnRouting = shouldUseCriticalModelForTopicTurn({
            phase: nextState.phase,
            supervisorStatus: supervisorInsight?.status,
            userTurnSignal,
            userMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
            language
        });
        const modelForMainResponse = nextState.phase === 'DATA_COLLECTION'
            ? dataCollectionModel
            : nextState.phase === 'DEEP_OFFER'
                ? criticalModel
                : criticalTurnRouting.useCritical
                    ? criticalModel
                    : model;
        if (criticalTurnRouting.useCritical && nextState.phase !== 'DATA_COLLECTION' && nextState.phase !== 'DEEP_OFFER') {
            console.log(`🧠 [MODEL_ROUTING] Escalating to critical model for this turn. reason=${criticalTurnRouting.reason}`);
        }

        console.log("⏳ [CHAT] Generating response...");
        console.time("LLM");

        let result: any;
        try {
            result = await Promise.race([
                trackedGenerateObject({ model: modelForMainResponse, schema, messages: messagesForAI, system: systemPrompt, temperature: 0.7 }),
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
                await flushInterviewTokenUsage('timeout_fallback');
                return Response.json({ text: fallback, currentTopicId: nextTopicId, isCompleted: false });
            }
            const errorName = String(error?.name || '');
            const errorMessage = String(error?.message || '');
            const isObjectValidationFailure =
                errorName.includes('AI_NoObjectGeneratedError') ||
                errorMessage.includes('No object generated') ||
                errorMessage.includes('did not match schema');
            if (isObjectValidationFailure) {
                console.error('⚠️ [LLM] Object schema validation failed. Retrying with fallback strategy.', {
                    name: errorName,
                    message: errorMessage
                });
                try {
                    const minimalSchema = z.object({
                        response: z.string()
                    });
                    const retry = await trackedGenerateObject({
                        model: modelForMainResponse,
                        schema: minimalSchema,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Return ONLY a JSON object with one key: {"response":"..."} and no other keys.`,
                        temperature: 0.6
                    });
                    result = { object: { response: String(retry.object.response || '').trim(), meta_comment: 'minimal_schema_fallback' } };
                } catch (innerError: any) {
                    console.error('⚠️ [LLM] Minimal-schema retry failed. Falling back to generateText.', innerError);
                    const textFallback = await trackedGenerateText({
                        model: modelForMainResponse,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Return plain text only. Do not output JSON.`,
                        temperature: 0.6
                    });
                    result = { object: { response: String(textFallback.text || '').trim(), meta_comment: 'generate_text_fallback' } };
                }
            } else {
            throw error;
            }
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
            completionBlockedForMissingField: false,
            questionDedupIntercepted: false
        };
        const deepOfferPreviewHints: string[] = Array.isArray(supervisorInsight.extensionPreview)
            ? supervisorInsight.extensionPreview.map(v => String(v || '').trim()).filter(Boolean).slice(0, 1)
            : [];
        const userBridgeHint = lastMessage?.role === 'user'
            ? buildUserBridgeHint(lastMessage.content, language)
            : '';

        if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            if (!isExtensionOfferQuestion(responseText, language)) {
                console.log(`⚠️ [SUPERVISOR] Deep offer response not an offer. Regenerating.`);
                try {
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: You must ONLY ask (lightly) if the user wants to extend the interview by a few minutes to continue, and wait for yes/no. Do NOT ask any topic question.`;
                    const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    didRegenerate = true;
                } catch (e) {
                    console.error('Deep offer regeneration failed:', e);
                }
            }

            // Hard enforcement: never leave DEEP_OFFER with a topic question.
            if (!isExtensionOfferQuestion(responseText, language)) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    onUsage: collectLlmUsage
                });
                didRegenerate = true;
            }
        }

        // Clarification/scope enforcement on topic phases:
        // if the user asked a clarification or an off-topic question,
        // ensure the assistant acknowledges it explicitly before continuing.
        if (nonHardSafetyRegenerationsEnabled && !didRegenerate && (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && lastMessage?.role === 'user') {
            if (userTurnSignal === 'clarification' && !isClarificationHandledResponse(responseText, language)) {
                console.log(`⚠️ [SUPERVISOR] Clarification requested but not handled clearly. Regenerating.`);
                const enforcedSystem = language === 'it'
                    ? `${systemPrompt}\n\nCRITICAL: Rispondi prima al chiarimento in modo diretto e gentile (specifica esattamente cosa intendevi), poi fai UNA sola domanda coerente col topic corrente.`
                    : `${systemPrompt}\n\nCRITICAL: First answer the clarification directly and kindly (state exactly what you meant), then ask ONE coherent follow-up question on the current topic.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.25 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            } else if (userTurnSignal === 'off_topic_question' && !isScopeBoundaryHandledResponse(responseText, language)) {
                console.log(`⚠️ [SUPERVISOR] Off-topic user question not bounded. Regenerating with scope boundary.`);
                const enforceTopic = targetTopic?.label || currentTopic.label;
                const enforcedSystem = language === 'it'
                    ? `${systemPrompt}\n\nCRITICAL: Spiega gentilmente in una frase che la domanda dell'utente è fuori scopo per questa intervista, poi riporta il focus su "${enforceTopic}" con UNA sola domanda.`
                    : `${systemPrompt}\n\nCRITICAL: In one polite sentence, explain the user's question is out of scope for this interview, then redirect to "${enforceTopic}" with ONE focused question.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.25 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        const isTopicPhase = nextState.phase === 'SCAN' || nextState.phase === 'DEEP';
        if (nonHardSafetyRegenerationsEnabled && isTopicPhase && targetTopic && !didRegenerate) {
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
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && !didRegenerate) {
            const assistantHistory = canonicalMessages
                .filter((m: ClientMessage) => m.role === 'assistant')
                .map((m: ClientMessage) => String(m.content || ''))
                .slice(-60);
            const duplicateMatch = findDuplicateQuestionMatch({
                candidateResponse: responseText,
                historyAssistantMessages: assistantHistory,
                language
            });

            if (duplicateMatch.isDuplicate) {
                flowTelemetry.questionDedupIntercepted = true;
                qualityTelemetry.gateTriggered = true;
                const enforceTopic = targetTopic?.label || currentTopic.label;
                console.log(
                    `⚠️ [SUPERVISOR] Duplicate question detected. similarity=${duplicateMatch.similarity.toFixed(2)} reason=${duplicateMatch.reason}. Regenerating.`
                );
                try {
                    responseText = await generateQuestionOnly({
                        model: qualityModel,
                        language,
                        topicLabel: enforceTopic,
                        topicCue: buildNaturalTopicCue(enforceTopic, language),
                        subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                        lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                        previousAssistantQuestion: duplicateMatch.matchedQuestion || previousAssistantQuestion,
                        semanticBridgeHint: userBridgeHint,
                        avoidBridgeStems: recentBridgeStems,
                        requireAcknowledgment: true,
                        transitionMode: supervisorInsight?.transitionMode,
                        onUsage: collectLlmUsage
                    });
                    qualityTelemetry.regenerated = true;
                    didRegenerate = true;
                } catch (e) {
                    console.error('Duplicate-question regeneration failed:', e);
                    qualityTelemetry.fallbackUsed = true;
                    responseText = language === 'it'
                        ? 'Su questo punto, quale risultato pratico vorresti ottenere per primo?'
                        : 'On this point, which practical outcome would you like to achieve first?';
                }
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
            const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

        // If in DATA_COLLECTION phase, ALWAYS ensure we ask for the specific field
        if (nextState.phase === 'DATA_COLLECTION') {
            if (nextState.dataCollectionRefused || supervisorInsight?.status === 'COMPLETE_WITHOUT_DATA') {
                console.log(`⚠️ [SUPERVISOR] Forcing final closure after data collection refusal/completion.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Conclude the interview now. Thank the user, and if a reward is configured, provide it. Do NOT ask any questions. Append "INTERVIEW_COMPLETED".`;
                try {
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
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
                        const consentCheck = await trackedGenerateObject({
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
                        const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                        responseText = retry.object.response?.trim() || responseText;

                        try {
                            const consentCheck2 = await trackedGenerateObject({
                                model: openai('gpt-4o-mini'),
                                schema: consentSchema,
                                prompt: `Determine if the assistant is explicitly asking for permission to collect contact details and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isConsent: true/false }.`,
                                temperature: 0
                            });
                            if (!consentCheck2.object.isConsent) {
                                const enforcedSystem2 = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                                const retry2 = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem2, temperature: 0.1 });
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
                        const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                        responseText = retry.object.response?.trim() || responseText;
                    }
                }
                // ALL FIELDS COLLECTED but bot didn't complete
                else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                    console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append \"INTERVIEW_COMPLETED\". Do not ask any questions.`;
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
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
                supervisorInsight = buildDeepOfferInsight(nextState);
                try {
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask (lightly) if the user wants to extend the interview by a few minutes to continue. One question only.`;
                    const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Extension offer regeneration after closure failed:', e);
                }
            } else {
                nextState.closureAttempts = (state.closureAttempts || 0) + 1;
                console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Forcing topic question. Attempt #${nextState.closureAttempts}`);

                const enforceTopic = targetTopic?.label || currentTopic.label;
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT end the interview. Ask exactly ONE question about the topic "${enforceTopic}". Do not mention contacts, rewards, or closing. The response MUST end with a question mark.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                console.log("🧭 [SUPERVISOR] Override response:", responseText.slice(0, 300));

                // If the override still isn't a proper question, use fallback question-only generation (MAX 1 retry)
                const stillBad = !responseText.includes('?') || goodbyePattern.test(responseText);
                if (stillBad) {
                    console.log("🧭 [SUPERVISOR] Override still invalid, using fallback question-only generation.");
                    try {
                        responseText = await generateQuestionOnly({
                            model: qualityModel,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                            previousAssistantQuestion,
                            semanticBridgeHint: userBridgeHint,
                            avoidBridgeStems: recentBridgeStems,
                            requireAcknowledgment: true,
                            onUsage: collectLlmUsage
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
            try {
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Offer the choice to extend the interview by a few minutes and continue. One question only. Do not ask any topic question.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
            } catch (e) {
                console.error('Deep offer closure regeneration failed:', e);
            }
            if (!isExtensionOfferQuestion(responseText, language)) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    onUsage: collectLlmUsage
                });
            }
        }

        // ====================================================================
        // QUALITATIVE GUARDRAILS (naturalness-first, light-touch corrections)
        // ====================================================================
        const qualityGatePhases = new Set(['SCAN', 'DEEP', 'DEEP_OFFER']);
        qualityTelemetry.eligible = softQualityGuardsEnabled && qualityGatePhases.has(nextState.phase);

        if (softQualityGuardsEnabled && qualityGatePhases.has(nextState.phase) && lastMessage?.role === 'user' && !/INTERVIEW_COMPLETED/i.test(responseText)) {
            qualityTelemetry.evaluated = true;
            const phaseForQuality = nextState.phase as 'SCAN' | 'DEEP' | 'DEEP_OFFER';
            const qualityTopicLabel = targetTopic?.label || currentTopic?.label || 'current topic';
            const lastAssistantBeforeCurrent = previousAssistantMessage;

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
            // - malformed or repetitive question
            // - weak semantic linkage / clarification handling (strictly gated)
            const needsQuestionCountFix = !qualitative.checks.oneQuestion;
            const needsRepetitionFix = !qualitative.checks.nonRepetitive;
            const userWordCountForQuality = String(lastMessage.content || '').trim().split(/\s+/).filter(Boolean).length;
            const clarificationRequestedForQuality = isClarificationSignal(lastMessage.content, language);
            const needsSemanticLinkFix = !qualitative.checks.referencesUserContext && userWordCountForQuality >= 4;
            const needsTransitionCoherenceFix =
                !qualitative.checks.coherentTransition &&
                userWordCountForQuality >= 8 &&
                qualitative.score < 80;
            const needsClarificationFix = clarificationRequestedForQuality && !qualitative.checks.handlesClarificationNaturally;
            const needsClarificationDirectFix = userTurnSignal === 'clarification' && !isClarificationHandledResponse(responseText, language);
            const needsScopeBoundaryFix = userTurnSignal === 'off_topic_question' && !isScopeBoundaryHandledResponse(responseText, language);
            const isTopicQuestionPhase = nextState.phase === 'SCAN' || nextState.phase === 'DEEP';

            if (isTopicQuestionPhase && (
                needsQuestionCountFix ||
                needsRepetitionFix ||
                needsSemanticLinkFix ||
                needsTransitionCoherenceFix ||
                needsClarificationFix ||
                needsClarificationDirectFix ||
                needsScopeBoundaryFix
            )) {
                qualityTelemetry.gateTriggered = true;
                const enforceTopic = targetTopic?.label || currentTopic.label;
                const previousAssistant = String(lastAssistantBeforeCurrent || '').slice(0, 180);
                const userContext = String(lastMessage.content || '').slice(0, 180);
                const correctionPrompt = buildQualityCorrectionPrompt({
                    language,
                    enforceTopic,
                    userContext,
                    previousAssistant,
                    clarifyPreviousQuestion: clarificationRequestedForQuality || userTurnSignal === 'clarification',
                    scopeBoundaryRequired: userTurnSignal === 'off_topic_question'
                });

                try {
                    const retry = await trackedGenerateObject({
                        model: qualityModel,
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
                            model: qualityModel,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                            lastUserMessage: lastMessage?.content || null,
                            previousAssistantQuestion,
                            semanticBridgeHint: userBridgeHint,
                            avoidBridgeStems: recentBridgeStems,
                            requireAcknowledgment: true,
                            transitionMode: supervisorInsight?.transitionMode,
                            onUsage: collectLlmUsage
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
                const additivePrompt = buildAdditiveQuestionPrompt({
                    language,
                    hasMultipleQuestionsNow,
                    enforceTopic,
                    userContext
                });

                try {
                    // Always regenerate contextually for conversational coherence.
                    const additiveRetry = await trackedGenerateObject({
                        model: qualityModel,
                        schema,
                        messages: [
                            ...messagesForAI.slice(0, -1),
                            { role: 'user' as const, content: lastMessage?.content || '' }
                        ],
                        system: `${systemPrompt}\n\n${additivePrompt}`,
                        temperature: 0.35
                    });
                    responseText = additiveRetry.object.response?.trim() || responseText;

                    // If still malformed, ask a fresh contextual single-question turn.
                    if (!responseText.includes('?')) {
                        responseText = await generateQuestionOnly({
                            model: qualityModel,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                            previousAssistantQuestion,
                            semanticBridgeHint: userBridgeHint,
                            avoidBridgeStems: recentBridgeStems,
                            requireAcknowledgment: true,
                            transitionMode: supervisorInsight?.transitionMode,
                            onUsage: collectLlmUsage
                        });
                    }

                    // Clean any remaining closure markers
                    responseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();

                } catch (e) {
                    console.error('Additive fix failed:', e);
                    try {
                        responseText = await generateQuestionOnly({
                            model: qualityModel,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                            previousAssistantQuestion,
                            semanticBridgeHint: userBridgeHint,
                            avoidBridgeStems: recentBridgeStems,
                            requireAcknowledgment: true,
                            transitionMode: supervisorInsight?.transitionMode,
                            onUsage: collectLlmUsage
                        });
                    } catch (innerError) {
                        console.error('Final contextual fallback failed:', innerError);
                        const fallbackQuestion = language === 'it'
                            ? 'Puoi approfondire questo punto?'
                            : 'Can you elaborate on this?';
                        responseText = fallbackQuestion;
                    }
                }
            }
        }

        // DEEP_OFFER safety: must be an extension-consent question
        if (nextState.phase === 'DEEP_OFFER') {
            const invalidDeepOffer =
                !isExtensionOfferQuestion(responseText, language) ||
                goodbyePattern.test(responseText) ||
                /INTERVIEW_COMPLETED/i.test(responseText);
            if (invalidDeepOffer) {
                flowTelemetry.deepOfferClosureIntercepted = true;
                console.log(`🛡️ [SAFETY_NET] Invalid DEEP_OFFER response, fixing...`);
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    onUsage: collectLlmUsage
                });
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
                        responseText = await generateConsentQuestionOnly({
                            model: dataCollectionModel,
                            language,
                            onUsage: collectLlmUsage
                        });
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
                            model: dataCollectionModel,
                            language,
                            fieldLabel,
                            onUsage: collectLlmUsage
                        });
                    } catch (e) {
                        console.error('Field question fallback failed:', e);
                        responseText = normalizeSingleQuestion(String(responseText || '').replace(/INTERVIEW_COMPLETED/gi, '').trim());
                    }
                }
            } else if (nextState.consentGiven === true && !missingFieldForDataGuard && !hasCompletionTagNow) {
                console.log('🛡️ [FINAL_GUARD] DATA_COLLECTION complete but missing completion tag. Forcing final goodbye.');
                try {
                    const retry = await trackedGenerateObject({
                        model: dataCollectionModel,
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
                llmUsage: getLlmUsageSnapshot() as unknown as Prisma.InputJsonValue,
                responseLatencyMs: Date.now() - startTime,
                simulationMode,
                abVariant,
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
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
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
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
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
                    { simulationMode, onLlmUsage: collectLlmUsage }
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
                await flushInterviewTokenUsage('completed_response');
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

        await flushInterviewTokenUsage('standard_response');
        return Response.json({
            text: responseText,
            currentTopicId: nextTopicId,
            isCompleted: false
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        await flushInterviewTokenUsage('error_fallback');
        const safeFallback = "Mi dispiace, c'è stato un problema temporaneo. Possiamo riprendere da dove eravamo?";
        return Response.json(
            {
                text: safeFallback,
                currentTopicId: null,
                isCompleted: false,
                degraded: true,
                error: String(error?.message || 'unknown_error')
            },
            { status: 200 }
        );
    }
}

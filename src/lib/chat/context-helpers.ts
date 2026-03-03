import type { Phase } from '@/lib/interview/interview-supervisor';
import type { InterviewPlan } from '@/lib/interview/plan-types';

export interface InterestingTopic {
    topicId: string;
    topicLabel: string;
    engagementScore: number;  // 0-1 based on response length
    bestSnippet?: string;
}

export interface TopicBudget {
    baseTurns: number;
    minTurns: number;
    maxTurns: number;
    turnsUsed: number;
    bonusTurnsGranted: number;
}

// ============================================================================ 
// HELPERS: Engagement scoring and snippets
// ============================================================================
export function extractSnippet(text: string, maxLen: number = 120): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    // Prefer first sentence if available
    const firstSentence = clean.split(/[.!?]/)[0]?.trim();
    const snippet = (firstSentence && firstSentence.length >= 20) ? firstSentence : clean;
    return snippet.length > maxLen ? snippet.slice(0, maxLen - 1) + '…' : snippet;
}

export function computeEngagementScore(text: string, language: string): number {
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

export function shouldUseCriticalModelForTopicTurn(params: {
    phase: Phase;
    supervisorStatus?: string;
    userTurnSignal: 'none' | 'clarification' | 'off_topic_question';
    userMessage?: string | null;
    language: string;
}): { useCritical: boolean; reason: string } {
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') {
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

export const ITALIAN_STOPWORDS = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
    'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
    'e', 'o', 'ma', 'se', 'che', 'non', 'piu', 'più',
    'del', 'dello', 'della', 'dei', 'degli', 'delle',
    'al', 'allo', 'alla', 'ai', 'agli', 'alle',
    'nel', 'nello', 'nella', 'nei', 'negli', 'nelle'
]);
export const ENGLISH_STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
    'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'this', 'that', 'these', 'those', 'it', 'its', 'their', 'them'
]);

export function tokenizeForScoring(text: string, language: string): Set<string> {
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

export function lexicalOverlapScore(aText: string, bText: string, language: string): number {
    const a = tokenizeForScoring(aText, language);
    const b = tokenizeForScoring(bText, language);
    if (!a.size || !b.size) return 0;

    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) intersection++;
    }
    return intersection / Math.max(1, Math.min(a.size, b.size));
}

export function buildTopicSemanticText(topic: any): string {
    const subGoals = Array.isArray(topic?.subGoals) ? topic.subGoals.join(' ') : '';
    return `${topic?.label || ''} ${subGoals}`.trim();
}

export function getDeepTopics(botTopics: any[], deepOrder?: string[]) {
    if (!deepOrder || deepOrder.length === 0) return botTopics;
    return deepOrder
        .map(id => botTopics.find(t => t.id === id))
        .filter(Boolean);
}

export function buildDeepTopicOrder(
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

export function getScanPlanTurns(plan: InterviewPlan, topicId: string): number {
    const topic = plan.explore.topics.find(t => t.topicId === topicId);
    return Math.max(1, topic?.maxTurns ?? 1);
}

export function getDeepPlanTurns(plan: InterviewPlan, topicId: string): number {
    const base = plan.deepen.maxTurnsPerTopic;
    return Math.max(1, base);
}

export function getRemainingSubGoals(topic: any, history: Record<string, string[]> | undefined) {
    const used = (history || {})[topic.id] || [];
    return (topic.subGoals || []).filter((sg: string) => !used.includes(sg));
}

export function buildDeepPlan(
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
            : ordered.length * (plan.deepen.maxTurnsPerTopic || 2);
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

    const fallbackCount = Math.max(1, plan.deepen.fallbackTurns || 2);
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

export function selectDeepFocusPoint(params: {
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

export function buildExtensionPreviewHints(params: {
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

export function sanitizeUserSnippet(input: string, maxWords: number = 10): string {
    const compact = (input || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const withoutPunctuation = compact.replace(/[?!.,;:()[\]{}"""''`]/g, '').trim();
    return withoutPunctuation.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

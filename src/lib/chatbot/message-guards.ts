export const OFF_TOPIC_PATTERN = /\b(pizzeria|ristorante|pizza|meteo|oroscopo|barzelletta|barzellett|calcio|partita|bitcoin|crypto|borsa|azioni|ricetta|cucina|film|serie tv|vacanza|viaggio)\b/i;

const SCOPE_STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are', 'about', 'into',
    'per', 'con', 'che', 'della', 'delle', 'degli', 'dello', 'dall', 'dallai', 'dei', 'del', 'nel',
    'nella', 'nelle', 'agli', 'allo', 'alla', 'alle', 'uno', 'una', 'sono', 'come', 'quale', 'quali',
    'cosa', 'fare', 'puoi', 'solo', 'tema', 'temi', 'obiettivo', 'ai', 'llm', 'business'
]);

export function normalizeScopeTokens(input: string): string[] {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9àèéìòù\s]/gi, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !SCOPE_STOPWORDS.has(t));
}

export function isExitIntentMessage(input: string): boolean {
    const text = input.trim().toLowerCase();
    if (!text) return false;
    return /\b(ciao|arrivederci|grazie\s*(mille|per|di tutto)?|a posto cosi|tutto chiaro|fine|basta|chiud|termin|stop|bye|thanks|that'?s all|we'?re done)\b/.test(text);
}

export function hasConfiguredScope(bot: { researchGoal?: string | null; topics?: Array<{ label?: string | null }> }): boolean {
    const hasGoal = typeof bot?.researchGoal === 'string' && bot.researchGoal.trim().length > 0;
    const hasTopics = Array.isArray(bot?.topics) && bot.topics.some((topic) => typeof topic?.label === 'string' && topic.label.trim().length > 0);
    return hasGoal || hasTopics;
}

export function isClearlyOutOfScope(message: string, scopeLexicon: Set<string>, scopeConfigured: boolean): boolean {
    const msgTokens = normalizeScopeTokens(message);
    const overlap = msgTokens.some((token) => scopeLexicon.has(token));

    if (OFF_TOPIC_PATTERN.test(message)) return !overlap;
    if (!scopeConfigured) return false;
    if (msgTokens.length < 3) return false;
    if (overlap) return false;

    return /\?|^\s*(cosa|come|dimmi|parlami|spiega|what|how|tell me|can you|could you)\b/i.test(message);
}

export function hasRecentHelpfulAssistantReply(messages: Array<{ role: string; content: string }>): boolean {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant || typeof lastAssistant.content !== 'string') return false;
    const text = lastAssistant.content.trim();
    return text.length >= 24 && !/\b(email|telefono|phone|contatto|contact|nome|name|company|azienda|budget|linkedin)\b/i.test(text);
}

export function isLeadCollectionQuestion(text: string, field: { field: string; question?: string } | null): boolean {
    if (!field || !text) return false;
    const lowered = text.toLowerCase();
    const questionLabel = (field.question || field.field).toLowerCase();
    return lowered.includes(questionLabel) || /\b(email|telefono|phone|contatto|contact|nome|name|company|azienda|budget|linkedin)\b/.test(lowered);
}

export function shouldCollectOnExit(params: {
    triggerStrategy: string;
    hasNextMissingField: boolean;
    hasExitIntent: boolean;
    totalUserMessages: number;
    recentlyAsked: boolean;
}): boolean {
    const { triggerStrategy, hasNextMissingField, hasExitIntent, totalUserMessages, recentlyAsked } = params;
    if (triggerStrategy !== 'on_exit') return false;
    return hasNextMissingField && hasExitIntent && totalUserMessages >= 2 && !recentlyAsked;
}

export function shouldAttemptLeadExtraction(params: {
    hasNextMissingField: boolean;
    shouldCollect: boolean;
    awaitingLeadReply: boolean;
}): boolean {
    const { hasNextMissingField, shouldCollect, awaitingLeadReply } = params;
    return hasNextMissingField && shouldCollect && awaitingLeadReply;
}

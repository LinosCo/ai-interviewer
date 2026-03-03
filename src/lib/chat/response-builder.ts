import { generateObject } from 'ai';
import { z } from 'zod';
import { buildTopicAnchors, buildMessageAnchors, responseMentionsAnchors } from '@/lib/interview/topic-anchors';
import type { Phase, SupervisorInsight, TransitionMode } from '@/lib/interview/interview-supervisor';
import { sanitizeUserSnippet } from './context-helpers';

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

export function isExtensionOfferQuestion(message: string, language: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text || !text.includes('?')) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(ti va di continuare|vuoi continuare|qualche minuto in più|hai ancora qualche minuto|hai disponibilità|estendere(?:\s+l')?\s*intervista|proseguire|ulteriore(?:i)? domanda(?:e)? di approfondimento)\b/i;
    const enPattern = /\b(would you like to continue|do you want to continue|few more minutes|are you available|extend the interview|continue for a few more minutes|follow-up questions|deep-dive questions)\b/i;
    return isItalian ? itPattern.test(text) : enPattern.test(text);
}

export async function generateConsentQuestionOnly(params: {
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

export async function generateFieldQuestionOnly(params: {
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

export function extractLastAssistantQuestion(input?: string | null): string {
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

export function getUserResponseDepth(input?: string | null): 'brief' | 'balanced' | 'rich' {
    const words = String(input || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    if (words <= 10) return 'brief';
    if (words >= 35) return 'rich';
    return 'balanced';
}

export function buildUserBridgeHint(input: string, language: string): string {
    const signal = sanitizeUserSnippet(input, 14);
    if (!signal) return '';
    return language === 'it'
        ? `Apri collegandoti semanticamente al punto utente su "${signal}" senza citazione letterale.`
        : `Open by semantically linking to the user point about "${signal}" without literal quoting.`;
}

export function buildRuntimeSemanticContextPrompt(params: {
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

export function buildSoftDiagnosticHint(params: {
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

export function escapeRegexLiteral(input: string): string {
    return String(input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceLiteralTopicTitle(text: string, topicLabel: string, replacement: string): string {
    const source = String(text || '').trim();
    const label = String(topicLabel || '').trim();
    const repl = String(replacement || '').trim();
    if (!source || !label || !repl) return source;
    const re = new RegExp(escapeRegexLiteral(label), 'gi');
    return source.replace(re, repl);
}

export function normalizeSingleQuestion(question: string): string {
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

export const GENERIC_BRIDGE_OPENERS_IT = [
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

export const GENERIC_BRIDGE_OPENERS_EN = [
    /^i see\b/i,
    /^got it\b/i,
    /^perfect\b/i,
    /^great\b/i,
    /^thanks\b/i,
    /^very interesting\b/i,
    /^that'?s an important point\b/i
];

export function normalizeBridgeStem(text: string): string {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function extractBridgeStem(text: string): string {
    const compact = String(text || '').trim();
    if (!compact) return '';
    const firstSentence = compact.split(/[?!\.]/)[0] || compact;
    return normalizeBridgeStem(firstSentence.split(',')[0]);
}

export function collectRecentBridgeStems(
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

export function startsWithGenericBridgeOpener(text: string, language: string): boolean {
    const firstSentence = String(text || '').trim().split(/[?!\.]/)[0] || '';
    const patterns = String(language || 'en').toLowerCase().startsWith('it')
        ? GENERIC_BRIDGE_OPENERS_IT
        : GENERIC_BRIDGE_OPENERS_EN;
    return patterns.some((pattern) => pattern.test(firstSentence.trim()));
}

export function isClarificationSignal(input: string, language: string): boolean {
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

export type UserTurnSignal = 'none' | 'clarification' | 'off_topic_question';

export function isLikelyUserQuestion(input: string, language: string): boolean {
    const text = String(input || '').trim().toLowerCase();
    if (!text) return false;
    if (text.includes('?')) return true;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itQuestionStarters = /^(come|cosa|perch[eé]|quando|dove|chi|quale|quali|quanto|in che modo|mi spieghi|puoi spiegare)/i;
    const enQuestionStarters = /^(how|what|why|when|where|who|which|can you|could you|would you|please explain)/i;
    return isItalian ? itQuestionStarters.test(text) : enQuestionStarters.test(text);
}

export function hasAnyAnchorOverlap(source: string[], target: string[]): boolean {
    if (!source.length || !target.length) return false;
    const targetSet = new Set(target);
    return source.some((root) => targetSet.has(root));
}

export function detectUserTurnSignal(params: {
    userMessage?: string | null;
    language: string;
    phase: Phase;
    currentTopic: any;
    targetTopic: any;
    interviewObjective?: string;
}): UserTurnSignal {
    const userMessage = String(params.userMessage || '').trim();
    if (!userMessage) return 'none';
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') return 'none';

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

export function isClarificationHandledResponse(response: string, language: string): boolean {
    const text = String(response || '');
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(per chiarire|intendo|mi riferivo|in altre parole|pi[uù] chiaramente|cio[eè]|parlavo di)\b/i;
    const enPattern = /\b(to clarify|i meant|i was referring to|in other words|more clearly|that is|i was talking about)\b/i;
    return (isItalian ? itPattern.test(text) : enPattern.test(text)) && text.includes('?');
}

export function isScopeBoundaryHandledResponse(response: string, language: string): boolean {
    const text = String(response || '');
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const itPattern = /\b(fuori(?:\s+dallo)?\s+scopo|esula dallo scopo|nell'ambito di questa intervista|restiamo su|torniamo a|per questa intervista)\b/i;
    const enPattern = /\b(out of scope|outside the scope|for this interview|let's stay on|let's get back to|within this interview)\b/i;
    return (isItalian ? itPattern.test(text) : enPattern.test(text)) && text.includes('?');
}

export function buildNaturalTopicCue(topicLabel: string, language: string): string {
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

export const GENERIC_TOPIC_ANCHORS_IT = new Set([
    'tema', 'temi', 'aspetto', 'aspetti', 'punto', 'punti',
    'progetto', 'progetti', 'iniziativa', 'iniziative', 'azienda', 'aziende',
    'soluzione', 'soluzioni', 'impatto', 'valore', 'processo', 'processi',
    'sistema', 'sistemi', 'approccio', 'uso'
]);

export const GENERIC_TOPIC_ANCHORS_EN = new Set([
    'topic', 'topics', 'aspect', 'aspects', 'point', 'points',
    'project', 'projects', 'initiative', 'initiatives', 'company', 'companies',
    'solution', 'solutions', 'impact', 'value', 'process', 'processes',
    'system', 'systems', 'approach', 'usage', 'use'
]);

export function getGenericTopicAnchors(language: string): Set<string> {
    return (language || 'en').toLowerCase().startsWith('it')
        ? GENERIC_TOPIC_ANCHORS_IT
        : GENERIC_TOPIC_ANCHORS_EN;
}

export function hasMeaningfulTopicOverlap(params: {
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

export function isUsableBridgeSnippet(snippet: string, language: string): boolean {
    const clean = String(snippet || '').replace(/\s+/g, ' ').trim();
    if (!clean) return false;
    if (isClarificationSignal(clean, language)) return false;

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 3) return false;

    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const lowSignalPattern = isItalian
        ? /\b(te l['']?ho gi[aà] detto|non capisco|preferisco non dirlo|boh|ok|s[iì]|no)\b/i
        : /\b(i already told you|i don.t understand|prefer not to say|ok|yes|no)\b/i;
    return !lowSignalPattern.test(clean);
}

import { buildMessageAnchors, responseMentionsAnchors } from './topic-anchors';

export type QualitativePhase = 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION';

export interface QualitativeEvalInput {
    phase: QualitativePhase;
    topicLabel: string;
    userResponse: string;
    assistantResponse: string;
    previousAssistantResponse?: string | null;
    language?: string;
}

export interface QualitativeEvalChecks {
    oneQuestion: boolean;
    avoidsClosure: boolean;
    avoidsPrematureContact: boolean;
    referencesUserContext: boolean;
    topicalAnchor: boolean;
    nonRepetitive: boolean;
    probingWhenUserIsBrief: boolean;
    deepOfferIntent: boolean;
}

export interface QualitativeEvalResult {
    passed: boolean;
    score: number;
    checks: QualitativeEvalChecks;
    issues: string[];
}

const CLOSURE_IT = /\b(arrivederci|buona giornata|buona serata|a presto|grazie per il tuo tempo|è stato un piacere|ti contatteremo|ti terremo aggiornato)\b/i;
const CLOSURE_EN = /\b(goodbye|have a great day|it was a pleasure|we'll be in touch|we will contact you)\b/i;
const CONTACT_REQUEST_IT = /\b(email|mail|numero|telefono|contatti|come ti chiami|nome e cognome)\b/i;
const CONTACT_REQUEST_EN = /\b(email|phone|contact details|what is your name|full name)\b/i;

const BRIDGE_IT = /\b(hai menzionato|da quello che hai detto|quindi|mi sembra che|se ho capito bene)\b/i;
const BRIDGE_EN = /\b(you mentioned|from what you said|so you|if i understood|it sounds like)\b/i;

const PROBE_IT = /\b(puoi|potresti|mi racconti|in che modo|cosa intendi|farmi un esempio)\b/i;
const PROBE_EN = /\b(could you|can you|tell me more|what do you mean|share an example|in what way)\b/i;

const DEEP_OFFER_IT = /\b(continuare|proseguire|approfondire|qualche altra domanda|hai ancora tempo|ti va di)\b/i;
const DEEP_OFFER_EN = /\b(continue|deeper|few more questions|a bit more time|would you like to continue)\b/i;

function normalizeText(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenSet(input: string): Set<string> {
    const normalized = normalizeText(input);
    if (!normalized) return new Set<string>();
    return new Set(normalized.split(' ').filter(t => t.length >= 3));
}

function jaccardSimilarity(a: string, b: string): number {
    const aSet = tokenSet(a);
    const bSet = tokenSet(b);
    if (aSet.size === 0 || bSet.size === 0) return 0;

    let intersection = 0;
    for (const token of aSet) {
        if (bSet.has(token)) intersection++;
    }
    const union = aSet.size + bSet.size - intersection;
    return union > 0 ? intersection / union : 0;
}

export function evaluateInterviewQuestionQuality(input: QualitativeEvalInput): QualitativeEvalResult {
    const language = (input.language || 'en').toLowerCase();
    const isItalian = language.startsWith('it');
    const closurePattern = isItalian ? CLOSURE_IT : CLOSURE_EN;
    const contactPattern = isItalian ? CONTACT_REQUEST_IT : CONTACT_REQUEST_EN;
    const bridgePattern = isItalian ? BRIDGE_IT : BRIDGE_EN;
    const probePattern = isItalian ? PROBE_IT : PROBE_EN;
    const deepOfferPattern = isItalian ? DEEP_OFFER_IT : DEEP_OFFER_EN;
    const isTopicPhase = input.phase === 'SCAN' || input.phase === 'DEEP';

    const questionCount = (input.assistantResponse.match(/\?/g) || []).length;
    const oneQuestion = questionCount === 1;
    const avoidsClosure = !closurePattern.test(input.assistantResponse);
    const avoidsPrematureContact = input.phase === 'DATA_COLLECTION' ? true : !contactPattern.test(input.assistantResponse);

    const topicRoots = buildMessageAnchors(input.topicLabel || '', language).anchorRoots;
    const userRoots = buildMessageAnchors(input.userResponse || '', language).anchorRoots;

    const topicalAnchor = !isTopicPhase || topicRoots.length === 0 || responseMentionsAnchors(input.assistantResponse, topicRoots);
    const referencesUserContext =
        !isTopicPhase ||
        userRoots.length === 0 ||
        responseMentionsAnchors(input.assistantResponse, userRoots) ||
        bridgePattern.test(input.assistantResponse);

    const previous = input.previousAssistantResponse || '';
    const nonRepetitive = !isTopicPhase || (previous ? jaccardSimilarity(previous, input.assistantResponse) < 0.75 : true);

    const userWordCount = (normalizeText(input.userResponse).split(' ').filter(Boolean)).length;
    const probingWhenUserIsBrief = !isTopicPhase || userWordCount > 4 || probePattern.test(input.assistantResponse);

    const deepOfferIntent = input.phase !== 'DEEP_OFFER' || deepOfferPattern.test(input.assistantResponse);

    const checks: QualitativeEvalChecks = {
        oneQuestion,
        avoidsClosure,
        avoidsPrematureContact,
        referencesUserContext,
        topicalAnchor,
        nonRepetitive,
        probingWhenUserIsBrief,
        deepOfferIntent
    };

    const issues: string[] = [];
    if (!checks.oneQuestion) issues.push('La risposta deve contenere esattamente una domanda.');
    if (!checks.avoidsClosure) issues.push('Ha usato una formula di chiusura in una fase non di chiusura.');
    if (!checks.avoidsPrematureContact) issues.push('Ha chiesto contatti in una fase dove non dovrebbe.');
    if (!checks.referencesUserContext) issues.push('Non si aggancia chiaramente alla risposta dell’utente.');
    if (!checks.topicalAnchor) issues.push('La domanda sembra fuori topic rispetto al tema corrente.');
    if (!checks.nonRepetitive) issues.push('La domanda è troppo simile a quella precedente.');
    if (!checks.probingWhenUserIsBrief) issues.push('Con risposta breve dell’utente, manca probing qualitativo.');
    if (!checks.deepOfferIntent) issues.push('In DEEP_OFFER non sta davvero chiedendo se proseguire.');

    const passed = Object.values(checks).every(Boolean);
    const passedCount = Object.values(checks).filter(Boolean).length;
    const score = Math.round((passedCount / Object.keys(checks).length) * 100);

    return {
        passed,
        score,
        checks,
        issues
    };
}

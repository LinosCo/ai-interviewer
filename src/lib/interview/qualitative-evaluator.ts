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
    coherentTransition: boolean;
    handlesClarificationNaturally: boolean;
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
const PIVOT_IT = /\b(riguardo|in merito|passando|spostandoci|invece|sul tema)\b/i;
const PIVOT_EN = /\b(regarding|about|switching to|moving to|as for|when it comes to)\b/i;

const PROBE_IT = /\b(puoi|potresti|mi racconti|in che modo|cosa intendi|farmi un esempio)\b/i;
const PROBE_EN = /\b(could you|can you|tell me more|what do you mean|share an example|in what way)\b/i;

const DEEP_OFFER_IT = /\b(ti va di continuare|vuoi continuare|hai(?:\s+ancora)?\s+(?:qualche|un paio di)?\s*minut[oi]|hai tempo per continuare|proseguire con(?:\s+qualche)?\s+domanda|estendere(?:\s+l')?\s*intervista)\b/i;
const DEEP_OFFER_EN = /\b(would you like to continue|do you want to continue|do you have (?:a few|a couple of)?\s*more minutes|can we continue with (?:a few )?deeper questions|extend the interview)\b/i;
const CONFUSION_IT = /\b(non capisco|non ho capito|non mi è chiaro|puoi chiarire|puoi spiegare meglio)\b/i;
const CONFUSION_EN = /\b(i don't understand|i do not understand|not clear|can you clarify|can you explain)\b/i;
const ECHO_BRIDGE_IT = /\b(hai detto|hai menzionato)\b/i;
const ECHO_BRIDGE_EN = /\b(you said|you mentioned)\b/i;
const REPHRASE_IT = /\b(riformul|in modo semplice|te la rendo piu chiara|detto in altro modo)\b/i;
const REPHRASE_EN = /\b(let me rephrase|in simple terms|put differently|another way to say this)\b/i;

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
    const pivotPattern = isItalian ? PIVOT_IT : PIVOT_EN;
    const probePattern = isItalian ? PROBE_IT : PROBE_EN;
    const deepOfferPattern = isItalian ? DEEP_OFFER_IT : DEEP_OFFER_EN;
    const confusionPattern = isItalian ? CONFUSION_IT : CONFUSION_EN;
    const echoBridgePattern = isItalian ? ECHO_BRIDGE_IT : ECHO_BRIDGE_EN;
    const rephrasePattern = isItalian ? REPHRASE_IT : REPHRASE_EN;
    const isTopicPhase = input.phase === 'SCAN' || input.phase === 'DEEP';

    const questionCount = (input.assistantResponse.match(/\?/g) || []).length;
    const oneQuestion = questionCount === 1;
    const avoidsClosure = !closurePattern.test(input.assistantResponse);
    const avoidsPrematureContact = input.phase === 'DATA_COLLECTION' ? true : !contactPattern.test(input.assistantResponse);

    const topicRoots = buildMessageAnchors(input.topicLabel || '', language).anchorRoots;
    const userRoots = buildMessageAnchors(input.userResponse || '', language).anchorRoots;
    const assistantRoots = buildMessageAnchors(input.assistantResponse || '', language).anchorRoots;
    const userWordCount = (normalizeText(input.userResponse).split(' ').filter(Boolean)).length;

    const topicalAnchor = !isTopicPhase || topicRoots.length === 0 || responseMentionsAnchors(input.assistantResponse, topicRoots);
    const userTouchesTopic = !isTopicPhase || topicRoots.length === 0 || responseMentionsAnchors(input.userResponse || '', topicRoots);
    const userOverlapCount = userRoots.reduce((count, root) => count + (assistantRoots.includes(root) ? 1 : 0), 0);
    const userOverlapRatio = userRoots.length > 0 ? userOverlapCount / userRoots.length : 0;
    const hasUserAnchorMention = userRoots.length > 0 && responseMentionsAnchors(input.assistantResponse, userRoots);
    const hasBridgeCue = bridgePattern.test(input.assistantResponse);
    const referencesUserContext =
        !isTopicPhase ||
        userRoots.length === 0 ||
        hasUserAnchorMention ||
        (userWordCount <= 3 && hasBridgeCue);

    const previous = input.previousAssistantResponse || '';
    const nonRepetitive = !isTopicPhase || (previous ? jaccardSimilarity(previous, input.assistantResponse) < 0.68 : true);

    const probingWhenUserIsBrief = !isTopicPhase || userWordCount > 4 || probePattern.test(input.assistantResponse);

    const deepOfferIntent = input.phase !== 'DEEP_OFFER' || deepOfferPattern.test(input.assistantResponse);
    const assistantUsesEchoBridge = echoBridgePattern.test(input.assistantResponse) && /["“”']/.test(input.assistantResponse);
    const assistantUsesLiteralEcho = assistantUsesEchoBridge || (userRoots.length >= 3 && userOverlapRatio >= 0.75 && /[:;]/.test(input.assistantResponse));
    const hasPreviousAssistant = Boolean((input.previousAssistantResponse || '').trim());
    const coherentTransition = !isTopicPhase || !hasPreviousAssistant || userTouchesTopic || (!assistantUsesLiteralEcho && pivotPattern.test(input.assistantResponse));
    const userSignalsConfusion = confusionPattern.test(input.userResponse || '');
    const handlesClarificationNaturally = !isTopicPhase || !userSignalsConfusion || (!assistantUsesLiteralEcho && rephrasePattern.test(input.assistantResponse));

    const checks: QualitativeEvalChecks = {
        oneQuestion,
        avoidsClosure,
        avoidsPrematureContact,
        referencesUserContext,
        topicalAnchor,
        nonRepetitive,
        probingWhenUserIsBrief,
        deepOfferIntent,
        coherentTransition,
        handlesClarificationNaturally
    };

    const issues: string[] = [];
    if (!checks.oneQuestion) issues.push('La risposta deve contenere esattamente una domanda.');
    if (!checks.avoidsClosure) issues.push('Ha usato una formula di chiusura in una fase non di chiusura.');
    if (!checks.avoidsPrematureContact) issues.push('Ha chiesto contatti in una fase dove non dovrebbe.');
    if (!checks.referencesUserContext) issues.push('Non si aggancia chiaramente alla risposta dell’utente.');
    if (!checks.topicalAnchor) issues.push('La domanda sembra fuori topic rispetto al tema corrente.');
    if (!checks.nonRepetitive) issues.push('La domanda è troppo simile a quella precedente.');
    if (!checks.probingWhenUserIsBrief) issues.push('Con risposta breve dell’utente, manca probing qualitativo.');
    if (!checks.deepOfferIntent) issues.push('In EXTENSION_OFFER non sta davvero chiedendo se proseguire.');
    if (!checks.coherentTransition) issues.push('Transizione poco coerente: riusa la risposta utente senza connessione al topic corrente.');
    if (!checks.handlesClarificationNaturally) issues.push('Gestione poco naturale della richiesta di chiarimento: evita echo letterale.');

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

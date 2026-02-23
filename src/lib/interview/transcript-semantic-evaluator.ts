import { buildMessageAnchors, responseMentionsAnchors } from './topic-anchors';
// NOTE: Disabled in v2 - quality pipeline removed
// import { evaluateInterviewQuestionQuality, type QualitativePhase } from './qualitative-evaluator';
// Backward compatible type that includes both old and new phase names for script compatibility
export type QualitativePhase = 'EXPLORE' | 'DEEPEN' | 'DEEP_OFFER' | 'DATA_COLLECTION' | 'SCAN' | 'DEEP';

export interface TranscriptSemanticTurn {
    role: 'user' | 'assistant';
    content: string;
    phase?: QualitativePhase;
    topicLabel?: string;
}

export interface TranscriptSemanticChecks {
    semanticUnderstanding: boolean;
    meaningRespect: boolean;
    consentInterpretation: boolean;
    nonRepetitiveNonGeneric: boolean;
    engagementQuality: boolean;
    interestingSignalCapture: boolean;
    transitionCoherence: boolean;
}

export interface TranscriptSemanticTurnResult {
    turnIndex: number;
    topicLabel: string;
    phase: QualitativePhase;
    passed: boolean;
    score: number;
    isTransition: boolean;
    checks: TranscriptSemanticChecks;
    issues: string[];
}

export interface TranscriptSemanticResult {
    passed: boolean;
    score: number;
    evaluatedTurns: number;
    failedTurns: number;
    transitionTurns: number;
    transitionFailures: number;
    consentTurns: number;
    consentFailures: number;
    issues: string[];
    turns: TranscriptSemanticTurnResult[];
}

const BRIDGE_IT = /\b(interessante|capisco|quello che dici|hai menzionato|riguardo|in merito|su questo punto)\b/i;
const BRIDGE_EN = /\b(interesting|i see|what you said|you mentioned|regarding|about this|on this point)\b/i;
const PROBE_IT = /\b(puoi|potresti|in che modo|quale impatto|farmi un esempio|raccontarmi)\b/i;
const PROBE_EN = /\b(could you|can you|in what way|what impact|example|tell me more)\b/i;
const CONFUSION_IT = /\b(non capisco|non ho capito|non mi è chiaro|puoi chiarire|puoi spiegare meglio)\b/i;
const CONFUSION_EN = /\b(i don't understand|i do not understand|not clear|can you clarify|can you explain)\b/i;
const ECHO_BRIDGE_IT = /\b(hai detto|hai menzionato)\b[^?]*["“”'][^"“”']+["“”']/i;
const ECHO_BRIDGE_EN = /\b(you said|you mentioned)\b[^?]*["“”'][^"“”']+["“”']/i;
const GENERIC_Q_IT = /\b(cosa ne pensi\??|come la vedi\??|mi racconti di piu\??|c e altro\??)\b/i;
const GENERIC_Q_EN = /\b(what do you think\??|any other thoughts\??|tell me more\??)\b/i;
const CONSENT_ASK_IT = /\b(posso (chiederti|raccogliere).*(contatt\w*|dati?)|permesso.*(contatt\w*|dati?))\b/i;
const CONSENT_ASK_EN = /\b(may i ask.*contact|permission.*contact|collect.*contact(?: details)?)\b/i;
const CONSENT_ACCEPT_IT = /\b(si|sì|va bene|ok|certo|procedi|autorizzo)\b/i;
const CONSENT_ACCEPT_EN = /\b(yes|sure|ok|go ahead|i agree)\b/i;
const CONSENT_REFUSE_IT = /\b(no|preferisco di no|non voglio|non autorizzo|no grazie)\b/i;
const CONSENT_REFUSE_EN = /\b(no|i prefer not|i do not want|i don't want|no thanks)\b/i;
const FIELD_ASK_IT = /\b(nome|chiami|cognome|email|mail|telefono|numero|azienda|ruolo|linkedin)\b/i;
const FIELD_ASK_EN = /\b(name|email|phone|company|role|linkedin)\b/i;
const CLOSURE_IT = /\b(grazie|intervista conclusa|arrivederci|buona giornata|a presto)\b/i;
const CLOSURE_EN = /\b(thank you|interview completed|goodbye|have a great day)\b/i;

function inferPhase(phase: QualitativePhase | undefined): QualitativePhase {
    if (phase === 'DEEP') return 'DEEP';
    if (phase === 'DEEP_OFFER') return 'DEEP_OFFER';
    if (phase === 'DATA_COLLECTION') return 'DATA_COLLECTION';
    return 'SCAN';
}

function normalizeText(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function wordCount(input: string): number {
    return normalizeText(input).split(/\s+/).filter(Boolean).length;
}

function hasNaturalPivot(text: string, language: string): boolean {
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    return isItalian
        ? /\b(riguardo|in merito|sul tema|su questo punto)\b/i.test(text)
        : /\b(regarding|about|in relation to|on this point)\b/i.test(text);
}

function isContextBridgeIssue(issue: string): boolean {
    return /aggancia chiaramente alla risposta dell.utente/i.test(issue);
}

function isBriefProbeIssue(issue: string): boolean {
    return /risposta breve dell.utente.*probing/i.test(issue);
}

function isConfusionSignal(userText: string, language: string): boolean {
    const text = normalizeText(userText);
    if (!text) return false;
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    return isItalian ? CONFUSION_IT.test(text) : CONFUSION_EN.test(text);
}

function isInterestingUserResponse(userText: string, language: string): boolean {
    const text = normalizeText(userText);
    if (!text) return false;
    const words = wordCount(text);
    const hasNumbers = /\b\d{1,4}\b/.test(text);
    const isItalian = (language || 'en').toLowerCase().startsWith('it');
    const specificity = isItalian
        ? /\b(caso|esempio|progetto|azienda|cliente|team|processo|strategia|problema)\b/i
        : /\b(case|example|project|company|client|team|process|strategy|issue)\b/i;
    return words >= 12 || hasNumbers || specificity.test(text);
}

function hasAnchorOverlap(aText: string, bText: string, language: string): boolean {
    const aRoots = buildMessageAnchors(aText || '', language).anchorRoots;
    if (aRoots.length === 0) return false;
    return responseMentionsAnchors(bText || '', aRoots);
}

// NOTE: Disabled in v2 - quality pipeline removed
export function evaluateTranscriptSemanticFlow(params: {
    turns: TranscriptSemanticTurn[];
    language?: string;
}): TranscriptSemanticResult {
    // Stub implementation - quality pipeline removed in v2
    return {
        passed: true,
        score: 100,
        evaluatedTurns: 0,
        failedTurns: 0,
        transitionTurns: 0,
        transitionFailures: 0,
        consentTurns: 0,
        consentFailures: 0,
        issues: [],
        turns: []
    };

    /* DISABLED IN V2
    const language = params.language || 'it';
    const isItalian = language.toLowerCase().startsWith('it');
    const bridgePattern = isItalian ? BRIDGE_IT : BRIDGE_EN;
    const probePattern = isItalian ? PROBE_IT : PROBE_EN;
    const genericPattern = isItalian ? GENERIC_Q_IT : GENERIC_Q_EN;
    const consentAskPattern = isItalian ? CONSENT_ASK_IT : CONSENT_ASK_EN;
    const consentAcceptPattern = isItalian ? CONSENT_ACCEPT_IT : CONSENT_ACCEPT_EN;
    const consentRefusePattern = isItalian ? CONSENT_REFUSE_IT : CONSENT_REFUSE_EN;
    const fieldAskPattern = isItalian ? FIELD_ASK_IT : FIELD_ASK_EN;
    const closurePattern = isItalian ? CLOSURE_IT : CLOSURE_EN;
    const echoPattern = isItalian ? ECHO_BRIDGE_IT : ECHO_BRIDGE_EN;

    const turns = params.turns || [];
    const assistantTurns = turns
        .map((turn, idx) => ({ ...turn, idx }))
        .filter(turn => turn.role === 'assistant');

    const results: TranscriptSemanticTurnResult[] = [];
    let transitionTurns = 0;
    let transitionFailures = 0;
    let consentTurns = 0;
    let consentFailures = 0;

    for (const assistant of assistantTurns) {
        const previousMessages = turns.slice(0, assistant.idx);
        const prevUser = [...previousMessages].reverse().find(t => t.role === 'user');
        const prevAssistant = [...previousMessages].reverse().find(t => t.role === 'assistant');
        const userResponse = prevUser?.content || '';
        const phase = inferPhase(assistant.phase);
        const topicLabel = (assistant.topicLabel || '').trim();
        const previousTopicLabel = (prevAssistant?.topicLabel || '').trim();
        const isTransition = Boolean(topicLabel && previousTopicLabel && topicLabel !== previousTopicLabel);

        const base = evaluateInterviewQuestionQuality({
            phase,
            topicLabel,
            userResponse,
            assistantResponse: assistant.content,
            previousAssistantResponse: prevAssistant?.content || null,
            language
        });

        const userOverlap = hasAnchorOverlap(userResponse, assistant.content, language);
        const userTouchesTopic = topicLabel ? hasAnchorOverlap(topicLabel, userResponse, language) : false;
        const userConfused = isConfusionSignal(userResponse, language);
        const assistantUsesEcho = echoPattern.test(assistant.content);
        const assistantIsGeneric = genericPattern.test(assistant.content);
        const userInteresting = isInterestingUserResponse(userResponse, language);
        const hasProbe = probePattern.test(assistant.content);
        const hasBridge = bridgePattern.test(assistant.content);
        const hasPivot = hasNaturalPivot(assistant.content, language);

        let consentInterpretation = true;
        if (prevAssistant && prevUser && consentAskPattern.test(prevAssistant.content)) {
            consentTurns++;
            const userAccepted = consentAcceptPattern.test(prevUser.content);
            const userRefused = consentRefusePattern.test(prevUser.content);
            const asksField = fieldAskPattern.test(assistant.content);
            const asksConsentAgain = consentAskPattern.test(assistant.content);
            const closes = closurePattern.test(assistant.content) || /INTERVIEW_COMPLETED/i.test(assistant.content);

            if (userAccepted) {
                consentInterpretation = asksField && !asksConsentAgain;
            } else if (userRefused) {
                consentInterpretation = closes || (!asksField && !asksConsentAgain);
            }
        }

        const checks: TranscriptSemanticChecks = {
            semanticUnderstanding: phase === 'DATA_COLLECTION'
                ? true
                : (userOverlap || (hasBridge && hasProbe) || (isTransition && hasPivot)),
            meaningRespect: !assistantUsesEcho,
            consentInterpretation,
            nonRepetitiveNonGeneric: base.checks.nonRepetitive && !assistantIsGeneric,
            engagementQuality: phase === 'DATA_COLLECTION'
                ? true
                : (isTransition ? (!assistantIsGeneric && (hasProbe || hasPivot)) : (hasProbe && !assistantIsGeneric)),
            interestingSignalCapture: !userInteresting || (isTransition && !userTouchesTopic) || (hasProbe && (userOverlap || hasBridge)),
            transitionCoherence: !isTransition || (userTouchesTopic ? (!assistantUsesEcho && (hasBridge || hasPivot)) : (!assistantUsesEcho && hasPivot && !assistantIsGeneric))
        };

        const issues = [...base.issues];
        const userTouchesCurrentTopic = topicLabel ? hasAnchorOverlap(topicLabel, userResponse, language) : false;
        const filteredIssues = issues.filter(issue => {
            if (isTransition && !userTouchesCurrentTopic && (isContextBridgeIssue(issue) || isBriefProbeIssue(issue))) {
                return false;
            }
            return true;
        });
        const normalizedIssues = [...filteredIssues];
        if (!checks.semanticUnderstanding) {
            normalizedIssues.push('Non sembra comprendere semanticamente la risposta utente prima del follow-up.');
        }
        if (!checks.meaningRespect) {
            normalizedIssues.push('Riformula in modo forzato: echo della risposta invece di rispettarne il significato.');
        }
        if (!checks.consentInterpretation) {
            normalizedIssues.push('Interpretazione consenso/non consenso non coerente con la risposta utente.');
        }
        if (!checks.nonRepetitiveNonGeneric) {
            normalizedIssues.push('Domanda ripetitiva o troppo generica.');
        }
        if (!checks.engagementQuality) {
            normalizedIssues.push('Follow-up poco ingaggiante: manca approfondimento naturale.');
        }
        if (!checks.interestingSignalCapture) {
            normalizedIssues.push('Non valorizza i segnali interessanti della risposta utente.');
        }
        if (!checks.transitionCoherence) {
            normalizedIssues.push('Transizione topic non coerente semanticamente.');
        }
        if (userConfused && assistantUsesEcho) {
            normalizedIssues.push('Gestione chiarimento non naturale: serve riformulare senza echo.');
        }

        const uniqueIssues = Array.from(new Set(normalizedIssues));
        const passed = uniqueIssues.length === 0;
        const passedChecks = Object.values(checks).filter(Boolean).length;
        const baseScore = Math.round((passedChecks / Object.keys(checks).length) * 100);
        const score = Math.max(0, baseScore - (isTransition && !checks.transitionCoherence ? 8 : 0));
        if (isTransition) {
            transitionTurns++;
            if (!checks.transitionCoherence) transitionFailures++;
        }
        if (!checks.consentInterpretation) consentFailures++;

        results.push({
            turnIndex: assistant.idx,
            topicLabel,
            phase,
            passed,
            score,
            isTransition,
            checks,
            issues: uniqueIssues
        });
    }

    const evaluatedTurns = results.length;
    const failedTurns = results.filter(r => !r.passed).length;
    const avgScore = evaluatedTurns > 0
        ? Math.round(results.reduce((acc, item) => acc + item.score, 0) / evaluatedTurns)
        : 0;

    const issueCounts = new Map<string, number>();
    for (const result of results) {
        for (const issue of result.issues) {
            issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
        }
    }
    const issues = [...issueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([issue, count]) => `${issue} (${count})`);

    return {
        passed: failedTurns === 0,
        score: avgScore,
        evaluatedTurns,
        failedTurns,
        transitionTurns,
        transitionFailures,
        consentTurns,
        consentFailures,
        issues,
        turns: results
    };
    */
}

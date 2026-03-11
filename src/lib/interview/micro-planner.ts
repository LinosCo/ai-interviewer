import type { RuntimeInterviewKnowledge } from './runtime-knowledge';

export type MicroPlannerPhase = 'EXPLORE' | 'DEEPEN' | 'DEEP_OFFER' | 'DATA_COLLECTION';
export type UserTurnSignal = 'none' | 'clarification' | 'off_topic_question';

export interface MicroPlannerInput {
    language: string;
    phase: MicroPlannerPhase;
    topicId: string;
    topicLabel: string;
    topicSubGoals: string[];
    usedSubGoals?: string[];
    turnInTopic: number;
    maxTurnsInTopic: number;
    userMessage?: string | null;
    userTurnSignal?: UserTurnSignal;
    previousAssistantQuestion?: string | null;
    manualGuide?: string | null;
    runtimeKnowledge?: RuntimeInterviewKnowledge | null;
    // Naturalness (avanzato)
    topicKeyInsights?: Record<string, string>;
    naturalness?: {
        crossTopicSynthesis: boolean;
        hesitationDetection: boolean;
        contextDrivenReordering: boolean;
    };
}

type KnowledgeCueSource = 'runtime' | 'manual' | 'fallback';

interface PreloadedKnowledgeCue {
    source: KnowledgeCueSource;
    interpretationCue: string;
    significanceCue: string;
    probeCue: string;
}

export interface MicroPlannerDecision {
    mode: 'cover_subgoal' | 'probe_example' | 'probe_impact' | 'probe_constraint';
    commentStyle: 'direct_clarification' | 'evidence_reflection' | 'neutral_bridge';
    focusSubGoal: string;
    followupHint: string;
    topicCoverage: {
        total: number;
        used: number;
        remaining: number;
        turnsLeft: number;
        prioritizeCoverage: boolean;
    };
    signalScore: number;
    knowledgeSource: KnowledgeCueSource;
    // Naturalness hints (avanzato only)
    crossTopicHint?: string | null;
    hesitationHint?: string | null;
}

function normalizeText(input: string): string {
    return String(input || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function toLowerAscii(input: string): string {
    return normalizeText(input).toLowerCase();
}

function containsAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
}

function computeSignalScore(userMessage: string, language: string): number {
    const text = String(userMessage || '').trim();
    if (!text) return 0;

    const words = text.split(/\s+/).filter(Boolean).length;
    const lengthScore = Math.min(1, words / 55);

    const isItalian = (language || '').toLowerCase().startsWith('it');
    const causeEffectPatterns = isItalian
        ? [/\bperche\b/i, /\bquindi\b/i, /\bdi conseguenza\b/i, /\bha portato\b/i]
        : [/\bbecause\b/i, /\btherefore\b/i, /\bas a result\b/i, /\bled to\b/i];
    const examplePatterns = isItalian
        ? [/\bad esempio\b/i, /\bper esempio\b/i, /\bcaso\b/i, /\bepisodio\b/i]
        : [/\bfor example\b/i, /\bfor instance\b/i, /\bcase\b/i, /\bincident\b/i];
    const impactPatterns = isItalian
        ? [/\bdecision/i, /\btempo\b/i, /\bcosto\b/i, /\bqualita\b/i, /\bmercato\b/i]
        : [/\bdecision\b/i, /\btime\b/i, /\bcost\b/i, /\bquality\b/i, /\bmarket\b/i];

    // Require ≥10 words to avoid rewarding single-digit scale answers ("8", "7/10") as numeric richness
    const hasNumbers = /\b\d{1,4}\b/.test(text) && words >= 10 ? 1 : 0;
    const hasCauseEffect = containsAny(text, causeEffectPatterns) ? 1 : 0;
    const hasExample = containsAny(text, examplePatterns) ? 1 : 0;
    const hasImpact = containsAny(text, impactPatterns) ? 1 : 0;

    const score = (
        lengthScore * 0.42 +
        hasCauseEffect * 0.22 +
        hasExample * 0.18 +
        hasImpact * 0.12 +
        hasNumbers * 0.06
    );

    return Math.max(0, Math.min(1, score));
}

function pickFirst(items: Array<string | null | undefined>, fallback: string): string {
    for (const item of items) {
        const normalized = normalizeText(item || '');
        if (normalized) return normalized.slice(0, 180);
    }
    return normalizeText(fallback).slice(0, 180);
}

function extractRuntimeCue(
    runtimeKnowledge: RuntimeInterviewKnowledge | null | undefined,
    topicId: string,
    topicLabel: string
): PreloadedKnowledgeCue | null {
    if (!runtimeKnowledge || !Array.isArray(runtimeKnowledge.topics)) return null;
    const topic = runtimeKnowledge.topics.find((item) => item.topicId === topicId) || runtimeKnowledge.topics[0];
    if (!topic) return null;

    return {
        source: 'runtime',
        interpretationCue: pickFirst(
            topic.interpretationCues,
            `Leggi la risposta rispetto al tema "${topicLabel}".`
        ),
        significanceCue: pickFirst(
            topic.significanceSignals,
            'Cerca segnali concreti di impatto operativo.'
        ),
        probeCue: pickFirst(
            topic.probeAngles,
            'Chiedi un esempio specifico recente.'
        )
    };
}

function extractManualTopicSection(
    manualGuide: string,
    topicLabel: string
): string[] {
    const lines = String(manualGuide || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.length) return [];

    const topicNorm = toLowerAscii(topicLabel);
    let startIndex = -1;

    for (let idx = 0; idx < lines.length; idx++) {
        const lineNorm = toLowerAscii(lines[idx]);
        if (!lineNorm.startsWith('## topic')) continue;
        if (lineNorm.includes(topicNorm)) {
            startIndex = idx;
            break;
        }
    }

    if (startIndex === -1) {
        return [];
    }

    const section: string[] = [];
    for (let idx = startIndex + 1; idx < lines.length; idx++) {
        const line = lines[idx];
        if (/^##\s+/i.test(line)) break;
        section.push(line);
    }
    return section;
}

function extractManualCue(
    manualGuide: string | null | undefined,
    topicLabel: string,
    topicSubGoals: string[],
    language: string
): PreloadedKnowledgeCue | null {
    const guide = String(manualGuide || '').trim();
    if (!guide) return null;
    const section = extractManualTopicSection(guide, topicLabel);
    if (!section.length) return null;

    const bulletLines = section
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) => normalizeText(line.replace(/^[-*]\s+/, '')))
        .filter(Boolean);

    const isItalian = (language || '').toLowerCase().startsWith('it');
    const interpretationHints = bulletLines.filter((line) =>
        /(come|cosa capire|valuta|distinguere|how|what to understand|assess|separate)/i.test(line)
    );
    const significanceHints = bulletLines.filter((line) =>
        /(segnali|indicatori|impatto|decision|frizion|opportunit|signals|impact|friction|missed)/i.test(line)
    );
    const probeHints = bulletLines.filter((line) =>
        /(follow-up|puoi|chiedi|raccontami|esempio|can you|ask|example)/i.test(line)
    );

    const fallbackSubGoal = topicSubGoals[0] || topicLabel;
    return {
        source: 'manual',
        interpretationCue: pickFirst(
            interpretationHints,
            isItalian
                ? `Interpreta la risposta rispetto a "${fallbackSubGoal}" distinguendo situazione attuale e obiettivo.`
                : `Interpret the response on "${fallbackSubGoal}" by separating current state and target outcome.`
        ),
        significanceCue: pickFirst(
            significanceHints,
            isItalian
                ? 'Cerca segnali concreti: impatto su decisioni, tempi, qualita o mercato.'
                : 'Look for concrete signals: impact on decisions, timing, quality, or market.'
        ),
        probeCue: pickFirst(
            probeHints,
            isItalian
                ? 'Approfondisci con un esempio reale recente.'
                : 'Deepen using one concrete recent example.'
        )
    };
}

function buildFallbackCue(language: string, topicLabel: string, focusSubGoal: string): PreloadedKnowledgeCue {
    const isItalian = (language || '').toLowerCase().startsWith('it');
    if (isItalian) {
        return {
            source: 'fallback',
            interpretationCue: `Interpreta la risposta nel perimetro di "${topicLabel}".`,
            significanceCue: 'Valuta se emergono vincoli reali o impatti su decisioni e priorita.',
            probeCue: `Approfondisci "${focusSubGoal}" con un caso pratico recente.`
        };
    }
    return {
        source: 'fallback',
        interpretationCue: `Interpret the response within the "${topicLabel}" scope.`,
        significanceCue: 'Check for real constraints and impact on decisions or priorities.',
        probeCue: `Deepen "${focusSubGoal}" with one recent practical case.`
    };
}

function selectKnowledgeCue(input: MicroPlannerInput, focusSubGoal: string): PreloadedKnowledgeCue {
    const runtimeCue = extractRuntimeCue(input.runtimeKnowledge, input.topicId, input.topicLabel);
    if (runtimeCue) return runtimeCue;

    const manualCue = extractManualCue(
        input.manualGuide,
        input.topicLabel,
        input.topicSubGoals,
        input.language
    );
    if (manualCue) return manualCue;

    return buildFallbackCue(input.language, input.topicLabel, focusSubGoal);
}

function detectConstraintSignal(text: string, language: string): boolean {
    const isItalian = (language || '').toLowerCase().startsWith('it');
    const constraintPatterns = isItalian
        ? [/\bvincol[oa]\b/i, /\blimite\b/i, /\bnon possiamo\b/i, /\bnon riusciamo\b/i, /\bdifficolt[aà]\b/i, /\bostacolo\b/i, /\bimpossibile\b/i, /\bnon abbiamo\b/i, /\bmanca\b/i, /\bfrenante\b/i]
        : [/\bconstraint\b/i, /\blimitation\b/i, /\bcannot\b/i, /\bwe can't\b/i, /\bdifficulty\b/i, /\bobstacle\b/i, /\bimpossible\b/i, /\bblocking\b/i, /\bmissing\b/i, /\bbarrier\b/i];
    return constraintPatterns.some(p => p.test(text));
}

// ============================================================================
// Naturalness detection (avanzato)
// ============================================================================

const HESITATION_IT = /\b(non so|forse|dipende|bo[hh]?|mah|non saprei|non sono sicur[oa]|può darsi|chissà)\b/i;
const HESITATION_EN = /\b(I don't know|maybe|it depends|hmm|not sure|I'm not sure|hard to say|I guess)\b/i;

function detectHesitation(text: string, language: string): boolean {
    const pattern = (language || '').toLowerCase().startsWith('it') ? HESITATION_IT : HESITATION_EN;
    return pattern.test(text);
}

function detectCrossTopicOverlap(
    userMessage: string,
    currentTopicId: string,
    topicKeyInsights: Record<string, string>,
    language: string
): string | null {
    const msg = normalizeText(userMessage);
    if (msg.length < 20) return null;
    const msgWords = new Set(msg.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let bestMatch: { topicId: string; snippet: string; score: number } | null = null;

    for (const [topicId, snippet] of Object.entries(topicKeyInsights)) {
        if (topicId === currentTopicId || !snippet) continue;
        const snippetWords = normalizeText(snippet).toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = snippetWords.filter(w => msgWords.has(w)).length;
        const score = overlap / Math.max(1, snippetWords.length);
        if (score >= 0.3 && overlap >= 2 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { topicId, snippet, score };
        }
    }
    return bestMatch ? bestMatch.snippet : null;
}

function reorderSubGoalsByRelevance(
    remaining: string[],
    userMessage: string,
    language: string
): string[] {
    if (remaining.length <= 1) return remaining;
    const msgNorm = normalizeText(userMessage).toLowerCase();
    const msgWords = new Set(msgNorm.split(/\s+/).filter(w => w.length > 3));

    const scored = remaining.map(goal => {
        const goalWords = normalizeText(goal).toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = goalWords.filter(w => msgWords.has(w)).length;
        return { goal, score: overlap };
    });

    scored.sort((a, b) => b.score - a.score);
    // Only reorder if the best non-first goal has meaningfully higher overlap
    if (scored[0].score >= 2 && scored[0].goal !== remaining[0]) {
        return scored.map(s => s.goal);
    }
    return remaining;
}

export interface ProbeThresholds {
    probeExampleThreshold: number;       // default 0.28
    probeImpactExploreThreshold: number; // default 0.42
    probeImpactDeepenThreshold: number;  // default 0.34
}

const DEFAULT_THRESHOLDS: ProbeThresholds = {
    probeExampleThreshold: 0.28,
    probeImpactExploreThreshold: 0.42,
    probeImpactDeepenThreshold: 0.34,
};

function determineQuestionMode(params: {
    phase: MicroPlannerPhase;
    signalScore: number;
    prioritizeCoverage: boolean;
    userTurnSignal: UserTurnSignal;
    hasConstraintSignal: boolean;
    thresholds?: ProbeThresholds;
}): MicroPlannerDecision['mode'] {
    const t = params.thresholds || DEFAULT_THRESHOLDS;
    if (params.userTurnSignal === 'clarification') {
        return 'cover_subgoal';
    }
    if (params.prioritizeCoverage) {
        return 'cover_subgoal';
    }
    if (params.phase === 'DEEPEN') {
        if (params.signalScore >= t.probeImpactDeepenThreshold) return 'probe_impact';
        if (params.hasConstraintSignal) return 'probe_constraint';
        return 'probe_example';
    }
    if (params.signalScore >= t.probeImpactExploreThreshold) return 'probe_impact';
    if (params.hasConstraintSignal && params.signalScore >= 0.2) return 'probe_constraint';
    if (params.signalScore >= t.probeExampleThreshold) return 'probe_example';
    return 'cover_subgoal';
}

function determineCommentStyle(userTurnSignal: UserTurnSignal, signalScore: number): MicroPlannerDecision['commentStyle'] {
    if (userTurnSignal === 'clarification') return 'direct_clarification';
    if (signalScore >= 0.2) return 'evidence_reflection';
    return 'neutral_bridge';
}

export function buildMicroPlannerDecision(input: MicroPlannerInput, thresholds?: ProbeThresholds): MicroPlannerDecision {
    const userTurnSignal = input.userTurnSignal || 'none';
    const userMessage = String(input.userMessage || '');
    const signalScore = computeSignalScore(userMessage, input.language);

    const subGoals = Array.isArray(input.topicSubGoals) ? input.topicSubGoals.filter(Boolean) : [];
    const used = Array.isArray(input.usedSubGoals) ? input.usedSubGoals.filter(Boolean) : [];
    let remaining = subGoals.filter((goal) => !used.includes(goal));
    const total = Math.max(1, subGoals.length || 1);
    const turnsLeft = Math.max(1, (input.maxTurnsInTopic || 1) - (input.turnInTopic || 0) + 1);
    const prioritizeCoverage = input.phase === 'EXPLORE' && remaining.length > 0 && turnsLeft <= remaining.length;

    // Naturalness: context-driven sub-goal reordering
    if (input.naturalness?.contextDrivenReordering && remaining.length > 1 && userMessage) {
        remaining = reorderSubGoalsByRelevance(remaining, userMessage, input.language);
    }

    const focusSubGoal = remaining[0] || subGoals[0] || input.topicLabel;
    const knowledgeCue = selectKnowledgeCue(input, focusSubGoal);
    const hasConstraintSignal = detectConstraintSignal(userMessage, input.language);
    const mode = determineQuestionMode({
        phase: input.phase,
        signalScore,
        prioritizeCoverage,
        userTurnSignal,
        hasConstraintSignal,
        thresholds
    });
    const commentStyle = determineCommentStyle(userTurnSignal, signalScore);

    let followupHint = knowledgeCue.probeCue;
    if (mode === 'probe_impact') {
        followupHint = knowledgeCue.significanceCue;
    } else if (mode === 'cover_subgoal') {
        followupHint = knowledgeCue.interpretationCue;
    }

    // Naturalness hints (avanzato only)
    const crossTopicHint = input.naturalness?.crossTopicSynthesis && input.topicKeyInsights
        ? detectCrossTopicOverlap(userMessage, input.topicId, input.topicKeyInsights, input.language)
        : null;
    const hesitationHint = input.naturalness?.hesitationDetection && userMessage
        ? (detectHesitation(userMessage, input.language) ? 'detected' : null)
        : null;

    return {
        mode,
        commentStyle,
        focusSubGoal,
        followupHint: normalizeText(followupHint).slice(0, 180),
        topicCoverage: {
            total,
            used: Math.min(total, used.length),
            remaining: Math.max(0, remaining.length),
            turnsLeft,
            prioritizeCoverage
        },
        signalScore,
        knowledgeSource: knowledgeCue.source,
        crossTopicHint,
        hesitationHint,
    };
}

export function buildMicroPlannerPromptBlock(params: {
    language: string;
    phase: MicroPlannerPhase;
    topicLabel: string;
    decision: MicroPlannerDecision;
    interviewerQuality?: 'standard' | 'avanzato';
}): string {
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') return '';

    const isItalian = (params.language || '').toLowerCase().startsWith('it');
    const decision = params.decision;

    const naturalnessHintsIT: string[] = [];
    const naturalnessHintsEN: string[] = [];
    if (decision.crossTopicHint) {
        naturalnessHintsIT.push(`- CROSS-TOPIC: L'utente ha toccato un tema precedente. Collegamento: "${decision.crossTopicHint}". Integra brevemente il collegamento nella risposta.`);
        naturalnessHintsEN.push(`- CROSS-TOPIC: User referenced a previous topic. Connection: "${decision.crossTopicHint}". Briefly weave the connection into your response.`);
    }
    if (decision.hesitationHint === 'detected') {
        naturalnessHintsIT.push(`- ESITAZIONE RILEVATA: L'utente mostra incertezza. Sonda gentilmente: "Cosa ti frena dal dare una risposta netta?" o riformula in modo più concreto.`);
        naturalnessHintsEN.push(`- HESITATION DETECTED: User shows uncertainty. Gently probe: "What holds you back from a definitive answer?" or rephrase more concretely.`);
    }

    if (isItalian) {
        const hints = naturalnessHintsIT.length > 0 ? '\n' + naturalnessHintsIT.join('\n') + '\n' : '';
        const tierHint = params.interviewerQuality === 'standard'
            ? `7) Modalita standard: resta conversazionale, ma privilegia domande snelle e confrontabili. Dopo una risposta gia utile, passa al topic successivo invece di scavare ancora.\n8) Preferisci angoli diagnostici concreti: pratica attuale, frequenza, ostacolo, responsabilita, canale, metrica o prossimo passo. Evita domande troppo ampie o speculative.`
            : `7) Se c'è spazio qualitativo, puoi approfondire il punto più promettente invece di coprire solo il minimo.`;
        return `
## MICRO-PLANNER PRE-TURN (NO FALLBACK REWRITE)
- Topic attivo: "${params.topicLabel}"
- Strategia domanda: ${decision.mode}
- Stile commento iniziale: ${decision.commentStyle}
- Focus sub-goal: "${decision.focusSubGoal}"
- Hint di approfondimento: ${decision.followupHint}
- Copertura topic: usati=${decision.topicCoverage.used}/${decision.topicCoverage.total}, rimanenti=${decision.topicCoverage.remaining}, turni_residui=${decision.topicCoverage.turnsLeft}
- Sorgente knowledge: ${decision.knowledgeSource}
${hints}
Regole operative:
1) Se stile=direct_clarification, chiarisci prima in modo diretto e breve.
2) Se stile=evidence_reflection, commenta un dettaglio concreto dell'utente (no formule generiche).
3) Se strategia=cover_subgoal, orienta la domanda al sub-goal indicato.
4) Se strategia=probe_example/probe_impact/probe_constraint, approfondisci quel punto prima di allargare.
5) Mantieni naturalezza: UNA domanda sola, niente liste, niente chiusure.
6) Se coerente con il contesto utente, preferisci un follow-up diagnostico concreto con un vincolo leggero (tempo, segmento, canale o metrica). Se forzato, evita.
${tierHint}
`.trim();
    }

    const hints = naturalnessHintsEN.length > 0 ? '\n' + naturalnessHintsEN.join('\n') + '\n' : '';
    const tierHint = params.interviewerQuality === 'standard'
        ? `7) Standard mode: stay conversational, but prefer lean comparable questions. Once the user has given a usable answer, move on instead of digging further.\n8) Prefer concrete diagnostic angles: current practice, frequency, blocker, owner, channel, metric, or next step. Avoid overly broad or speculative prompts.`
        : `7) If qualitative value is emerging, you may deepen the most promising thread instead of covering only the minimum.`;
    return `
## MICRO-PLANNER PRE-TURN (NO FALLBACK REWRITE)
- Active topic: "${params.topicLabel}"
- Question strategy: ${decision.mode}
- Opening style: ${decision.commentStyle}
- Focus sub-goal: "${decision.focusSubGoal}"
- Follow-up hint: ${decision.followupHint}
- Topic coverage: used=${decision.topicCoverage.used}/${decision.topicCoverage.total}, remaining=${decision.topicCoverage.remaining}, turns_left=${decision.topicCoverage.turnsLeft}
- Knowledge source: ${decision.knowledgeSource}
${hints}
Operational rules:
1) If style=direct_clarification, clarify first in one short direct sentence.
2) If style=evidence_reflection, reference one concrete user detail (avoid generic openers).
3) If strategy=cover_subgoal, align the question to the selected sub-goal.
4) If strategy=probe_example/probe_impact/probe_constraint, deepen that point before broadening.
5) Keep it natural: one question only, no lists, no closure cues.
6) If coherent with user context, prefer a concrete diagnostic follow-up with one light constraint (timeframe, segment, channel, or metric). If forced, skip it.
${tierHint}
`.trim();
}

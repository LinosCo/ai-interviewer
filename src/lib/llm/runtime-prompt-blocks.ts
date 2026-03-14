/**
 * Runtime Prompt Blocks (6 & 7 of 7)
 * Blocks 6 and 7 are added to base prompt at runtime
 * after observing the user's current message
 */

import type { SignalResult } from '@/lib/interview/signal-score';
import type { TopicTurnDecision } from '@/lib/interview/turn-decision';

/**
 * BLOCK 6: TURN GUIDANCE
 * Signal-aware micro-planner for HOW to respond
 * Merged from: Runtime Semantic Context + Micro-Planner
 */
export function buildTurnGuidanceBlock({
    language,
    phase,
    signalResult,
    lastUserMessage,
    recentBridgeStems,
    interviewerQuality = 'standard',
    currentTopicLabel,
    targetTopicLabel,
    turnDecision,
    remainingTargetSubGoals = 0,
    remainingStretchSubGoals = 0
}: {
    language: string;
    phase: string;
    signalResult: SignalResult;
    lastUserMessage: string;
    recentBridgeStems: string[];
    interviewerQuality?: 'standard' | 'avanzato';
    currentTopicLabel?: string | null;
    targetTopicLabel?: string | null;
    turnDecision?: TopicTurnDecision | null;
    remainingTargetSubGoals?: number;
    remainingStretchSubGoals?: number;
}): string {
    const isItalian = language.toLowerCase().startsWith('it');
    const { band, score, snippet } = signalResult;

    const actionLabel = turnDecision?.nextAction === 'follow_up'
        ? (isItalian ? 'follow-up' : 'follow-up')
        : turnDecision?.nextAction === 'continue'
            ? (isItalian ? 'continua' : 'continue')
            : turnDecision?.nextAction === 'transition'
                ? (isItalian ? 'transizione' : 'transition')
                : band === 'HIGH'
                    ? (isItalian ? 'follow-up' : 'follow-up')
                    : band === 'MEDIUM'
                        ? (isItalian ? 'continua' : 'continue')
                        : (isItalian ? 'transizione' : 'transition');

    const avoidStems = recentBridgeStems.length > 0
        ? (isItalian
            ? `Evita recenti: ${recentBridgeStems.slice(0, 2).join(' | ')}`
            : `Avoid recent: ${recentBridgeStems.slice(0, 2).join(' | ')}`)
        : '';

    const coverageHint = remainingTargetSubGoals > 0
        ? (isItalian
            ? `Copertura target residua sul topic corrente: ${remainingTargetSubGoals} sub-goal essenziali.`
            : `Target coverage still missing on the current topic: ${remainingTargetSubGoals} essential sub-goals.`)
        : remainingStretchSubGoals > 0
            ? (isItalian
                ? `Target coperto: restano ${remainingStretchSubGoals} sub-goal stretch opzionali.`
                : `Target coverage is satisfied: ${remainingStretchSubGoals} optional stretch sub-goals remain.`)
            : (isItalian
                ? 'Copertura prevista sul topic corrente sostanzialmente completata.'
                : 'Planned coverage on the current topic is essentially complete.');

    const modeHint = interviewerQuality === 'standard'
        ? (isItalian
            ? 'Standard: resta naturale ma disciplinato. Copri prima il target del topic; fai follow-up solo se il valore informativo e davvero alto e utile.'
            : 'Standard: stay natural but disciplined. Cover the topic target first; only follow up when the informational value is clearly high and useful.')
        : (isItalian
            ? 'Avanzato: se emerge un delta forte e rilevante, segui quel filo; altrimenti usa il contesto per un ponte breve e preciso.'
            : 'Advanced: if a strong relevant delta emerges, follow that thread; otherwise use context for a brief, precise bridge.');

    const actionHint = turnDecision?.nextAction === 'transition'
        ? (isItalian
            ? `Azione decisa: transizione. Chiudi bene il topic "${currentTopicLabel || ''}" e fai ponte naturale verso "${targetTopicLabel || currentTopicLabel || ''}" con UNA sola domanda.`
            : `Chosen action: transition. Close "${currentTopicLabel || ''}" cleanly and bridge naturally into "${targetTopicLabel || currentTopicLabel || ''}" with ONE question.`)
        : turnDecision?.nextAction === 'follow_up'
            ? (isItalian
                ? `Azione decisa: follow-up. Resta su "${currentTopicLabel || targetTopicLabel || ''}" e approfondisci il delta piu promettente dell'ultimo messaggio con UNA domanda sola.`
                : `Chosen action: follow-up. Stay on "${currentTopicLabel || targetTopicLabel || ''}" and deepen the most promising delta from the latest message with ONE question.`)
            : (isItalian
                ? `Azione decisa: continua su "${currentTopicLabel || targetTopicLabel || ''}" coprendo il sub-goal previsto senza allargare inutilmente.`
                : `Chosen action: continue on "${currentTopicLabel || targetTopicLabel || ''}" and cover the planned sub-goal without widening unnecessarily.`);

    return isItalian ? `
## GUIDA TURNO
Segnale: ${band} (score: ${score.toFixed(2)})
Valore/delta: ${turnDecision?.responseValue || 'n/a'} / ${turnDecision?.deltaType || 'n/a'}
Stato narrativo: ${turnDecision?.narrativeState || 'n/a'}
Decisione: ${actionLabel}
${avoidStems ? `Attenzione: ${avoidStems}` : ''}
${coverageHint}
${modeHint}
${actionHint}

Strategie:
- Riconosci prima il delta dell'ultimo messaggio, poi scegli tra follow-up, continua o transizione.
- Approfondisci solo se l'ultimo messaggio porta un esempio concreto, un trade-off, un impatto, una contraddizione o un vincolo reale rilevante.
- Se il delta non e davvero rilevante, non simulare profondita: prosegui o transiziona.
- Sempre: UNA sola domanda, tono naturale, termina con "?"
`.trim() : `
## TURN GUIDANCE
Signal: ${band} (score: ${score.toFixed(2)})
Value/delta: ${turnDecision?.responseValue || 'n/a'} / ${turnDecision?.deltaType || 'n/a'}
Narrative state: ${turnDecision?.narrativeState || 'n/a'}
Decision: ${actionLabel}
${avoidStems ? `Note: ${avoidStems}` : ''}
${coverageHint}
${modeHint}
${actionHint}

Strategies:
- First recognize the delta in the latest user message, then choose between follow-up, continue, or transition.
- Deepen only if the latest message adds a concrete example, trade-off, impact, contradiction, or real constraint that matters for the interview objective.
- If the delta is not genuinely relevant, do not fake depth: continue or transition cleanly.
- Always compare the latest user message with the current topic trajectory.
- If the latest message opens a new direction that is genuinely relevant to the topic or interview objective, follow that direction with one focused question.
- If it does not open a genuinely relevant new direction, do not force a follow-up: continue the planned progression and use historical context only to sharpen the wording.
- Always: ONE question, natural tone, end with "?"
`.trim();
}

/**
 * BLOCK 7: GUARDS
 * Conditional block only included when user signal is detected
 * (e.g., off-topic question, clarification request)
 */
export function buildGuardsBlock({
    userTurnSignal,
    language
}: {
    userTurnSignal: 'clarification' | 'off_topic_question' | null;
    language: string;
}): string | null {
    if (!userTurnSignal) return null;

    const isItalian = language.toLowerCase().startsWith('it');

    if (userTurnSignal === 'clarification') {
        return isItalian ? `
## GUARDIA: RICHIESTA CHIARIMENTO
L'utente ha chiesto di chiarire qualcosa.
Rispondi BREVEMENTE (1-2 frasi) chiarendo in modo diretto la domanda precedente, poi ritorna alle domande di topic.
Nessun chiarimento infinito — massimo 1 turno di chiarimento per topic.
Se nel messaggio dell'utente c'è anche un nuovo dettaglio rilevante per il topic, integralo nella domanda successiva invece di ignorarlo.
`.trim() : `
## GUARD: CLARIFICATION REQUEST
User asked to clarify something.
Answer BRIEFLY (1-2 sentences) and directly clarify the previous question before continuing.
No infinite clarifications — max 1 per topic.
If the user message also contains a new detail that matters for the topic, integrate it into the next question instead of ignoring it.
`.trim();
    }

    if (userTurnSignal === 'off_topic_question') {
        return isItalian ? `
## GUARDIA: DOMANDA FUORI TEMA
L'utente ha fatto una domanda fuori tema.
Riconosci brevemente, redirigi dolcemente al tema dell'intervista.
NON rispondere completamente alla domanda fuori tema.
Se il messaggio contiene anche un dettaglio utile per l'intervista, usa quel dettaglio per rientrare nel topic.
`.trim() : `
## GUARD: OFF-TOPIC QUESTION
User asked something off-topic.
Acknowledge briefly, gently redirect to interview topic.
DO NOT fully answer the off-topic question.
If the message also contains a useful interview detail, use that detail to return to the topic.
`.trim();
    }

    return null;
}

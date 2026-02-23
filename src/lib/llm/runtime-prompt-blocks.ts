/**
 * Runtime Prompt Blocks (6 & 7 of 7)
 * Blocks 6 and 7 are added to base prompt at runtime
 * after observing the user's current message
 */

import type { SignalResult } from '@/lib/interview/signal-score';

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
    recentBridgeStems
}: {
    language: string;
    phase: string;
    signalResult: SignalResult;
    lastUserMessage: string;
    recentBridgeStems: string[];
}): string {
    const isItalian = language.toLowerCase().startsWith('it');
    const { band, score, snippet } = signalResult;

    const depthHint = band === 'HIGH'
        ? (isItalian ? 'Alto valore → approfondisci' : 'High value → deepen')
        : band === 'MEDIUM'
            ? (isItalian ? 'Moderato → continua' : 'Moderate → continue')
            : (isItalian ? 'Basso → avanzi' : 'Low → advance');

    const avoidStems = recentBridgeStems.length > 0
        ? (isItalian
            ? `Evita recenti: ${recentBridgeStems.slice(0, 2).join(' | ')}`
            : `Avoid recent: ${recentBridgeStems.slice(0, 2).join(' | ')}`)
        : '';

    return isItalian ? `
## GUIDA TURNO
Segnale: ${band} (score: ${score.toFixed(2)})
Approfondimento: ${depthHint}
${avoidStems ? `Attenzione: ${avoidStems}` : ''}

Strategie:
- Se HIGH: approfondisci con una domanda sugli aspetti chiave
- Se MEDIUM: continua naturalmente con il prossimo sub-goal
- Se LOW: transizza verso il topic successivo con ponte breve
- Sempre: UNA sola domanda, tono naturale, termina con "?"
`.trim() : `
## TURN GUIDANCE
Signal: ${band} (score: ${score.toFixed(2)})
Deepening strategy: ${depthHint}
${avoidStems ? `Note: ${avoidStems}` : ''}

Strategies:
- If HIGH: ask a deepening question on key points
- If MEDIUM: continue naturally with next sub-goal
- If LOW: transition to next topic with brief bridge
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
Rispondi BREVEMENTE (1-2 frasi), poi ritorna alle domande di topic.
Nessun chiarimento infinito — massimo 1 turno di chiarimento per topic.
`.trim() : `
## GUARD: CLARIFICATION REQUEST
User asked to clarify something.
Answer BRIEFLY (1-2 sentences), then return to topic questions.
No infinite clarifications — max 1 per topic.
`.trim();
    }

    if (userTurnSignal === 'off_topic_question') {
        return isItalian ? `
## GUARDIA: DOMANDA FUORI TEMA
L'utente ha fatto una domanda fuori tema.
Riconosci brevemente, redirigi dolcemente al tema dell'intervista.
NON rispondere completamente alla domanda fuori tema.
`.trim() : `
## GUARD: OFF-TOPIC QUESTION
User asked something off-topic.
Acknowledge briefly, gently redirect to interview topic.
DO NOT fully answer the off-topic question.
`.trim();
    }

    return null;
}

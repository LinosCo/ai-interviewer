/**
 * Costi in crediti per ogni azione AI
 * Questi valori devono essere calibrati in base ai costi LLM effettivi
 */

export const CREDIT_COSTS = {
    // Interview AI
    interview_question: 8_000,        // singola domanda/risposta
    interview_complete: 12_000,       // intervista media completa
    interview_analysis: 15_000,       // analisi post-intervista

    // Chatbot
    chatbot_session_message: 3_000,   // singolo messaggio
    chatbot_session_complete: 8_000,  // sessione media completa

    // Visibility Tracker
    visibility_query: 6_000,          // singola query AI
    visibility_report: 20_000,        // report completo

    // AI Tips
    ai_tip_generation: 15_000,        // generazione singolo tip

    // Copilot Strategico
    copilot_message: 20_000,          // singola interazione
    copilot_analysis: 35_000,         // analisi approfondita

    // Export
    export_pdf_simple: 5_000,         // export senza AI
    export_pdf_analysis: 30_000,      // export con analisi AI
    export_csv: 1_000                 // export dati raw
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/**
 * Mappa azione -> tool per tracking
 */
export const ACTION_TO_TOOL: Record<CreditAction, string> = {
    interview_question: 'interview',
    interview_complete: 'interview',
    interview_analysis: 'interview',
    chatbot_session_message: 'chatbot',
    chatbot_session_complete: 'chatbot',
    visibility_query: 'visibility',
    visibility_report: 'visibility',
    ai_tip_generation: 'tips',
    copilot_message: 'copilot',
    copilot_analysis: 'copilot',
    export_pdf_simple: 'export',
    export_pdf_analysis: 'export',
    export_csv: 'export'
};

/**
 * Ottiene il costo in crediti per un'azione
 */
export function getCreditCost(action: CreditAction): number {
    return CREDIT_COSTS[action];
}

/**
 * Ottiene il tool associato a un'azione
 */
export function getToolFromAction(action: CreditAction): string {
    return ACTION_TO_TOOL[action];
}

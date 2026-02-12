/**
 * Costi in crediti per ogni azione AI
 * Questi valori devono essere calibrati in base ai costi LLM effettivi
 */

import { LLMModel, MODEL_PRICING } from './llmModels';

export const CREDIT_COSTS = {
    // Interview AI
    interview_question: 8,        // singola domanda/risposta
    interview_complete: 12,       // intervista media completa
    interview_analysis: 15,       // analisi post-intervista

    // Chatbot
    chatbot_session_message: 3,   // singolo messaggio
    chatbot_session_complete: 8,  // sessione media completa

    // Visibility Tracker
    visibility_query: 6,          // singola query AI
    visibility_report: 20,        // report completo

    // AI Tips
    ai_tip_generation: 15,        // generazione singolo tip

    // Copilot Strategico
    copilot_message: 20,          // singola interazione
    copilot_analysis: 35,         // analisi approfondita

    // Export
    export_pdf_simple: 5,         // export senza AI
    export_pdf_analysis: 30,      // export con analisi AI
    export_csv: 1                 // export dati raw
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
type PricingModelKey = keyof typeof MODEL_PRICING;

export const TOKEN_TO_CREDIT_RATE = 0.0005;

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

function resolvePricingModel(modelName: string): PricingModelKey | null {
    const normalized = String(modelName || '').toLowerCase().trim();
    if (!normalized) return null;

    const aliases: Array<{ prefix: string; model: PricingModelKey }> = [
        { prefix: 'gpt-4o-mini', model: LLMModel.GPT4O_MINI },
        { prefix: 'claude-3-5-haiku', model: LLMModel.CLAUDE_HAIKU },
        { prefix: 'claude-sonnet-4', model: LLMModel.CLAUDE_SONNET },
        { prefix: 'gemini-2.0-flash', model: LLMModel.GEMINI_FLASH },
        { prefix: 'gemini-1.5-flash-8b', model: LLMModel.GEMINI_FLASH_LITE }
    ];

    for (const alias of aliases) {
        if (normalized.startsWith(alias.prefix)) {
            return alias.model;
        }
    }

    return null;
}

export function getModelCreditMultiplier(modelName: string): number {
    const normalized = String(modelName || '').toLowerCase().trim();
    const pricingModel = resolvePricingModel(normalized);
    const baseline = MODEL_PRICING[LLMModel.GPT4O_MINI];
    const baselineCost = baseline.input + baseline.output;

    if (pricingModel) {
        const modelPricing = MODEL_PRICING[pricingModel];
        const modelCost = modelPricing.input + modelPricing.output;
        return Math.max(1, Math.min(8, modelCost / baselineCost));
    }

    if (normalized.includes('gpt-4o-mini') || normalized.includes('haiku') || normalized.includes('flash-8b')) {
        return 1;
    }
    if (normalized.includes('gpt-4o') || normalized.includes('sonnet') || normalized.includes('o1') || normalized.includes('o3')) {
        return 3;
    }

    return 1.5;
}

/**
 * Ottiene il tool associato a un'azione
 */
export function getToolFromAction(action: CreditAction): string {
    return ACTION_TO_TOOL[action];
}

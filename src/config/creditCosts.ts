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

    // Formazione AI
    training_session_message: 3,  // singolo messaggio training

    // Export
    export_pdf_simple: 5,         // export senza AI
    export_pdf_analysis: 30,      // export con analisi AI
    export_csv: 1                 // export dati raw
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
type PricingModelKey = keyof typeof MODEL_PRICING;

export const TOKEN_TO_CREDIT_RATE = 0.0005;
export const TARGET_TOKEN_COST_MARGIN = 4;
// Worst-case selling price per credit (large pack: €89 / 15,000 credits).
export const MIN_REVENUE_PER_CREDIT_EUR = 89 / 15000;
// Safety conversion (treat 1 USD token cost as 1 EUR cost for conservative billing).
export const USD_TO_EUR_SAFETY_RATE = 1;

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
    ai_tip_generation: 'ai_tips',
    copilot_message: 'copilot',
    copilot_analysis: 'copilot',
    training_session_message: 'training',
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
        { prefix: 'claude-sonnet-4-6', model: LLMModel.CLAUDE_SONNET },
        { prefix: 'claude-4.6-sonnet', model: LLMModel.CLAUDE_SONNET },
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

function getModelPricing(modelName: string): { input: number; output: number } | null {
    const pricingModel = resolvePricingModel(modelName);
    if (pricingModel) {
        return MODEL_PRICING[pricingModel];
    }

    const normalized = String(modelName || '').toLowerCase().trim();
    if (!normalized) return null;

    // Conservative fallbacks for generic model names.
    if (normalized.includes('sonnet')) return MODEL_PRICING[LLMModel.CLAUDE_SONNET];
    if (normalized.includes('haiku')) return MODEL_PRICING[LLMModel.CLAUDE_HAIKU];
    if (normalized.includes('gpt-4o-mini')) return MODEL_PRICING[LLMModel.GPT4O_MINI];
    if (normalized.includes('gpt-4o')) return MODEL_PRICING[LLMModel.CLAUDE_SONNET];
    if (normalized.includes('gemini') && normalized.includes('8b')) return MODEL_PRICING[LLMModel.GEMINI_FLASH_LITE];
    if (normalized.includes('gemini') && normalized.includes('flash')) return MODEL_PRICING[LLMModel.GEMINI_FLASH];

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

export function estimateTokenCostEur(
    inputTokens: number,
    outputTokens: number,
    modelName: string
): number {
    const pricing = getModelPricing(modelName);
    if (!pricing) return 0;

    const safeInput = Math.max(0, Number(inputTokens) || 0);
    const safeOutput = Math.max(0, Number(outputTokens) || 0);
    const costUsd =
        (safeInput / 1_000_000) * pricing.input +
        (safeOutput / 1_000_000) * pricing.output;

    return costUsd * USD_TO_EUR_SAFETY_RATE;
}

export function getMinCreditsForMargin(
    inputTokens: number,
    outputTokens: number,
    modelName: string,
    targetMargin: number = TARGET_TOKEN_COST_MARGIN
): number {
    if (targetMargin <= 0 || MIN_REVENUE_PER_CREDIT_EUR <= 0) return 0;

    const tokenCostEur = estimateTokenCostEur(inputTokens, outputTokens, modelName);
    if (tokenCostEur <= 0) return 0;

    return Math.max(
        1,
        Math.ceil((tokenCostEur * targetMargin) / MIN_REVENUE_PER_CREDIT_EUR)
    );
}

/**
 * Ottiene il tool associato a un'azione
 */
export function getToolFromAction(action: CreditAction): string {
    return ACTION_TO_TOOL[action];
}

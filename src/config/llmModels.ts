/**
 * STRATEGIA MODELLI LLM
 * 
 * Obiettivo: minimizzare costi mantenendo qualità
 * - Conversazione: modello economico (GPT-4o-mini)
 * - Analytics: modello qualitativo (Claude Haiku)
 * - Fallback automatico tra provider
 */

export enum LLMProvider {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google'
}

export enum LLMModel {
    // OpenAI
    GPT4O_MINI = 'gpt-4o-mini',

    // Anthropic
    CLAUDE_HAIKU = 'claude-3-5-haiku-latest',
    CLAUDE_SONNET = 'claude-sonnet-4-20250514',

    // Google
    GEMINI_FLASH = 'gemini-2.0-flash',
    GEMINI_FLASH_LITE = 'gemini-1.5-flash-8b'
}

export enum LLMTask {
    INTERVIEW_CHAT = 'interview_chat',
    BOT_GENERATION = 'bot_generation',
    SENTIMENT_ANALYSIS = 'sentiment_analysis',
    THEME_EXTRACTION = 'theme_extraction',
    QUOTE_EXTRACTION = 'quote_extraction',
    SUMMARY_GENERATION = 'summary_generation',
    RAG_RETRIEVAL = 'rag_retrieval'
}

export interface ModelConfig {
    primary: LLMModel;
    fallback: LLMModel[];
    maxTokensInput: number;
    maxTokensOutput: number;
    temperature: number;
}

export const MODEL_ASSIGNMENTS: Record<LLMTask, ModelConfig> = {
    [LLMTask.INTERVIEW_CHAT]: {
        primary: LLMModel.GPT4O_MINI,
        fallback: [LLMModel.GEMINI_FLASH, LLMModel.CLAUDE_HAIKU],
        maxTokensInput: 8000,
        maxTokensOutput: 500,
        temperature: 0.7
    },

    [LLMTask.BOT_GENERATION]: {
        primary: LLMModel.CLAUDE_HAIKU,
        fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
        maxTokensInput: 4000,
        maxTokensOutput: 2000,
        temperature: 0.5
    },

    [LLMTask.SENTIMENT_ANALYSIS]: {
        primary: LLMModel.CLAUDE_HAIKU,
        fallback: [LLMModel.GEMINI_FLASH, LLMModel.GPT4O_MINI],
        maxTokensInput: 6000,
        maxTokensOutput: 500,
        temperature: 0.3
    },

    [LLMTask.THEME_EXTRACTION]: {
        primary: LLMModel.CLAUDE_HAIKU,
        fallback: [LLMModel.GEMINI_FLASH, LLMModel.GPT4O_MINI],
        maxTokensInput: 8000,
        maxTokensOutput: 1000,
        temperature: 0.3
    },

    [LLMTask.QUOTE_EXTRACTION]: {
        primary: LLMModel.CLAUDE_HAIKU,
        fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
        maxTokensInput: 6000,
        maxTokensOutput: 800,
        temperature: 0.2
    },

    [LLMTask.SUMMARY_GENERATION]: {
        primary: LLMModel.CLAUDE_HAIKU,
        fallback: [LLMModel.GPT4O_MINI, LLMModel.GEMINI_FLASH],
        maxTokensInput: 12000,
        maxTokensOutput: 1500,
        temperature: 0.4
    },

    [LLMTask.RAG_RETRIEVAL]: {
        primary: LLMModel.GPT4O_MINI,
        fallback: [LLMModel.GEMINI_FLASH_LITE],
        maxTokensInput: 4000,
        maxTokensOutput: 200,
        temperature: 0.1
    }
};

// Pricing per 1M tokens (in USD)
export const MODEL_PRICING = {
    [LLMModel.GPT4O_MINI]: { input: 0.15, output: 0.60 },
    [LLMModel.CLAUDE_HAIKU]: { input: 0.80, output: 4.00 },
    [LLMModel.CLAUDE_SONNET]: { input: 3.00, output: 15.00 },
    [LLMModel.GEMINI_FLASH]: { input: 0.10, output: 0.40 },
    [LLMModel.GEMINI_FLASH_LITE]: { input: 0.075, output: 0.30 }
} as const;

import { prisma } from '@/lib/prisma';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

/**
 * Get admin-configured API key from GlobalConfig
 */
export async function getAdminApiKey(provider: 'GEMINI' | 'GOOGLE_SERP'): Promise<string | null> {
    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: "default" }
        });

        if (!globalConfig) return null;

        if (provider === 'GEMINI') return globalConfig.geminiApiKey;
        if (provider === 'GOOGLE_SERP') return globalConfig.googleSerpApiKey;

        return null;
    } catch (error) {
        console.error(`Error fetching ${provider} API key:`, error);
        return null;
    }
}

/**
 * Get configured LLM provider model
 */
export async function getVisibilityLLMProvider(provider: 'openai' | 'anthropic' | 'gemini') {
    switch (provider) {
        case 'openai':
            return openai('gpt-4o-mini');

        case 'anthropic':
            return anthropic('claude-3-5-haiku-20241022');

        case 'gemini': {
            // Try to get admin-configured Gemini API key
            const geminiKey = await getAdminApiKey('GEMINI');

            if (geminiKey) {
                // Use admin key
                return google('gemini-2.0-flash-exp', {
                    apiKey: geminiKey
                });
            }

            // Fallback to env var
            if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                return google('gemini-2.0-flash-exp');
            }

            throw new Error('Gemini API key not configured. Please configure it in admin settings.');
        }

        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

/**
 * Configuration for visibility tracking LLM providers
 */
export const VISIBILITY_PROVIDERS = {
    openai: {
        model: 'gpt-4o-mini',
        displayName: 'OpenAI GPT-4o',
        maxTokens: 2000,
        temperature: 0.3
    },
    anthropic: {
        model: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        maxTokens: 2000,
        temperature: 0.3
    },
    gemini: {
        model: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash',
        maxTokens: 2000,
        temperature: 0.3
    }
} as const;

/**
 * Execute query on LLM with standardized system prompt
 * Returns null if provider is not configured or query fails
 */
export async function queryVisibilityLLM(
    provider: 'openai' | 'anthropic' | 'gemini',
    prompt: string,
    language: string = 'en',
    territory: string = 'US'
): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number } } | null> {
    try {
        const { generateText } = await import('ai');

        let model;
        try {
            model = await getVisibilityLLMProvider(provider);
        } catch (error) {
            console.warn(`Skipping ${provider}: Provider not configured or unavailable.`);
            return null;
        }

        const config = VISIBILITY_PROVIDERS[provider];

        // Language-specific system prompt
        const languageInstructions: Record<string, string> = {
            it: 'Rispondi in italiano.',
            en: 'Respond in English.',
            es: 'Responde en español.',
            fr: 'Répondez en français.',
            de: 'Antworte auf Deutsch.'
        };

        const systemPrompt = `You are an AI assistant helping users discover software solutions and services. 
Provide a helpful, unbiased list of the top solutions for the user's query. 
Include specific product/service names and brief descriptions.
Format as a numbered list when appropriate.
${languageInstructions[language] || languageInstructions.en}
Target market: ${territory}`;

        const result = await generateText({
            model,
            system: systemPrompt,
            prompt,
            maxTokens: config.maxTokens,
            temperature: config.temperature
        });

        return {
            text: result.text,
            usage: {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens
            }
        };
    } catch (error) {
        console.error(`Error querying ${provider}:`, error);
        return null;
    }
}

/**
 * Check if a provider is properly configured
 */
export async function checkProviderConfiguration(provider: 'openai' | 'anthropic' | 'gemini'): Promise<{
    configured: boolean;
    source: 'env' | 'admin' | 'none';
    error?: string;
}> {
    try {
        switch (provider) {
            case 'openai':
                return {
                    configured: !!process.env.OPENAI_API_KEY,
                    source: process.env.OPENAI_API_KEY ? 'env' : 'none'
                };

            case 'anthropic':
                return {
                    configured: !!process.env.ANTHROPIC_API_KEY,
                    source: process.env.ANTHROPIC_API_KEY ? 'env' : 'none'
                };

            case 'gemini': {
                const adminKey = await getAdminApiKey('GEMINI');
                if (adminKey) {
                    return { configured: true, source: 'admin' };
                }
                if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                    return { configured: true, source: 'env' };
                }
                return {
                    configured: false,
                    source: 'none',
                    error: 'No API key found. Configure in admin settings or set GOOGLE_GENERATIVE_AI_API_KEY env var.'
                };
            }

            default:
                return {
                    configured: false,
                    source: 'none',
                    error: 'Unknown provider'
                };
        }
    } catch (error) {
        return {
            configured: false,
            source: 'none',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get Google SERP API key for search-based visibility tracking
 */
export async function getGoogleSerpApiKey(): Promise<string | null> {
    return getAdminApiKey('GOOGLE_SERP');
}

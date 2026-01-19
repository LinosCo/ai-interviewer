import { prisma } from '@/lib/prisma';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

/**
 * Get admin-configured API key from GlobalConfig
 */
export async function getAdminApiKey(provider: 'GEMINI' | 'GOOGLE_SERP'): Promise<string | null> {
    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: "default" }
        }) as any; // Type assertion - schema has these fields but TS cache may be stale

        if (!globalConfig) return null;

        if (provider === 'GEMINI') return globalConfig.geminiApiKey ?? null;
        if (provider === 'GOOGLE_SERP') return globalConfig.googleSerpApiKey ?? null;

        return null;
    } catch (error) {
        console.error(`Error fetching ${provider} API key:`, error);
        return null;
    }
}

/**
 * Configuration for visibility tracking LLM providers
 */
export const VISIBILITY_PROVIDERS = {
    openai: {
        model: 'gpt-4o-mini',
        displayName: 'OpenAI GPT-4o'
    },
    anthropic: {
        model: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku'
    },
    gemini: {
        model: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash'
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

        let result;

        // Handle each provider separately
        switch (provider) {
            case 'openai':
                result = await generateText({
                    model: openai('gpt-4o-mini'),
                    system: systemPrompt,
                    prompt
                });
                break;

            case 'anthropic':
                result = await generateText({
                    model: anthropic('claude-3-5-haiku-20241022'),
                    system: systemPrompt,
                    prompt
                });
                break;

            case 'gemini': {
                // Check if Gemini is configured
                const geminiKey = await getAdminApiKey('GEMINI');
                if (!geminiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
                    console.warn('Gemini not configured, skipping.');
                    return null;
                }
                result = await generateText({
                    // Type assertion needed due to version mismatch between @ai-sdk/google and ai
                    model: google('gemini-2.0-flash-exp') as any,
                    system: systemPrompt,
                    prompt
                });
                break;
            }

            default:
                throw new Error(`Unknown provider: ${provider}`);
        }

        // Extract usage - handle different API versions
        const usage = result.usage as any;
        return {
            text: result.text,
            usage: {
                promptTokens: usage?.promptTokens ?? usage?.inputTokens ?? 0,
                completionTokens: usage?.completionTokens ?? usage?.outputTokens ?? 0
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

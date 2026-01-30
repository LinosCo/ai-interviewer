import { prisma } from '@/lib/prisma';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createAnthropic, anthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { generateText } from 'ai';

/**
 * Get admin-configured API key from GlobalConfig
 */
export async function getAdminApiKey(provider: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'GOOGLE_SERP'): Promise<string | null> {
    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: "default" }
        }) as any;

        if (!globalConfig) return null;

        if (provider === 'OPENAI') return globalConfig.openaiApiKey ?? null;
        if (provider === 'ANTHROPIC') return globalConfig.anthropicApiKey ?? null;
        if (provider === 'GEMINI') return globalConfig.geminiApiKey ?? null;
        if (provider === 'GOOGLE_SERP') return globalConfig.googleSerpApiKey ?? null;

        return null;
    } catch (error) {
        console.error(`Error fetching ${provider} API key:`, error);
        return null;
    }
}

/**
 * Get configured model instance for a provider
 */
export async function getLLMProvider(provider: 'openai' | 'anthropic' | 'gemini') {
    const adminKey = await getAdminApiKey(provider.toUpperCase() as any);

    if (provider === 'openai') {
        const apiKey = adminKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');
        return createOpenAI({ apiKey });
    }

    if (provider === 'anthropic') {
        const apiKey = adminKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('Anthropic API key missing');
        return createAnthropic({ apiKey });
    }

    if (provider === 'gemini') {
        const apiKey = adminKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) throw new Error('Gemini API key missing');
        return createGoogleGenerativeAI({ apiKey });
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Get any available configured LLM provider for internal tasks
 * Tries OpenAI first, then Anthropic, then Gemini
 */
export async function getSystemLLM() {
    const providers: ('openai' | 'anthropic' | 'gemini')[] = ['openai', 'anthropic', 'gemini'];

    for (const provider of providers) {
        try {
            const config = await checkProviderConfiguration(provider);
            if (config.configured) {
                const modelProvider = await getLLMProvider(provider);
                const modelName = VISIBILITY_PROVIDERS[provider].model;
                return {
                    model: modelProvider(modelName) as any,
                    provider
                };
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error('No LLM providers configured. Please set at least one API key in admin settings.');
}

/**
 * Configuration for visibility tracking LLM providers
 */
export const VISIBILITY_PROVIDERS = {
    openai: {
        model: 'gpt-4o',
        displayName: 'OpenAI GPT-4o'
    },
    anthropic: {
        model: 'claude-3-5-sonnet-latest',
        displayName: 'Claude 3.5 Sonnet'
    },
    gemini: {
        model: 'gemini-1.5-pro-latest',
        displayName: 'Gemini 1.5 Pro'
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
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } } | null> {
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
            case 'openai': {
                const config = await checkProviderConfiguration('openai');
                if (!config.configured) return null;
                const openaiProvider = await getLLMProvider('openai');
                result = await generateText({
                    model: openaiProvider('gpt-4o') as any,
                    system: systemPrompt,
                    prompt
                });
                break;
            }

            case 'anthropic': {
                const config = await checkProviderConfiguration('anthropic');
                if (!config.configured) return null;
                const anthropicProvider = await getLLMProvider('anthropic');
                result = await generateText({
                    model: anthropicProvider('claude-3-5-sonnet-latest') as any,
                    system: systemPrompt,
                    prompt
                });
                break;
            }

            case 'gemini': {
                const config = await checkProviderConfiguration('gemini');
                if (!config.configured) return null;
                const geminiProvider = await getLLMProvider('gemini');
                result = await generateText({
                    model: geminiProvider('gemini-1.5-pro-latest') as any,
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
                inputTokens: usage?.inputTokens ?? usage?.promptTokens ?? 0,
                outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? 0
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
            case 'openai': {
                const adminKey = await getAdminApiKey('OPENAI');
                return {
                    configured: !!(adminKey || process.env.OPENAI_API_KEY),
                    source: adminKey ? 'admin' : (process.env.OPENAI_API_KEY ? 'env' : 'none')
                };
            }
            case 'anthropic': {
                const adminKey = await getAdminApiKey('ANTHROPIC');
                return {
                    configured: !!(adminKey || process.env.ANTHROPIC_API_KEY),
                    source: adminKey ? 'admin' : (process.env.ANTHROPIC_API_KEY ? 'env' : 'none')
                };
            }
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

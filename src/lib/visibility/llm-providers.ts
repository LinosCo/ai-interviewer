import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        } catch {
            continue;
        }
    }

    throw new Error('No LLM providers configured. Please set at least one API key in admin settings.');
}

/**
 * Configuration for visibility tracking LLM providers
 *
 * IMPORTANT: These models should match what free-tier users actually see
 * when using each AI assistant's web interface:
 * - ChatGPT Free: GPT-4o (not mini)
 * - Claude Free: Claude 3.5 Sonnet (not Haiku)
 * - Gemini Free: Gemini 2.0 Flash
 */
export const VISIBILITY_PROVIDERS = {
    openai: {
        model: 'gpt-4o',
        displayName: 'ChatGPT'
    },
    anthropic: {
        model: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude'
    },
    gemini: {
        model: 'gemini-2.0-flash',
        displayName: 'Gemini'
    }
} as const;

/**
 * Execute query on LLM simulating what a real user would see
 *
 * @param provider - The LLM provider to query
 * @param prompt - The user's query
 * @param language - Language code (en, it, es, fr, de)
 * @param territory - Target market (US, IT, etc.)
 * @param realistic - If true, sends query without system prompt (simulates free user experience)
 * @returns Response text and token usage, or null if failed
 */
export async function queryVisibilityLLM(
    provider: 'openai' | 'anthropic' | 'gemini',
    prompt: string,
    language: string = 'en',
    territory: string = 'US',
    realistic: boolean = true // Default to realistic mode for accurate simulation
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } } | null> {
    try {
        // Language instructions - used in both modes
        const languageInstructions: Record<string, string> = {
            it: 'Rispondi in italiano.',
            en: 'Respond in English.',
            es: 'Responde en español.',
            fr: 'Répondez en français.',
            de: 'Antworte auf Deutsch.'
        };

        let systemPrompt: string | undefined;
        let finalPrompt = prompt;

        if (realistic) {
            // Realistic mode: append language instruction to prompt (like a real user would)
            // This simulates a user typing "quali sono i migliori CRM? Rispondi in italiano"
            const langInstruction = languageInstructions[language];
            if (langInstruction && language !== 'en') {
                finalPrompt = `${prompt}\n\n${langInstruction}`;
            }
            // No system prompt in realistic mode
        } else {
            // Full system prompt (original behavior for internal tasks)
            systemPrompt = `You are an AI assistant helping users discover software solutions and services.
Provide a helpful, unbiased list of the top solutions for the user's query.
Include specific product/service names and brief descriptions.
Format as a numbered list when appropriate.
${languageInstructions[language] || languageInstructions.en}
Target market: ${territory}`;
            finalPrompt = prompt;
        }

        let result;

        // Handle each provider separately
        switch (provider) {
            case 'openai': {
                const config = await checkProviderConfiguration('openai');
                if (!config.configured) return null;
                const openaiProvider = await getLLMProvider('openai');
                result = await generateText({
                    model: openaiProvider(VISIBILITY_PROVIDERS.openai.model) as any,
                    system: systemPrompt,
                    prompt: finalPrompt
                });
                break;
            }

            case 'anthropic': {
                const config = await checkProviderConfiguration('anthropic');
                if (!config.configured) return null;
                const anthropicProvider = await getLLMProvider('anthropic');
                result = await generateText({
                    model: anthropicProvider(VISIBILITY_PROVIDERS.anthropic.model) as any,
                    system: systemPrompt,
                    prompt: finalPrompt
                });
                break;
            }

            case 'gemini': {
                const config = await checkProviderConfiguration('gemini');
                if (!config.configured) return null;

                // Use native Google SDK to avoid AI SDK v3 compatibility issues
                const adminKey = await getAdminApiKey('GEMINI');
                const apiKey = adminKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
                if (!apiKey) return null;

                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: VISIBILITY_PROVIDERS.gemini.model });

                // In realistic mode, just send the user prompt directly (simulates free user)
                const geminiPrompt = systemPrompt ? `${systemPrompt}\n\n${finalPrompt}` : finalPrompt;

                const geminiResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }]
                });

                const response = geminiResult.response;
                const text = response.text();
                const usageMetadata = response.usageMetadata;

                return {
                    text,
                    usage: {
                        inputTokens: usageMetadata?.promptTokenCount ?? 0,
                        outputTokens: usageMetadata?.candidatesTokenCount ?? 0
                    }
                };
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

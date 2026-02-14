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
            where: { id: "default" },
            select: {
                openaiApiKey: true,
                anthropicApiKey: true,
                geminiApiKey: true,
                googleSerpApiKey: true
            }
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
type LLMProvider = 'openai' | 'anthropic' | 'gemini';

const latestModelCache = new Map<LLMProvider, { model: string; fetchedAt: number }>();
const LATEST_MODEL_TTL_MS = 1000 * 60 * 60 * 6;

async function listModelsOpenAI(apiKey: string): Promise<Array<{ id: string; created?: number }>> {
    const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI list models failed: ${text}`);
    }
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data.map((m: any) => ({ id: m.id, created: m.created })) : [];
}

async function listModelsAnthropic(apiKey: string): Promise<Array<{ id: string; created?: string }>> {
    const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic list models failed: ${text}`);
    }
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data.map((m: any) => ({ id: m.id, created: m.created_at })) : [];
}

async function listModelsGemini(apiKey: string): Promise<string[]> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gemini list models failed: ${text}`);
    }
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return models
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => String(m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
}

function pickLatestOpenAIModel(models: Array<{ id: string; created?: number }>): string | null {
    const candidates = models
        .filter(m => m.id.startsWith('gpt-5') && !m.id.includes('mini') && !m.id.includes('nano'));
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => (b.created || 0) - (a.created || 0));
    return sorted[0]?.id || null;
}

function pickLatestAnthropicModel(models: Array<{ id: string; created?: string }>): string | null {
    const preference = ['claude-sonnet-4-5', 'claude-3-7-sonnet', 'claude-3-5-sonnet'];
    for (const prefix of preference) {
        const found = models.find(m => m.id.includes(prefix));
        if (found?.id) return found.id;
    }
    return null;
}

function pickLatestGeminiModel(models: string[]): string | null {
    const preference = [
        'gemini-3.0-flash-latest',
        'gemini-3.0-pro',
        'gemini-3.0',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest'
    ];
    for (const pref of preference) {
        if (models.includes(pref)) return pref;
    }
    return models[0] || null;
}

async function getLatestVisibilityModel(provider: LLMProvider): Promise<string> {
    const cached = latestModelCache.get(provider);
    if (cached && Date.now() - cached.fetchedAt < LATEST_MODEL_TTL_MS) {
        return cached.model;
    }

    try {
        if (provider === 'openai') {
            const apiKey = (await getAdminApiKey('OPENAI')) || process.env.OPENAI_API_KEY;
            if (!apiKey) return VISIBILITY_PROVIDERS.openai.model;
            const models = await listModelsOpenAI(apiKey);
            const latest = pickLatestOpenAIModel(models);
            if (latest) {
                latestModelCache.set('openai', { model: latest, fetchedAt: Date.now() });
                return latest;
            }
        }

        if (provider === 'anthropic') {
            const apiKey = (await getAdminApiKey('ANTHROPIC')) || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return VISIBILITY_PROVIDERS.anthropic.model;
            const models = await listModelsAnthropic(apiKey);
            const latest = pickLatestAnthropicModel(models);
            if (latest) {
                latestModelCache.set('anthropic', { model: latest, fetchedAt: Date.now() });
                return latest;
            }
        }

        if (provider === 'gemini') {
            const apiKey = (await getAdminApiKey('GEMINI')) || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            if (!apiKey) return VISIBILITY_PROVIDERS.gemini.model;
            const models = await listModelsGemini(apiKey);
            const latest = pickLatestGeminiModel(models);
            if (latest) {
                latestModelCache.set('gemini', { model: latest, fetchedAt: Date.now() });
                return latest;
            }
        }
    } catch (error) {
        console.warn(`[visibility] Failed to refresh latest model for ${provider}:`, error);
    }

    return VISIBILITY_PROVIDERS[provider].model;
}

export async function getSystemLLM(options?: { preferLatestVisibilityModel?: boolean }) {
    const providers: ('openai' | 'anthropic' | 'gemini')[] = ['openai', 'anthropic', 'gemini'];

    for (const provider of providers) {
        try {
            const config = await checkProviderConfiguration(provider);
            if (config.configured) {
                const modelProvider = await getLLMProvider(provider);
                const modelName = options?.preferLatestVisibilityModel
                    ? await getLatestVisibilityModel(provider)
                    : VISIBILITY_PROVIDERS[provider].model;
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
 * IMPORTANT: These models should match what users see
 * when using each AI assistant's web interface:
 * - ChatGPT: GPT-5.2
 * - Claude: Sonnet 4.5
 * - Gemini: 3.0 Flash
 */
export const VISIBILITY_PROVIDERS = {
    openai: {
        model: 'gpt-5.2',
        displayName: 'ChatGPT'
    },
    anthropic: {
        model: 'claude-sonnet-4-5',
        displayName: 'Claude'
    },
    gemini: {
        model: 'gemini-3.0-flash-latest',
        fallbackModels: ['gemini-1.5-flash-latest'],
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
                const modelName = await getLatestVisibilityModel('openai');
                result = await generateText({
                    model: openaiProvider(modelName) as any,
                    system: systemPrompt,
                    prompt: finalPrompt
                });
                break;
            }

            case 'anthropic': {
                const config = await checkProviderConfiguration('anthropic');
                if (!config.configured) return null;
                const anthropicProvider = await getLLMProvider('anthropic');
                const modelName = await getLatestVisibilityModel('anthropic');
                result = await generateText({
                    model: anthropicProvider(modelName) as any,
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
                const primaryModel = await getLatestVisibilityModel('gemini');
                const modelCandidates = [
                    primaryModel,
                    ...(VISIBILITY_PROVIDERS.gemini.fallbackModels || [])
                ];

                const geminiPrompt = systemPrompt ? `${systemPrompt}\n\n${finalPrompt}` : finalPrompt;

                for (const modelName of modelCandidates) {
                    try {
                        const model = genAI.getGenerativeModel({ model: modelName });
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
                    } catch (err: any) {
                        const message = String(err?.message || '');
                        const status = err?.status || err?.statusCode;
                        const isModelNotFound = status === 404 || message.includes('not found') || message.includes('not supported');
                        if (!isModelNotFound) {
                            throw err;
                        }
                        console.warn(`[visibility] Gemini model not available: ${modelName}. Trying fallback...`);
                    }
                }
                return null;
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

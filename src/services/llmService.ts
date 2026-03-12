import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Bot } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getConfigValue } from '@/lib/config';

export type ModelProvider = 'openai' | 'anthropic' | 'gemini';
export type InterviewModelRole = 'primary' | 'critical' | 'quality' | 'dataCollection';

interface InterviewModelNames {
    primary: string;
    critical: string;
    quality: string;
    dataCollection: string;
}

interface InterviewModelSelection {
    provider: ModelProvider;
    name: string;
}

interface InterviewModelSelections {
    primary: InterviewModelSelection;
    critical: InterviewModelSelection;
    quality: InterviewModelSelection;
    dataCollection: InterviewModelSelection;
}

export interface InterviewRuntimeModels {
    primary: any;
    critical: any;
    quality: any;
    dataCollection: any;
    names: InterviewModelNames;
    providers: Record<InterviewModelRole, ModelProvider>;
}

// Cache for methodology file - loaded once at startup
let methodologyCache: string | null = null;

type LLMGlobalConfig = {
    openaiApiKey: string | null;
    anthropicApiKey: string | null;
    geminiApiKey: string | null;
};

// Cache for GlobalConfig - TTL 5 minutes
let globalConfigCache: LLMGlobalConfig | null = null;
let globalConfigCacheTime: number = 0;
const GLOBAL_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class LLMService {
    private static parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
        if (value == null) return defaultValue;
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
        return defaultValue;
    }

    private static getDefaultModelName(provider: ModelProvider, bot: Bot): string {
        if (provider === 'anthropic') {
            return bot.modelName || 'claude-haiku-4-5';
        }
        if (provider === 'gemini') {
            return bot.modelName || 'gemini-2.5-flash';
        }
        return bot.modelName || 'gpt-4.1-mini';
    }

    private static createSingleProviderSelections(
        provider: ModelProvider,
        names: InterviewModelNames
    ): InterviewModelSelections {
        return {
            primary: { provider, name: names.primary },
            critical: { provider, name: names.critical },
            quality: { provider, name: names.quality },
            dataCollection: { provider, name: names.dataCollection }
        };
    }

    private static selectionsToNames(selections: InterviewModelSelections): InterviewModelNames {
        return {
            primary: selections.primary.name,
            critical: selections.critical.name,
            quality: selections.quality.name,
            dataCollection: selections.dataCollection.name
        };
    }

    private static buildAdvancedSelections(availability: Record<ModelProvider, boolean>): InterviewModelSelections {
        const primary: InterviewModelSelection = availability.openai
            ? { provider: 'openai', name: 'gpt-5-mini' }
            : availability.gemini
                ? { provider: 'gemini', name: 'gemini-2.5-flash' }
                : availability.anthropic
                    ? { provider: 'anthropic', name: 'claude-haiku-4-5' }
                    : { provider: 'openai', name: 'gpt-4.1-mini' };

        const critical: InterviewModelSelection = availability.anthropic
            ? { provider: 'anthropic', name: 'claude-haiku-4-5' }
            : availability.openai
                ? { provider: 'openai', name: 'gpt-4.1' }
                : availability.gemini
                    ? { provider: 'gemini', name: 'gemini-2.5-flash' }
                    : primary;

        const quality: InterviewModelSelection = availability.anthropic
            ? { provider: 'anthropic', name: 'claude-haiku-4-5' }
            : critical;

        const dataCollection: InterviewModelSelection = availability.openai
            ? { provider: 'openai', name: 'gpt-5-nano' }
            : availability.gemini
                ? { provider: 'gemini', name: 'gemini-2.5-flash-lite' }
                : primary;

        return { primary, critical, quality, dataCollection };
    }

    /**
     * Maps quality tier to model names (and optional cross-provider override).
     * Called in getInterviewRuntimeModels after base names are resolved.
     *
     * Tier → model rationale:
     *  - quantitativo: gpt-4.1-mini primary + gpt-4.1 critical — fast/cheap mass interviews, smarter supervisor
     *  - intermedio:   gpt-4.1 all roles — flagship OpenAI, good signal detection
     *  - avanzato:     mixed fast primary + stronger critical path — keeps conversational quality while containing latency
     */
    private static applyQualityTierOverride(
        selections: InterviewModelSelections,
        qualityTier: string,
        availability: Record<ModelProvider, boolean>
    ): InterviewModelSelections {
        if (qualityTier === 'quantitativo') {
            const names = this.selectionsToNames(selections);
            // Upgrade legacy gpt-4o-mini → gpt-4.1-mini; legacy gpt-4o → gpt-4.1
            const primary = names.primary === 'gpt-4o-mini' ? 'gpt-4.1-mini' : names.primary;
            const critical = names.critical === 'gpt-4o' ? 'gpt-4.1' : names.critical;
            return this.createSingleProviderSelections(selections.primary.provider, {
                ...names,
                primary,
                critical,
                quality: critical,
                dataCollection: critical
            });
        }
        if (qualityTier === 'intermedio') {
            return this.createSingleProviderSelections('openai', {
                primary: 'gpt-4.1',
                critical: 'gpt-4.1',
                quality: 'gpt-4.1',
                dataCollection: 'gpt-4.1'
            });
        }
        if (qualityTier === 'avanzato') {
            return this.buildAdvancedSelections(availability);
        }
        return selections;
    }

    private static getOpenAICriticalFallback(baseModelName: string): string {
        const trimmed = String(baseModelName || '').trim();
        const normalized = trimmed.toLowerCase();
        // GPT-5 family
        if (normalized === 'gpt-5-mini') return 'gpt-5.1';
        if (normalized === 'gpt-5') return 'gpt-5.2';
        if (normalized === 'gpt-5.1') return 'gpt-5.2';
        // Legacy GPT-4 family
        if (normalized === 'gpt-4o-mini') return 'gpt-4o';
        if (normalized === 'gpt-4.1-mini') return 'gpt-4.1';
        if (normalized.endsWith('-mini')) return trimmed.replace(/-mini$/i, '');
        return trimmed;
    }

    private static resolveModelNames(provider: ModelProvider, baseModelName: string): InterviewModelNames {
        const providerPrefix = provider === 'anthropic'
            ? 'ANTHROPIC'
            : provider === 'gemini'
                ? 'GEMINI'
                : 'OPENAI';
        const selectiveRoutingEnabled = this.parseBooleanEnv(
            process.env[`${providerPrefix}_INTERVIEW_SELECTIVE_MODEL_ROUTING`] || process.env.INTERVIEW_SELECTIVE_MODEL_ROUTING,
            true
        );

        const envPrimary = process.env[`${providerPrefix}_INTERVIEW_MODEL_PRIMARY`] || process.env.INTERVIEW_MODEL_PRIMARY;
        const envCritical = process.env[`${providerPrefix}_INTERVIEW_MODEL_CRITICAL`] || process.env.INTERVIEW_MODEL_CRITICAL;
        const envQuality = process.env[`${providerPrefix}_INTERVIEW_MODEL_QUALITY`] || process.env.INTERVIEW_MODEL_QUALITY;
        const envDataCollection = process.env[`${providerPrefix}_INTERVIEW_MODEL_DATA_COLLECTION`] || process.env.INTERVIEW_MODEL_DATA_COLLECTION;

        const primary = (envPrimary || '').trim() || baseModelName;
        const critical = (envCritical || '').trim()
            || (selectiveRoutingEnabled && provider === 'openai'
                ? this.getOpenAICriticalFallback(primary)
                : primary);
        const quality = (envQuality || '').trim() || critical;
        const dataCollection = (envDataCollection || '').trim() || critical;

        return { primary, critical, quality, dataCollection };
    }

    /**
     * Get GlobalConfig with caching (5 min TTL)
     */
    static async getGlobalConfig(): Promise<LLMGlobalConfig | null> {
        const now = Date.now();
        if (globalConfigCache && (now - globalConfigCacheTime) < GLOBAL_CONFIG_CACHE_TTL) {
            return globalConfigCache;
        }

        globalConfigCache = await prisma.globalConfig.findUnique({
            where: { id: "default" },
            select: {
                openaiApiKey: true,
                anthropicApiKey: true,
                geminiApiKey: true
            }
        });
        globalConfigCacheTime = now;
        return globalConfigCache;
    }

    /**
     * Invalidate GlobalConfig cache (call after admin updates config)
     */
    static invalidateGlobalConfigCache(): void {
        globalConfigCache = null;
        globalConfigCacheTime = 0;
    }

    static async getApiKey(bot: Bot, provider: ModelProvider): Promise<string | null> {
        // 1. Bot specific key
        if (provider === 'openai' && bot.openaiApiKey) return bot.openaiApiKey;
        if (provider === 'anthropic' && bot.anthropicApiKey) return bot.anthropicApiKey;

        // 2. Global config key (Admin managed via DB) - use centralised config
        const globalConfig = await this.getGlobalConfig();
        if (provider === 'openai') {
            return globalConfig?.openaiApiKey || await getConfigValue('openaiApiKey');
        }
        if (provider === 'anthropic') {
            return globalConfig?.anthropicApiKey || await getConfigValue('anthropicApiKey');
        }
        return globalConfig?.geminiApiKey || await getConfigValue('geminiApiKey');
    }

    private static createProviderFactory(provider: ModelProvider, apiKey: string): any {
        if (provider === 'anthropic') {
            return createAnthropic({ apiKey });
        }
        if (provider === 'gemini') {
            return createGoogleGenerativeAI({ apiKey });
        }
        return createOpenAI({ apiKey });
    }

    static async getInterviewRuntimeModels(bot: Bot): Promise<InterviewRuntimeModels> {
        const provider = (bot.modelProvider as ModelProvider) || 'openai';
        const baseModelName = this.getDefaultModelName(provider, bot);
        const baseNames = this.resolveModelNames(provider, baseModelName);
        const baseSelections = this.createSingleProviderSelections(provider, baseNames);
        const [openaiKey, anthropicKey, geminiKey] = await Promise.all([
            this.getApiKey(bot, 'openai'),
            this.getApiKey(bot, 'anthropic'),
            this.getApiKey(bot, 'gemini')
        ]);
        const providerAvailability: Record<ModelProvider, boolean> = {
            openai: Boolean(openaiKey),
            anthropic: Boolean(anthropicKey),
            gemini: Boolean(geminiKey)
        };

        // Apply quality tier override. 'avanzato' can mix providers by role.
        const qualityTier = (bot as any).interviewerQuality || 'quantitativo';
        let finalSelections = this.applyQualityTierOverride(baseSelections, qualityTier, providerAvailability);
        if (qualityTier === 'avanzato' && !providerAvailability.openai && !providerAvailability.anthropic && !providerAvailability.gemini) {
            finalSelections = this.createSingleProviderSelections('openai', {
                primary: 'gpt-4.1-mini',
                critical: 'gpt-4.1',
                quality: 'gpt-4.1',
                dataCollection: 'gpt-4.1-mini'
            });
        }
        const finalNames = this.selectionsToNames(finalSelections);

        const providerCache = new Map<ModelProvider, any>();

        const instantiate = async (selection: InterviewModelSelection) => {
            let factory = providerCache.get(selection.provider);
            if (!factory) {
                const apiKey = await this.getApiKey(bot, selection.provider);
                if (!apiKey) {
                    throw new Error(`API key missing for provider: ${selection.provider}`);
                }
                factory = this.createProviderFactory(selection.provider, apiKey);
                providerCache.set(selection.provider, factory);
            }
            return factory(selection.name);
        };

        console.log(
            `🧠 [MODEL_ROUTING] tier=${qualityTier} primary=${finalSelections.primary.provider}:${finalNames.primary} critical=${finalSelections.critical.provider}:${finalNames.critical} quality=${finalSelections.quality.provider}:${finalNames.quality} dataCollection=${finalSelections.dataCollection.provider}:${finalNames.dataCollection}`
        );

        return {
            primary: await instantiate(finalSelections.primary),
            critical: await instantiate(finalSelections.critical),
            quality: await instantiate(finalSelections.quality),
            dataCollection: await instantiate(finalSelections.dataCollection),
            names: finalNames,
            providers: {
                primary: finalSelections.primary.provider,
                critical: finalSelections.critical.provider,
                quality: finalSelections.quality.provider,
                dataCollection: finalSelections.dataCollection.provider
            }
        };
    }

    static async getModel(bot: Bot, role: InterviewModelRole = 'primary') {
        const runtimeModels = await this.getInterviewRuntimeModels(bot);
        return runtimeModels[role];
    }

    /**
     * Helper to load methodology from disk (cached)
     */
    static getMethodology(): string {
        if (methodologyCache !== null) {
            return methodologyCache;
        }

        try {
            methodologyCache = fs.readFileSync(
                path.join(process.cwd(), 'knowledge', 'interview-methodology.md'),
                'utf-8'
            );
            return methodologyCache;
        } catch {
            console.warn("Methodology file missing, using empty string");
            methodologyCache = "";
            return methodologyCache;
        }
    }
}

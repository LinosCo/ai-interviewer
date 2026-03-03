import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Bot } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getConfigValue } from '@/lib/config';

export type ModelProvider = 'openai' | 'anthropic';
export type InterviewModelRole = 'primary' | 'critical' | 'quality' | 'dataCollection';

interface InterviewModelNames {
    primary: string;
    critical: string;
    quality: string;
    dataCollection: string;
}

export interface InterviewRuntimeModels {
    primary: any;
    critical: any;
    quality: any;
    dataCollection: any;
    names: InterviewModelNames;
}

// Cache for methodology file - loaded once at startup
let methodologyCache: string | null = null;

type LLMGlobalConfig = {
    openaiApiKey: string | null;
    anthropicApiKey: string | null;
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
            return bot.modelName || 'claude-3-5-sonnet-20241022';
        }
        return bot.modelName || 'gpt-4.1-mini';
    }

    /**
     * Maps quality tier to model names (and optional cross-provider override).
     * Called in getInterviewRuntimeModels after base names are resolved.
     *
     * Tier → model rationale:
     *  - quantitativo: gpt-4.1-mini primary + gpt-4.1 critical — fast/cheap mass interviews, smarter supervisor
     *  - intermedio:   gpt-4.1 all roles — flagship OpenAI, good signal detection
     *  - avanzato:     claude-sonnet-4-5-20250929 — genuine superiority for cross-turn synthesis + qualitative reasoning
     */
    private static applyQualityTierOverride(
        names: InterviewModelNames,
        qualityTier: string
    ): { names: InterviewModelNames; overrideProvider?: ModelProvider } {
        if (qualityTier === 'quantitativo') {
            // Upgrade legacy gpt-4o-mini → gpt-4.1-mini; legacy gpt-4o → gpt-4.1
            const primary = names.primary === 'gpt-4o-mini' ? 'gpt-4.1-mini' : names.primary;
            const critical = names.critical === 'gpt-4o' ? 'gpt-4.1' : names.critical;
            return { names: { ...names, primary, critical, quality: critical, dataCollection: critical } };
        }
        if (qualityTier === 'intermedio') {
            return { names: { primary: 'gpt-4.1', critical: 'gpt-4.1', quality: 'gpt-4.1', dataCollection: 'gpt-4.1' } };
        }
        if (qualityTier === 'avanzato') {
            const claudeModel = 'claude-sonnet-4-5-20250929';
            return {
                names: { primary: claudeModel, critical: claudeModel, quality: claudeModel, dataCollection: claudeModel },
                overrideProvider: 'anthropic'
            };
        }
        return { names };
    }

    private static getOpenAICriticalFallback(baseModelName: string): string {
        const trimmed = String(baseModelName || '').trim();
        const normalized = trimmed.toLowerCase();
        if (normalized === 'gpt-4o-mini') return 'gpt-4o';
        if (normalized === 'gpt-4.1-mini') return 'gpt-4.1';
        if (normalized.endsWith('-mini')) return trimmed.replace(/-mini$/i, '');
        return trimmed;
    }

    private static resolveModelNames(provider: ModelProvider, baseModelName: string): InterviewModelNames {
        const providerPrefix = provider === 'anthropic' ? 'ANTHROPIC' : 'OPENAI';
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
                anthropicApiKey: true
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
        } else {
            return globalConfig?.anthropicApiKey || await getConfigValue('anthropicApiKey');
        }
    }

    static async getInterviewRuntimeModels(bot: Bot): Promise<InterviewRuntimeModels> {
        const provider = (bot.modelProvider as ModelProvider) || 'openai';
        const baseModelName = this.getDefaultModelName(provider, bot);
        const baseNames = this.resolveModelNames(provider, baseModelName);

        // Apply quality tier override (may switch provider to Anthropic for 'avanzato')
        const qualityTier = (bot as any).interviewerQuality || 'quantitativo';
        const { names: tieredNames, overrideProvider } = this.applyQualityTierOverride(baseNames, qualityTier);

        // Determine effective provider and API key
        const effectiveProvider = overrideProvider || provider;
        const apiKey = await this.getApiKey(bot, effectiveProvider);

        // Fallback: if avanzato requests Anthropic but no key is configured → use gpt-4.1 (intermedio level)
        const finalNames = (qualityTier === 'avanzato' && !apiKey)
            ? { primary: 'gpt-4.1', critical: 'gpt-4.1', quality: 'gpt-4.1', dataCollection: 'gpt-4.1' }
            : tieredNames;

        const resolvedProvider = (qualityTier === 'avanzato' && !apiKey) ? provider : effectiveProvider;
        const resolvedApiKey = (qualityTier === 'avanzato' && !apiKey)
            ? await this.getApiKey(bot, provider)
            : apiKey;

        if (!resolvedApiKey) {
            throw new Error(`API key missing for provider: ${resolvedProvider}`);
        }

        console.log(`🧠 [MODEL_ROUTING] tier=${qualityTier} provider=${resolvedProvider} primary=${finalNames.primary} critical=${finalNames.critical}`);

        if (resolvedProvider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey: resolvedApiKey });
            return {
                primary: anthropic(finalNames.primary),
                critical: anthropic(finalNames.critical),
                quality: anthropic(finalNames.quality),
                dataCollection: anthropic(finalNames.dataCollection),
                names: finalNames
            };
        } else {
            const openai = createOpenAI({ apiKey: resolvedApiKey });
            return {
                primary: openai(finalNames.primary),
                critical: openai(finalNames.critical),
                quality: openai(finalNames.quality),
                dataCollection: openai(finalNames.dataCollection),
                names: finalNames
            };
        }
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

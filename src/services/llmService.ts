import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Bot } from '@prisma/client';
import fs from 'fs';
import path from 'path';

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
        return bot.modelName || 'gpt-4o-mini';
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

        // 2. Global / Env key (Admin managed) - now with cache
        const globalConfig = await this.getGlobalConfig();
        if (provider === 'openai') {
            return globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || null;
        } else {
            return globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || null;
        }
    }

    static async getInterviewRuntimeModels(bot: Bot): Promise<InterviewRuntimeModels> {
        const provider = (bot.modelProvider as ModelProvider) || 'openai';
        const apiKey = await this.getApiKey(bot, provider);
        const baseModelName = this.getDefaultModelName(provider, bot);
        const names = this.resolveModelNames(provider, baseModelName);

        if (!apiKey) {
            throw new Error(`API key missing for provider: ${provider}`);
        }

        if (provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey });
            return {
                primary: anthropic(names.primary),
                critical: anthropic(names.critical),
                quality: anthropic(names.quality),
                dataCollection: anthropic(names.dataCollection),
                names
            };
        } else {
            const openai = createOpenAI({ apiKey });
            return {
                primary: openai(names.primary),
                critical: openai(names.critical),
                quality: openai(names.quality),
                dataCollection: openai(names.dataCollection),
                names
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

import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Bot, GlobalConfig, User } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export type ModelProvider = 'openai' | 'anthropic';

// Cache for methodology file - loaded once at startup
let methodologyCache: string | null = null;

export class LLMService {
    static async getApiKey(bot: Bot, provider: ModelProvider): Promise<string | null> {
        // 1. Bot specific key
        if (provider === 'openai' && bot.openaiApiKey) return bot.openaiApiKey;
        if (provider === 'anthropic' && bot.anthropicApiKey) return bot.anthropicApiKey;

        // 2. Global / Env key (Admin managed)
        const globalConfig = await prisma.globalConfig.findUnique({ where: { id: "default" } });
        if (provider === 'openai') {
            return globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || null;
        } else {
            return globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || null;
        }
    }

    static async getModel(bot: Bot) {
        const provider = (bot.modelProvider as ModelProvider) || 'openai';
        const apiKey = await this.getApiKey(bot, provider);

        if (!apiKey) {
            throw new Error(`API key missing for provider: ${provider}`);
        }

        if (provider === 'anthropic') {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(bot.modelName || 'claude-3-5-sonnet-latest');
        } else {
            const openai = createOpenAI({ apiKey });
            return openai(bot.modelName || 'gpt-4o');
        }
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
        } catch (e) {
            console.warn("Methodology file missing, using empty string");
            methodologyCache = "";
            return methodologyCache;
        }
    }
}

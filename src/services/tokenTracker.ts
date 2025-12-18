import { prisma as db } from '@/lib/prisma';
import { HIDDEN_LIMITS } from '@/config/limits';

interface TokenUsage {
    conversationId: string;
    sessionId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    exchangeCount: number;
    startedAt: Date;
    lastActivityAt: Date;
}

export class TokenTracker {
    private usageMap: Map<string, TokenUsage> = new Map();

    async trackUsage(
        conversationId: string,
        sessionId: string,
        inputTokens: number,
        outputTokens: number
    ): Promise<void> {
        const key = `${conversationId}:${sessionId}`;
        const existing = this.usageMap.get(key);

        if (existing) {
            existing.inputTokens += inputTokens;
            existing.outputTokens += outputTokens;
            existing.totalTokens += inputTokens + outputTokens;
            existing.exchangeCount += 1;
            existing.lastActivityAt = new Date();
        } else {
            this.usageMap.set(key, {
                conversationId,
                sessionId,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                exchangeCount: 1,
                startedAt: new Date(),
                lastActivityAt: new Date()
            });
        }

        // Persist to database for billing/analytics
        await this.persistUsage(key, this.usageMap.get(key)!);
    }

    getUsage(conversationId: string, sessionId: string): TokenUsage | null {
        return this.usageMap.get(`${conversationId}:${sessionId}`) || null;
    }

    checkLimits(usage: TokenUsage, limits: {
        maxExchanges: number;
        maxTokensTotal: number;
        maxCharsPerMessage: number;
        inactivityTimeout: number;
    }): {
        allowed: boolean;
        reason?: string;
        shouldClose?: boolean;
    } {
        if (usage.exchangeCount >= limits.maxExchanges) {
            return {
                allowed: false,
                reason: 'max_exchanges_reached',
                shouldClose: true
            };
        }

        if (usage.totalTokens >= limits.maxTokensTotal) {
            return {
                allowed: false,
                reason: 'max_tokens_reached',
                shouldClose: true
            };
        }

        const inactiveMinutes = (Date.now() - usage.lastActivityAt.getTime()) / 60000;
        if (inactiveMinutes >= limits.inactivityTimeout) {
            return {
                allowed: false,
                reason: 'inactivity_timeout',
                shouldClose: true
            };
        }

        return { allowed: true };
    }

    private async persistUsage(key: string, usage: TokenUsage): Promise<void> {
        // Update conversation with token counts
        await db.conversation.update({
            where: { id: usage.conversationId },
            data: {
                exchangeCount: usage.exchangeCount,
                totalTokens: usage.totalTokens
            }
        });

        // Log to UsageLog for billing
        const conversation = await db.conversation.findUnique({
            where: { id: usage.conversationId },
            include: {
                bot: {
                    include: {
                        project: true
                    }
                }
            }
        });

        if (conversation?.bot?.project?.organizationId) {
            await db.usageLog.create({
                data: {
                    organizationId: conversation.bot.project.organizationId,
                    type: 'TOKEN_USAGE',
                    tokensInput: usage.inputTokens,
                    tokensOutput: usage.outputTokens,
                    resourceId: usage.conversationId,
                    metadata: {
                        sessionId: usage.sessionId,
                        exchangeCount: usage.exchangeCount
                    }
                }
            });
        }
    }
}

export const tokenTracker = new TokenTracker();

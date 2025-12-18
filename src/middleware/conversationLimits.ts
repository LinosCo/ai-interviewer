import { NextRequest, NextResponse } from 'next/server';
import { tokenTracker } from '@/services/tokenTracker';
import { planService } from '@/services/planService';
import { HIDDEN_LIMITS } from '@/config/limits';

/**
 * Conversation Limits Middleware
 * Enforces hidden limits: exchanges, tokens, message length, inactivity
 */
export async function enforceConversationLimits(
    conversationId: string,
    sessionId: string,
    orgId: string,
    messageContent?: string
): Promise<{ allowed: boolean; error?: NextResponse; shouldClose?: boolean; closingMessage?: string }> {
    try {
        // Get plan limits
        const limits = await planService.getHiddenLimits(orgId);

        // Get current usage
        const usage = tokenTracker.getUsage(conversationId, sessionId);

        if (usage) {
            const check = tokenTracker.checkLimits(usage, limits);

            if (!check.allowed && check.shouldClose) {
                // Generate graceful closing message
                const closingMessage = getClosingMessage(check.reason || 'unknown');

                return {
                    allowed: false,
                    shouldClose: true,
                    closingMessage,
                    error: NextResponse.json(
                        {
                            action: 'CLOSE_INTERVIEW',
                            reason: check.reason,
                            message: closingMessage
                        },
                        { status: 200 }
                    )
                };
            }
        }

        // Check message length if provided
        if (messageContent) {
            const messageLength = messageContent.length;
            if (messageLength > limits.maxCharsPerMessage) {
                return {
                    allowed: false,
                    error: NextResponse.json(
                        {
                            error: 'Message too long',
                            code: 'MESSAGE_TOO_LONG',
                            maxLength: limits.maxCharsPerMessage,
                            actualLength: messageLength
                        },
                        { status: 400 }
                    )
                };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('Conversation limits check error:', error);
        return {
            allowed: false,
            error: NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            )
        };
    }
}

function getClosingMessage(reason: string): string {
    switch (reason) {
        case 'max_exchanges_reached':
            return "Grazie mille per il tempo che ci hai dedicato! Abbiamo raccolto informazioni molto utili. C'è qualcos'altro che vorresti aggiungere in chiusura?";
        case 'max_tokens_reached':
            return "Grazie per questa conversazione così ricca! Prima di concludere, c'è un ultimo pensiero che vorresti condividere?";
        case 'inactivity_timeout':
            return "Sembra che tu sia stato occupato. Grazie per le risposte che ci hai dato, sono state molto utili!";
        default:
            return "Grazie per aver partecipato a questa intervista!";
    }
}

/**
 * Check if conversation is approaching limits (for proactive closing)
 */
export async function checkConversationApproachingLimits(
    conversationId: string,
    sessionId: string,
    orgId: string
): Promise<{ approaching: boolean; exchangesRemaining: number; tokensRemaining: number }> {
    const limits = await planService.getHiddenLimits(orgId);
    const usage = tokenTracker.getUsage(conversationId, sessionId);

    if (!usage) {
        return {
            approaching: false,
            exchangesRemaining: limits.maxExchanges,
            tokensRemaining: limits.maxTokensTotal
        };
    }

    const exchangesRemaining = limits.maxExchanges - usage.exchangeCount;
    const tokensRemaining = limits.maxTokensTotal - usage.totalTokens;

    // Consider "approaching" if within 2 exchanges or 5000 tokens
    const approaching = exchangesRemaining <= 2 || tokensRemaining < 5000;

    return {
        approaching,
        exchangesRemaining,
        tokensRemaining
    };
}

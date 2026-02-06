import { NextResponse } from 'next/server';
import { tokenTracker } from '@/services/tokenTracker';

const SAFETY_MAX_CHARS_PER_MESSAGE = 30000;
const SAFETY_APPROACHING_THRESHOLD_EXCHANGES = 500;
const SAFETY_APPROACHING_THRESHOLD_TOKENS = 2_000_000;

/**
 * Conversation limits middleware
 * Legacy hard limits are removed; this only applies high safety guardrails.
 */
export async function enforceConversationLimits(
    conversationId: string,
    sessionId: string,
    _orgId: string,
    messageContent?: string
): Promise<{ allowed: boolean; error?: NextResponse; shouldClose?: boolean; closingMessage?: string }> {
    try {
        void conversationId;
        void sessionId;
        void _orgId;

        // Legacy hard limits have been removed.
        // Keep only a high safety guardrail against oversized payload abuse.
        if (messageContent) {
            const messageLength = messageContent.length;
            if (messageLength > SAFETY_MAX_CHARS_PER_MESSAGE) {
                return {
                    allowed: false,
                    error: NextResponse.json(
                        {
                            error: 'Message too long',
                            code: 'MESSAGE_TOO_LONG',
                            maxLength: SAFETY_MAX_CHARS_PER_MESSAGE,
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

/**
 * Check if conversation is approaching limits (for proactive closing)
 */
export async function checkConversationApproachingLimits(
    conversationId: string,
    sessionId: string,
    _orgId: string
): Promise<{ approaching: boolean; exchangesRemaining: number; tokensRemaining: number }> {
    void _orgId;

    const usage = tokenTracker.getUsage(conversationId, sessionId);

    if (!usage) {
        return {
            approaching: false,
            exchangesRemaining: Number.POSITIVE_INFINITY,
            tokensRemaining: Number.POSITIVE_INFINITY
        };
    }

    const exchangesRemaining = Math.max(0, SAFETY_APPROACHING_THRESHOLD_EXCHANGES - usage.exchangeCount);
    const tokensRemaining = Math.max(0, SAFETY_APPROACHING_THRESHOLD_TOKENS - usage.totalTokens);
    const approaching = exchangesRemaining <= 25 || tokensRemaining <= 100000;

    return {
        approaching,
        exchangesRemaining,
        tokensRemaining
    };
}

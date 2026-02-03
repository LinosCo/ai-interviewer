import { NextResponse } from 'next/server';
import { HIDDEN_LIMITS } from '@/config/limits';
import { prisma as db } from '@/lib/prisma';

/**
 * Rate Limiter Middleware
 * Enforces plan-based rate limits and message cooldowns
 */

// In-memory store for cooldowns (use Redis in production)
const cooldownStore = new Map<string, number>();
let requestCount = 0;
const CLEANUP_THRESHOLD = 50; // Every 50 requests
const CLEANUP_AGE = 3600000; // 1 hour

export async function enforceMessageCooldown(
    sessionId: string,
    orgId: string
): Promise<{ allowed: boolean; error?: NextResponse; retryAfter?: number }> {
    try {
        const org = await db.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            return {
                allowed: false,
                error: NextResponse.json({ error: 'Organization not found' }, { status: 404 })
            };
        }

        const planKey = org.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.rateLimit;
        const limits = HIDDEN_LIMITS.rateLimit[planKey];

        const lastMessageKey = `cooldown:${sessionId}`;
        const lastMessageTime = cooldownStore.get(lastMessageKey);

        if (lastMessageTime) {
            const elapsed = Date.now() - lastMessageTime;
            if (elapsed < limits.messageCooldownMs) {
                const retryAfter = Math.ceil((limits.messageCooldownMs - elapsed) / 1000);
                return {
                    allowed: false,
                    retryAfter,
                    error: NextResponse.json(
                        {
                            error: 'Please wait before sending another message',
                            code: 'MESSAGE_COOLDOWN',
                            retryAfter
                        },
                        { status: 429 }
                    )
                };
            }
        }

        // Update last message time
        cooldownStore.set(lastMessageKey, Date.now());

        // Cleanup old entries periodically (O(K) where K is expired count)
        requestCount++;
        if (requestCount >= CLEANUP_THRESHOLD) {
            requestCount = 0;
            const expirationTime = Date.now() - CLEANUP_AGE;
            for (const [key, time] of cooldownStore.entries()) {
                if (time < expirationTime) {
                    cooldownStore.delete(key);
                } else {
                    break; // Map preserves insertion order
                }
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('Message cooldown check error:', error);
        return {
            allowed: false,
            error: NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        };
    }
}

/**
 * Check parallel interviews limit
 */
export async function checkParallelInterviewsLimit(
    orgId: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
    const org = await db.organization.findUnique({ where: { id: orgId } });
    if (!org) {
        return { allowed: false, current: 0, limit: 0 };
    }

    const planKey = org.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.rateLimit;
    const limits = HIDDEN_LIMITS.rateLimit[planKey];

    // Count active conversations in the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const activeConversations = await db.conversation.count({
        where: {
            bot: {
                project: {
                    organizationId: orgId
                }
            },
            status: 'IN_PROGRESS',
            startedAt: {
                gte: oneHourAgo
            }
        }
    });

    return {
        allowed: activeConversations < limits.maxParallelInterviews,
        current: activeConversations,
        limit: limits.maxParallelInterviews
    };
}

/**
 * @legacy — NOT WIRED. Zero imports in the codebase (verified 2026-03-01).
 * This middleware was written but never connected to any route or src/middleware.ts.
 * Safe to delete once confirmed unnecessary. Do NOT use without a refactor + test.
 */
import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';

/**
 * Rate Limiter Middleware
 * Enforces plan-based rate limits and message cooldowns.
 *
 * ARCHITECTURE DECISION (Sprint 1 Audit):
 * The cooldownStore intentionally uses an in-memory Map, NOT Redis/DB.
 *
 * Rationale:
 * 1. Railway Hobby = single instance → no cross-process sync needed
 * 2. The cooldown window is 250ms. A DB round-trip (10-50ms) would add
 *    significant latency to every message, defeating the purpose.
 * 3. Data loss on restart is harmless: at worst, one un-throttled message
 *    gets through — no security or billing impact.
 * 4. The Map self-cleans every 50 requests (entries older than 1 hour).
 *
 * When to migrate to Redis:
 * - If deployment moves to multi-instance (horizontal scaling)
 * - If the cooldown window increases significantly (>5s)
 * - If abuse tracking across deploys becomes a requirement
 */
const cooldownStore = new Map<string, number>();
let requestCount = 0;
const CLEANUP_THRESHOLD = 50; // Every 50 requests
const CLEANUP_AGE = 3600000; // 1 hour
const SAFETY_MIN_INTERVAL_MS = 250;

export async function enforceMessageCooldown(
    sessionId: string,
    _orgId: string
): Promise<{ allowed: boolean; error?: NextResponse; retryAfter?: number }> {
    try {
        void _orgId;

        const lastMessageKey = `cooldown:${sessionId}`;
        const lastMessageTime = cooldownStore.get(lastMessageKey);

        if (lastMessageTime) {
            const elapsed = Date.now() - lastMessageTime;
            if (elapsed < SAFETY_MIN_INTERVAL_MS) {
                const retryAfter = Math.ceil((SAFETY_MIN_INTERVAL_MS - elapsed) / 1000);
                return {
                    allowed: false,
                    retryAfter,
                    error: NextResponse.json(
                        {
                            error: 'Please wait a brief moment before sending another message',
                            code: 'MESSAGE_SAFETY_THROTTLE',
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

    // Legacy parallel interview hard limits are removed.
    // Keep this as informational telemetry only.
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
        allowed: true,
        current: activeConversations,
        limit: Number.MAX_SAFE_INTEGER
    };
}

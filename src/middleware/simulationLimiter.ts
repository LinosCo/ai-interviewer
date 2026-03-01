/**
 * @legacy — NOT WIRED. Zero imports in the codebase (verified 2026-03-01).
 * This middleware was written but never connected to any route or src/middleware.ts.
 * Safe to delete once confirmed unnecessary. Do NOT use without a refactor + test.
 */
import { NextResponse } from 'next/server';
import { HIDDEN_LIMITS } from '@/config/limits';
import { prisma as db } from '@/lib/prisma';

/**
 * Simulation Limiter Middleware
 * Prevents abuse of test/simulation features
 */

export async function checkSimulationLimit(
    botId: string,
    orgId: string
): Promise<{ allowed: boolean; error?: NextResponse; used?: number; limit?: number }> {
    try {
        const org = await db.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            return {
                allowed: false,
                error: NextResponse.json({ error: 'Organization not found' }, { status: 404 })
            };
        }

        const planKey = org.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.testing;
        const limits = HIDDEN_LIMITS.testing[planKey];

        // Count today's simulations for this bot
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const simulationsToday = await db.usageLog.count({
            where: {
                organizationId: orgId,
                type: 'SIMULATION',
                resourceId: botId,
                timestamp: { gte: today }
            }
        });

        if (simulationsToday >= limits.simulationsPerDayPerBot) {
            return {
                allowed: false,
                used: simulationsToday,
                limit: limits.simulationsPerDayPerBot,
                error: NextResponse.json(
                    {
                        error: 'Daily simulation limit reached',
                        code: 'SIMULATION_LIMIT_REACHED',
                        used: simulationsToday,
                        limit: limits.simulationsPerDayPerBot,
                        resetAt: getNextMidnightUTC()
                    },
                    { status: 429 }
                )
            };
        }

        return {
            allowed: true,
            used: simulationsToday,
            limit: limits.simulationsPerDayPerBot
        };
    } catch (error) {
        console.error('Simulation limit check error:', error);
        return {
            allowed: false,
            error: NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        };
    }
}

export async function checkRegenerationLimit(
    orgId: string
): Promise<{ allowed: boolean; error?: NextResponse; used?: number; limit?: number }> {
    try {
        const org = await db.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            return {
                allowed: false,
                error: NextResponse.json({ error: 'Organization not found' }, { status: 404 })
            };
        }

        const planKey = org.plan.toLowerCase() as keyof typeof HIDDEN_LIMITS.testing;
        const limits = HIDDEN_LIMITS.testing[planKey];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const regenerationsToday = await db.usageLog.count({
            where: {
                organizationId: orgId,
                type: 'AI_REGENERATION',
                timestamp: { gte: today }
            }
        });

        if (regenerationsToday >= limits.aiRegenerationsPerDay) {
            return {
                allowed: false,
                used: regenerationsToday,
                limit: limits.aiRegenerationsPerDay,
                error: NextResponse.json(
                    {
                        error: 'Daily AI regeneration limit reached',
                        code: 'REGENERATION_LIMIT_REACHED',
                        used: regenerationsToday,
                        limit: limits.aiRegenerationsPerDay,
                        resetAt: getNextMidnightUTC()
                    },
                    { status: 429 }
                )
            };
        }

        return {
            allowed: true,
            used: regenerationsToday,
            limit: limits.aiRegenerationsPerDay
        };
    } catch (error) {
        console.error('Regeneration limit check error:', error);
        return {
            allowed: false,
            error: NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        };
    }
}

function getNextMidnightUTC(): string {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.toISOString();
}

/**
 * Log simulation usage
 */
export async function logSimulation(botId: string, orgId: string): Promise<void> {
    await db.usageLog.create({
        data: {
            organizationId: orgId,
            type: 'SIMULATION',
            resourceId: botId,
            count: 1
        }
    });
}

/**
 * Log AI regeneration usage
 */
export async function logRegeneration(orgId: string, resourceId?: string): Promise<void> {
    await db.usageLog.create({
        data: {
            organizationId: orgId,
            type: 'AI_REGENERATION',
            resourceId,
            count: 1
        }
    });
}

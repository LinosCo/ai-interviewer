import { NextRequest, NextResponse } from 'next/server';
import { planService } from '@/services/planService';

/**
 * Response Limit Middleware
 * Enforces monthly response limits per organization
 */
export async function checkResponseLimit(
    orgId: string
): Promise<{ allowed: boolean; error?: NextResponse; limitInfo?: any }> {
    try {
        const limitCheck = await planService.checkResponseLimit(orgId);

        if (!limitCheck.allowed) {
            const nextReset = await getNextMonthReset(orgId);

            return {
                allowed: false,
                error: NextResponse.json(
                    {
                        error: 'Monthly response limit reached',
                        code: 'RESPONSE_LIMIT_REACHED',
                        used: limitCheck.used,
                        limit: limitCheck.limit,
                        remaining: limitCheck.remaining,
                        options: {
                            buyExtra: {
                                pricePerResponse: 0.25,
                                url: '/billing/add-responses'
                            },
                            upgrade: {
                                url: '/pricing'
                            },
                            waitUntil: nextReset
                        }
                    },
                    { status: 429 }
                )
            };
        }

        return {
            allowed: true,
            limitInfo: limitCheck
        };
    } catch (error) {
        console.error('Response limit check error:', error);
        return {
            allowed: false,
            error: NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            )
        };
    }
}

async function getNextMonthReset(orgId: string): Promise<string> {
    // Get organization's monthly reset date
    const org = await planService.getOrganizationPlan(orgId);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
}

/**
 * Middleware wrapper for Next.js API routes
 */
export function withResponseLimit() {
    return async (req: NextRequest) => {
        const orgId = req.headers.get('x-organization-id');

        if (!orgId) {
            return NextResponse.json(
                { error: 'Organization not found' },
                { status: 401 }
            );
        }

        const check = await checkResponseLimit(orgId);

        if (!check.allowed && check.error) {
            return check.error;
        }

        return null; // Continue to next middleware/handler
    };
}

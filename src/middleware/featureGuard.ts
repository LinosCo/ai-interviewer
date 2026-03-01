/**
 * @legacy — NOT WIRED. Zero imports in the codebase (verified 2026-03-01).
 * This middleware was written but never connected to any route or src/middleware.ts.
 * Safe to delete once confirmed unnecessary. Do NOT use without a refactor + test.
 */
import { NextRequest, NextResponse } from 'next/server';
import { planService } from '@/services/planService';
import { PlanLimits } from '@/config/plans';

/**
 * Feature Guard Middleware
 * Blocks access to features not available in the user's plan
 */
export function requireFeature(feature: keyof PlanLimits) {
    return async (req: NextRequest) => {
        try {
            // Get organization ID from request (assuming it's in headers or session)
            const orgId = req.headers.get('x-organization-id');

            if (!orgId) {
                return NextResponse.json(
                    { error: 'Organization not found', code: 'UNAUTHORIZED' },
                    { status: 401 }
                );
            }

            const hasAccess = await planService.checkFeatureAccess(orgId, feature);

            if (!hasAccess) {
                return NextResponse.json(
                    {
                        error: 'Feature not available in your plan',
                        code: 'FEATURE_NOT_IN_PLAN',
                        feature,
                        upgradeUrl: '/dashboard/billing/plans'
                    },
                    { status: 403 }
                );
            }

            // Feature is available, continue
            return null;
        } catch (error) {
            console.error('Feature guard error:', error);
            return NextResponse.json(
                { error: 'Internal server error', code: 'INTERNAL_ERROR' },
                { status: 500 }
            );
        }
    };
}

/**
 * Helper to check feature access in API routes
 */
export async function checkFeature(
    orgId: string,
    feature: keyof PlanLimits
): Promise<{ allowed: boolean; error?: NextResponse }> {
    try {
        const hasAccess = await planService.checkFeatureAccess(orgId, feature);

        if (!hasAccess) {
            return {
                allowed: false,
                error: NextResponse.json(
                    {
                        error: 'Feature not available in your plan',
                        code: 'FEATURE_NOT_IN_PLAN',
                        feature,
                        upgradeUrl: '/dashboard/billing/plans'
                    },
                    { status: 403 }
                )
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Feature check error:', error);
        return {
            allowed: false,
            error: NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            )
        };
    }
}

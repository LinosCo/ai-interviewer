import { NextResponse } from 'next/server';
import { UserRole, User } from '@prisma/client';

/**
 * API Key Restriction Middleware
 * IMPORTANT: Only ADMIN users can configure custom API keys
 * 
 * This enforces:
 * 1. Security - prevent key leaks
 * 2. Cost control - use system keys
 * 3. Compliance - centralized audit trail
 */

export async function restrictApiKeyAccess(
    userRole: UserRole,
    requestBody: { customApiKeys?: unknown }
): Promise<{ allowed: boolean; error?: NextResponse }> {
    // If the request is trying to set/modify API keys
    if (requestBody.customApiKeys !== undefined) {
        if (userRole !== UserRole.ADMIN) {
            return {
                allowed: false,
                error: NextResponse.json(
                    {
                        error: 'Only administrators can configure custom API keys',
                        code: 'ADMIN_ONLY_FEATURE',
                        requiredRole: 'ADMIN',
                        currentRole: userRole
                    },
                    { status: 403 }
                )
            };
        }
    }

    return { allowed: true };
}

/**
 * Check if user should see API key settings in UI
 */
export function shouldShowApiKeySettings(userRole: UserRole): boolean {
    return userRole === UserRole.ADMIN;
}

/**
 * Sanitize user data for non-admin users
 * Removes customApiKeys field from response
 */
export function sanitizeUserData(user: Partial<User>, requestingUserRole: UserRole): Partial<User> {
    if (requestingUserRole !== UserRole.ADMIN) {
        const { customApiKeys: _, ...sanitized } = user;
        return sanitized;
    }
    return user;
}

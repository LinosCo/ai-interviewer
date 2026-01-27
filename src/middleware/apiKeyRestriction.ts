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
 * Convert BigInt values to numbers for JSON serialization
 */
function serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'bigint') {
        return Number(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(serializeBigInt);
    }

    if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
            result[key] = serializeBigInt(obj[key]);
        }
        return result;
    }

    return obj;
}

/**
 * Sanitize user data for non-admin users
 * Removes customApiKeys field from response and converts BigInt to number
 */
export function sanitizeUserData(user: any, requestingUserRole: UserRole): any {
    let sanitized = user;

    // Remove API keys for non-admin users
    if (requestingUserRole !== UserRole.ADMIN) {
        const { customApiKeys: _, ...rest } = user;
        sanitized = rest;
    }

    // Convert BigInt values to numbers for JSON serialization
    return serializeBigInt(sanitized);
}

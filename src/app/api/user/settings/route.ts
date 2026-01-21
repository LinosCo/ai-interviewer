import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma as db } from '@/lib/prisma';
import { restrictApiKeyAccess, sanitizeUserData } from '@/middleware/apiKeyRestriction';

/**
 * GET /api/user/settings
 * Returns user settings, with API keys only for ADMIN users
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                subscription: true,
                                projects: {
                                    include: {
                                        bots: {
                                            where: { status: 'PUBLISHED' },
                                            select: { id: true }
                                        }
                                    }
                                },
                                visibilityConfigs: {
                                    include: {
                                        scans: {
                                            where: {
                                                startedAt: {
                                                    gte: new Date(new Date().setDate(new Date().getDate() - 7))
                                                }
                                            }
                                        },
                                        competitors: { where: { enabled: true } },
                                        prompts: { where: { enabled: true } }
                                    }
                                },
                                tokenUsage: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Sanitize user data based on role
        const sanitized = sanitizeUserData(user, user.role);

        return NextResponse.json(sanitized);
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user/settings
 * Updates user settings, with API key restrictions
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = await db.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const body = await req.json();

        // Check API key restriction
        const restriction = await restrictApiKeyAccess(user.role, body);
        if (!restriction.allowed && restriction.error) {
            return restriction.error;
        }

        // Update user
        const updated = await db.user.update({
            where: { id: user.id },
            data: {
                name: body.name,
                ...(user.role === 'ADMIN' && body.customApiKeys && {
                    customApiKeys: body.customApiKeys
                })
            }
        });

        // Sanitize response
        const sanitized = sanitizeUserData(updated, user.role);

        return NextResponse.json(sanitized);
    } catch (error) {
        console.error('Settings PATCH error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

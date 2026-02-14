import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/me
 * Lightweight user profile endpoint used by dashboard clients.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                plan: true,
                memberships: {
                    select: {
                        role: true,
                        organizationId: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                plan: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const cookieOrgId = req.cookies.get('bt_selected_org_id')?.value;
        const activeMembership = cookieOrgId
            ? user.memberships.find((m) => m.organizationId === cookieOrgId) || user.memberships[0]
            : user.memberships[0];

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            // Keep `plan` aligned with active organization for dashboard gating.
            plan: activeMembership?.organization?.plan || user.plan || 'FREE',
            userPlan: user.plan,
            organization: activeMembership
                ? {
                    id: activeMembership.organization.id,
                    name: activeMembership.organization.name,
                    slug: activeMembership.organization.slug,
                    plan: activeMembership.organization.plan,
                    role: activeMembership.role
                }
                : null
        });
    } catch (error) {
        console.error('Error in /api/user/me:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user profile' },
            { status: 500 }
        );
    }
}

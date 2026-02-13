import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

// GET all bots across all projects (admin only)
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { searchParams } = new URL(req.url);
        const botType = searchParams.get('type'); // 'chatbot' or 'interview'
        const selectedOrganizationId = searchParams.get('organizationId');

        // Get user with organization membership
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                memberships: {
                    select: { role: true, organizationId: true, status: true }
                }
            }
        });

        if (!user) return new Response('User not found', { status: 404 });

        const orgId = await resolveActiveOrganizationIdForUser(session.user.id, {
            preferredOrganizationId: selectedOrganizationId
        });
        if (!orgId) return new Response('Organization not found', { status: 404 });

        const orgMembership = user.memberships.find((m) => m.organizationId === orgId);
        if (!orgMembership) {
            return new Response('Organization not found or access denied', { status: 403 });
        }
        if (orgMembership.status !== 'ACTIVE') {
            return new Response('Organization membership is not active', { status: 403 });
        }
        const canViewAllOrgProjects = ['OWNER', 'ADMIN'].includes(orgMembership.role);
        const accessibleProjects = await prisma.project.findMany({
            where: {
                organizationId: orgId,
                ...(canViewAllOrgProjects ? {} : {
                    OR: [
                        { ownerId: session.user.id },
                        { accessList: { some: { userId: session.user.id } } }
                    ]
                })
            },
            select: { id: true }
        });
        const accessibleProjectIds = accessibleProjects.map((p) => p.id);

        if (accessibleProjectIds.length === 0) {
            return NextResponse.json([]);
        }

        const bots = await prisma.bot.findMany({
            where: {
                projectId: { in: accessibleProjectIds },
                ...(botType && { botType })
            },
            include: {
                conversations: {
                    select: {
                        id: true,
                        status: true,
                        completedAt: true,
                        candidateProfile: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json(bots);

    } catch (error) {
        console.error('Get All Bots Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

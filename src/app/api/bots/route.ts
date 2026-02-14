import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';
import { WorkspaceError, assertOrganizationAccess } from '@/lib/domain/workspace';

// GET all bots across all projects (admin only)
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { searchParams } = new URL(req.url);
        const botType = searchParams.get('type'); // 'chatbot' or 'interview'
        const selectedOrganizationId = searchParams.get('organizationId');

        const orgId = await resolveActiveOrganizationIdForUser(session.user.id, {
            preferredOrganizationId: selectedOrganizationId
        });
        if (!orgId) return new Response('Organization not found', { status: 404 });

        try {
            await assertOrganizationAccess(session.user.id, orgId, 'VIEWER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return new Response(error.message, { status: error.status });
            }
            return new Response('Organization access denied', { status: 403 });
        }

        const accessibleProjects = await prisma.project.findMany({
            where: {
                organizationId: orgId
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

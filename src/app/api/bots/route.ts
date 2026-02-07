import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
                    select: { role: true, organizationId: true }
                }
            }
        });

        if (!user) return new Response('User not found', { status: 404 });

        // Check if user is ADMIN or OWNER in organization
        const isOrgAdmin = user.memberships.some(m => ['OWNER', 'ADMIN'].includes(m.role));

        if (!isOrgAdmin) {
            return new Response('Access denied - Admin only', { status: 403 });
        }

        // Get selected organization ID (fallback to first membership)
        const orgId = selectedOrganizationId || user.memberships[0]?.organizationId;
        if (!orgId) return new Response('Organization not found', { status: 404 });

        const hasOrgMembership = user.memberships.some((m) => m.organizationId === orgId);
        if (!hasOrgMembership) {
            return new Response('Organization not found or access denied', { status: 403 });
        }

        // Fetch all bots from all projects in the organization
        const bots = await prisma.bot.findMany({
            where: {
                project: {
                    organizationId: orgId
                },
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

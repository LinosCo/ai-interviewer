import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organizationId');

        if (!organizationId) {
            return Response.json({ projects: [], isOrgAdmin: false });
        }

        // Verify membership and fetch projects for that organization
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId
                }
            }
        });

        if (!membership) {
            return new Response('Organization not found or access denied', { status: 403 });
        }

        const projects = await prisma.project.findMany({
            where: { organizationId },
            select: {
                id: true,
                name: true,
                isPersonal: true,
                createdAt: true
            }
        });

        const isOrgAdmin = ['OWNER', 'ADMIN'].includes(membership.role);

        return Response.json({ projects, isOrgAdmin });

    } catch (error) {
        console.error('Fetch Projects Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

const createProjectSchema = z.object({
    name: z.string().min(1, 'Nome progetto richiesto')
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { name } = createProjectSchema.parse(body);

        // Get user with organization membership
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                memberships: {
                    include: { organization: true }
                }
            }
        });

        if (!user) return new Response('User not found', { status: 404 });

        // Check if user is ADMIN or OWNER (can create projects)
        const membership = user.memberships[0];
        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            return new Response('Solo Admin e Owner possono creare progetti', { status: 403 });
        }

        // Create project with owner access
        const project = await prisma.project.create({
            data: {
                name,
                ownerId: user.id,
                organizationId: membership.organizationId,
                isPersonal: false,
                accessList: {
                    create: {
                        userId: user.id,
                        role: 'OWNER'
                    }
                }
            }
        });

        return NextResponse.json(project);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return new Response(error.issues[0].message, { status: 400 });
        }
        console.error('Create Project Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

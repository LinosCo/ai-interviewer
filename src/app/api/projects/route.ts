import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                projectAccess: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                isPersonal: true,
                                createdAt: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) return new Response('User not found', { status: 404 });

        // Map projects with role information
        const projects = user.projectAccess.map(pa => ({
            ...pa.project,
            role: pa.role
        }));

        // Sort: personal project first, then by name
        projects.sort((a, b) => {
            if (a.isPersonal && !b.isPersonal) return -1;
            if (!a.isPersonal && b.isPersonal) return 1;
            return a.name.localeCompare(b.name);
        });

        return Response.json(projects);

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

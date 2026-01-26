import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Helper to check if user is OWNER of project
async function isProjectOwner(userId: string, projectId: string): Promise<boolean> {
    // Check via ProjectAccess role
    const access = await prisma.projectAccess.findUnique({
        where: {
            userId_projectId: { userId, projectId }
        }
    });
    if (access?.role === 'OWNER') return true;

    // Also check via project.ownerId (the actual owner)
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true }
    });
    return project?.ownerId === userId;
}

const updateProjectSchema = z.object({
    name: z.string().min(1).optional()
});

export async function GET(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { projectId } = await params;

        // Check user has access
        const access = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        });

        if (!access) {
            return new Response('Access denied', { status: 403 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                bots: { select: { id: true, name: true, botType: true } },
                _count: {
                    select: { accessList: true, bots: true }
                }
            }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        return NextResponse.json({
            ...project,
            currentUserRole: access.role
        });

    } catch (error) {
        console.error('Get Project Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { projectId } = await params;
        const body = await req.json();
        const data = updateProjectSchema.parse(body);

        // Verify user is OWNER
        if (!(await isProjectOwner(session.user.id, projectId))) {
            return new Response('Solo il proprietario può modificare il progetto', { status: 403 });
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data
        });

        return NextResponse.json(project);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return new Response(error.issues[0].message, { status: 400 });
        }
        console.error('Update Project Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { projectId } = await params;

        // Get project with its bots and visibility configs
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                bots: { select: { id: true } },
                visibilityConfigs: { select: { id: true } }
            }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Cannot delete personal project
        if (project.isPersonal) {
            return new Response('Non puoi eliminare il tuo progetto personale', { status: 403 });
        }

        // Verify user is OWNER
        if (!(await isProjectOwner(session.user.id, projectId))) {
            return new Response('Solo il proprietario può eliminare il progetto', { status: 403 });
        }

        // Find the owner's personal project to transfer tools
        const personalProject = await prisma.project.findFirst({
            where: {
                ownerId: session.user.id,
                isPersonal: true
            }
        });

        if (!personalProject) {
            return new Response('Progetto personale non trovato', { status: 500 });
        }

        // Transfer all bots and visibility configs to personal project, then delete
        await prisma.$transaction([
            // Transfer bots to personal project
            prisma.bot.updateMany({
                where: { projectId },
                data: { projectId: personalProject.id }
            }),
            // Unlink visibility configs (they become available for linking to other projects)
            prisma.visibilityConfig.updateMany({
                where: { projectId },
                data: { projectId: null }
            }),
            // Delete project access entries
            prisma.projectAccess.deleteMany({
                where: { projectId }
            }),
            // Delete the project
            prisma.project.delete({
                where: { id: projectId }
            })
        ]);

        return NextResponse.json({
            success: true,
            message: 'Progetto eliminato. I tool sono stati spostati nel tuo progetto personale.'
        });

    } catch (error) {
        console.error('Delete Project Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

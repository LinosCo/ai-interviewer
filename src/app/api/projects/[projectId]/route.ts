import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Helper to check if user is OWNER of project or organization
async function canManageProject(userId: string, projectId: string): Promise<boolean> {
    // 1. Check direct project access
    const access = await prisma.projectAccess.findUnique({
        where: { userId_projectId: { userId, projectId } }
    });
    if (access?.role === 'OWNER') return true;

    // 2. Check project ownerId
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true, organizationId: true }
    });
    if (project?.ownerId === userId) return true;

    // 3. Check organization ownership
    if (project?.organizationId) {
        const orgMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: project.organizationId
                }
            }
        });
        if (orgMembership?.role === 'OWNER' || orgMembership?.role === 'ADMIN') return true;
    }

    return false;
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

        // Verify user is OWNER or Org Admin
        if (!(await canManageProject(session.user.id, projectId))) {
            return new Response('Solo il proprietario o un amministratore del team può modificare il progetto', { status: 403 });
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

        // Restricted: Cannot delete the last project of the user
        const otherProjectsCount = await prisma.project.count({
            where: {
                ownerId: project.ownerId || session.user.id,
                id: { not: projectId }
            }
        });

        if (otherProjectsCount === 0) {
            return new Response('Non puoi eliminare l\'unico progetto rimasto. Crea un altro progetto prima di eliminare questo.', { status: 403 });
        }

        // Verify user is OWNER or Org Admin
        if (!(await canManageProject(session.user.id, projectId))) {
            return new Response('Solo il proprietario o un amministratore del team può eliminare il progetto', { status: 403 });
        }

        // Find a project to transfer tools to (prioritize personal, then any other)
        const transferTarget = await prisma.project.findFirst({
            where: {
                ownerId: project.ownerId || session.user.id,
                id: { not: projectId }
            },
            orderBy: { isPersonal: 'desc' } // Personal first
        });

        if (!transferTarget) {
            return new Response('Nessun progetto di destinazione trovato per il trasferimento dei tool', { status: 500 });
        }

        // Transfer all bots and visibility configs to personal project, then delete
        await prisma.$transaction([
            // Transfer bots to personal project
            prisma.bot.updateMany({
                where: { projectId },
                data: { projectId: transferTarget.id }
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

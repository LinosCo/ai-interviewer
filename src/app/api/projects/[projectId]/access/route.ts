import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Helper to check if user is OWNER of project
async function isProjectOwner(userId: string, projectId: string): Promise<boolean> {
    const [access, project] = await Promise.all([
        prisma.projectAccess.findUnique({
            where: {
                userId_projectId: { userId, projectId }
            }
        }),
        prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        })
    ]);
    return access?.role === 'OWNER' || project?.ownerId === userId;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
        const currentUserId = session.user.id;

        const { projectId } = await params;

        // Get user info to check if admin
        const user = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { role: true }
        });
        const isAdmin = user?.role === 'ADMIN';

        // Get project with access list
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                accessList: {
                    include: {
                        user: { select: { id: true, email: true, name: true } }
                    }
                }
            }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Check if user is project owner (via ownerId)
        const isProjectOwnerById = project.ownerId === currentUserId;

        // Check if user has access via ProjectAccess
        const userAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: currentUserId,
                    projectId
                }
            }
        });

        // Allow access if: has ProjectAccess, is admin, or is project owner
        if (!userAccess && !isAdmin && !isProjectOwnerById) {
            return new Response('Access denied', { status: 403 });
        }

        // Return access list with roles
        const members = project.accessList.map(pa => ({
            id: pa.id,
            userId: pa.userId,
            email: pa.user.email,
            name: pa.user.name,
            role: pa.role,
            createdAt: pa.createdAt
        }));

        // Backward-compatibility: ensure owner appears even when ProjectAccess row is missing
        if (project.ownerId && !members.some((m) => m.userId === project.ownerId)) {
            const ownerUser = await prisma.user.findUnique({
                where: { id: project.ownerId },
                select: { id: true, email: true, name: true }
            });

            if (ownerUser) {
                members.unshift({
                    id: `virtual-owner-${ownerUser.id}`,
                    userId: ownerUser.id,
                    email: ownerUser.email,
                    name: ownerUser.name,
                    role: 'OWNER',
                    createdAt: project.createdAt
                });
            }
        }

        // Determine current user's effective role
        // Priority: Owner via ownerId > ProjectAccess OWNER role > Admin > ProjectAccess MEMBER
        let currentUserRole: 'OWNER' | 'MEMBER' | 'ADMIN' = 'MEMBER';
        if (isProjectOwnerById) {
            // Project owner via ownerId always gets OWNER role
            currentUserRole = 'OWNER';
        } else if (userAccess?.role === 'OWNER') {
            // Explicit OWNER role in ProjectAccess
            currentUserRole = 'OWNER';
        } else if (isAdmin) {
            // Admin users can manage
            currentUserRole = 'ADMIN';
        } else if (userAccess) {
            // Regular member
            currentUserRole = userAccess.role;
        }

        return NextResponse.json({
            members,
            isPersonal: project.isPersonal,
            currentUserRole
        });

    } catch (error) {
        console.error('Get Project Access Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
        const currentUserId = session.user.id;

        const { projectId } = await params;
        const { email } = await req.json();

        if (!email) return new Response('Email is required', { status: 400 });

        // Check project exists and get info
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Cannot invite to personal projects
        if (project.isPersonal) {
            return new Response('Non puoi invitare membri al progetto personale', { status: 403 });
        }

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { role: true }
        });
        const isAdmin = user?.role === 'ADMIN';

        // Verify user is OWNER or ADMIN
        const ownerCheck = await isProjectOwner(currentUserId, projectId);
        const isProjectOwnerById = project.ownerId === currentUserId;

        if (!ownerCheck && !isProjectOwnerById && !isAdmin) {
            return new Response('Solo il proprietario può invitare membri', { status: 403 });
        }

        // Find user to invite
        const userToInvite = await prisma.user.findUnique({
            where: { email }
        });

        if (!userToInvite) {
            return NextResponse.json({ error: 'Utente non trovato su Business Tuner.' }, { status: 404 });
        }

        // Create access with MEMBER role
        const access = await prisma.projectAccess.upsert({
            where: {
                userId_projectId: {
                    userId: userToInvite.id,
                    projectId: projectId
                }
            },
            update: {},
            create: {
                userId: userToInvite.id,
                projectId: projectId,
                role: 'MEMBER'
            },
            include: {
                user: { select: { id: true, email: true, name: true } }
            }
        });

        return NextResponse.json({
            id: access.id,
            userId: access.userId,
            email: access.user.email,
            name: access.user.name,
            role: access.role,
            createdAt: access.createdAt
        });

    } catch (error) {
        console.error('Invite to Project Error:', error);
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
        const currentUserId = session.user.id;

        const { projectId } = await params;
        const { action, targetUserId } = await req.json();

        if (action !== 'transfer_ownership' || !targetUserId) {
            return new Response('Invalid request', { status: 400 });
        }

        // Verify caller is OWNER (or system admin)
        const actor = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { role: true }
        });
        const isAdmin = actor?.role === 'ADMIN';

        if (!isAdmin && !(await isProjectOwner(currentUserId, projectId))) {
            return new Response('Solo il proprietario può trasferire la proprietà', { status: 403 });
        }

        // Get project info
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Cannot transfer personal projects
        if (project.isPersonal) {
            return new Response('Non puoi trasferire un progetto personale', { status: 403 });
        }

        // Verify target user has access to this project
        const targetAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: { userId: targetUserId, projectId }
            }
        });

        if (!targetAccess) {
            return new Response('L\'utente selezionato non è membro del progetto', { status: 404 });
        }

        // Perform ownership transfer in a transaction
        await prisma.$transaction(async (tx) => {
            // Demote current owner to member (upsert to handle legacy missing rows)
            await tx.projectAccess.upsert({
                where: {
                    userId_projectId: { userId: currentUserId, projectId }
                },
                update: { role: 'MEMBER' },
                create: {
                    userId: currentUserId,
                    projectId,
                    role: 'MEMBER'
                }
            });

            // Promote target user to owner
            await tx.projectAccess.update({
                where: {
                    userId_projectId: { userId: targetUserId, projectId }
                },
                data: { role: 'OWNER' }
            });

            // Update project owner reference
            await tx.project.update({
                where: { id: projectId },
                data: { ownerId: targetUserId }
            });
        });

        return NextResponse.json({ success: true, message: 'Proprietà trasferita con successo' });

    } catch (error) {
        console.error('Transfer Ownership Error:', error);
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
        const currentUserId = session.user.id;

        const { projectId } = await params;
        const { searchParams } = new URL(req.url);
        let userId = searchParams.get('userId');

        if (!userId) return new Response('UserId is required', { status: 400 });

        // Handle "self" as current user
        if (userId === 'self') {
            userId = currentUserId;
        }

        // Get project info
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Get target user's access
        const targetAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: { userId, projectId }
            }
        });

        if (!targetAccess) {
            return new Response('User not in this project', { status: 404 });
        }

        // Cannot remove OWNER
        if (targetAccess.role === 'OWNER') {
            return new Response('Non puoi rimuovere il proprietario del progetto', { status: 403 });
        }

        // Check if current user is OWNER or is removing themselves (leave)
        const actor = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { role: true }
        });
        const isAdmin = actor?.role === 'ADMIN';
        const isOwner = await isProjectOwner(currentUserId, projectId);
        const isSelf = userId === currentUserId;

        if (!isOwner && !isSelf && !isAdmin) {
            return new Response('Solo il proprietario può rimuovere membri', { status: 403 });
        }

        // If user is leaving their personal project, deny
        if (isSelf && project.isPersonal) {
            return new Response('Non puoi abbandonare il tuo progetto personale', { status: 403 });
        }

        await prisma.projectAccess.delete({
            where: {
                userId_projectId: { userId, projectId }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Remove from Project Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

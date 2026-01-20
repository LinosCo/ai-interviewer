import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { projectId } = await params;

        // Verify if user is owner or has access
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                accessList: {
                    include: { user: { select: { id: true, email: true, name: true } } }
                }
            }
        });

        if (!project || (project.ownerId !== session.user.id)) {
            return new Response('Unauthorized or Project not found', { status: 403 });
        }

        return NextResponse.json(project.accessList);

    } catch (error) {
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

        const { projectId } = await params;
        const { email } = await req.json();

        if (!email) return new Response('Email is required', { status: 400 });

        // Verify ownership
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project || project.ownerId !== session.user.id) {
            return new Response('Only owners can share projects', { status: 403 });
        }

        // Find user to share with
        const userToShare = await prisma.user.findUnique({
            where: { email }
        });

        if (!userToShare) {
            return NextResponse.json({ error: 'Utente non trovato su Business Tuner.' }, { status: 404 });
        }

        // Create access
        const access = await prisma.projectAccess.upsert({
            where: {
                userId_projectId: {
                    userId: userToShare.id,
                    projectId: projectId
                }
            },
            update: {},
            create: {
                userId: userToShare.id,
                projectId: projectId
            }
        });

        return NextResponse.json(access);

    } catch (error) {
        console.error('Share Project Error:', error);
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
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) return new Response('UserId is required', { status: 400 });

        // Verify ownership
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project || project.ownerId !== session.user.id) {
            return new Response('Only owners can manage access', { status: 403 });
        }

        await prisma.projectAccess.delete({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        return new Response('Internal Server Error', { status: 500 });
    }
}

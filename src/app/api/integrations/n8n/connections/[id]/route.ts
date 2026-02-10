import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.n8NConnection.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!connection) {
      return new Response('Connection not found', { status: 404 });
    }

    // Check access
    const access = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: connection.projectId,
        },
      },
    });

    if (!access) {
      return new Response('Access denied', { status: 403 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    console.error('Get N8N Connection Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.n8NConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return new Response('Connection not found', { status: 404 });
    }

    // Check access
    const access = await prisma.projectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: connection.projectId,
        },
      },
    });

    if (!access) {
      return new Response('Access denied', { status: 403 });
    }

    await prisma.n8NConnection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete N8N Connection Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

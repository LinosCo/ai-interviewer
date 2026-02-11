import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

function isMissingN8NConnectionTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: string; meta?: { table?: string }; message?: string };
  if (prismaError.code !== 'P2021') return false;
  const tableRef = String(prismaError.meta?.table || '').toLowerCase();
  const messageRef = String(prismaError.message || '').toLowerCase();
  return tableRef.includes('n8nconnection') || messageRef.includes('n8nconnection');
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.n8NConnection.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    if (isMissingN8NConnectionTable(error)) {
      return NextResponse.json(
        { error: 'N8N integration unavailable: missing N8NConnection table. Run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Get N8N Connection Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.n8NConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.n8NConnection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isMissingN8NConnectionTable(error)) {
      return NextResponse.json(
        { error: 'N8N integration unavailable: missing N8NConnection table. Run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Delete N8N Connection Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

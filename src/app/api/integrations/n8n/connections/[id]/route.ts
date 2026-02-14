import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function isMissingN8NConnectionTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaError = error as { code?: string; meta?: { table?: string }; message?: string };
  if (prismaError.code !== 'P2021') return false;
  const tableRef = String(prismaError.meta?.table || '').toLowerCase();
  const messageRef = String(prismaError.message || '').toLowerCase();
  return tableRef.includes('n8nconnection') || messageRef.includes('n8nconnection');
}

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (isMissingN8NConnectionTable(error)) {
    return NextResponse.json(
      { error: 'N8N integration unavailable: missing N8NConnection table. Run database migrations.' },
      { status: 503 }
    );
  }
  console.error('N8N connection by id route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

async function loadConnection(userId: string, id: string, minimumRole: 'MEMBER' | 'ADMIN') {
  const connection = await prisma.n8NConnection.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } } }
  });

  if (!connection) {
    throw new WorkspaceError('Connection not found', 404, 'N8N_NOT_FOUND');
  }

  await assertProjectAccess(userId, connection.projectId, minimumRole);
  return connection;
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
    const connection = await loadConnection(session.user.id, id, 'MEMBER');
    return NextResponse.json({ connection });
  } catch (error) {
    return toErrorResponse(error);
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
    await loadConnection(session.user.id, id, 'ADMIN');
    await prisma.n8NConnection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

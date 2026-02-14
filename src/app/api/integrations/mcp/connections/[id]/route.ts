/**
 * MCP Connection by ID API
 * GET - Get connection details
 * PUT - Update connection
 * DELETE - Delete connection
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { normalizeMcpEndpoint } from '@/lib/integrations/mcp/endpoint';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('MCP connection route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

async function loadConnectionWithAccessCheck(userId: string, id: string, minimumRole: 'MEMBER' | 'ADMIN') {
  const connection = await prisma.mCPConnection.findUnique({
    where: { id },
    include: {
      project: {
        select: { id: true }
      }
    }
  });

  if (!connection || !connection.project) {
    throw new WorkspaceError('Connection not found', 404, 'MCP_NOT_FOUND');
  }

  await assertProjectAccess(userId, connection.project.id, minimumRole);
  return connection;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const connection = await loadConnectionWithAccessCheck(session.user.id, id, 'MEMBER');

    return NextResponse.json({
      id: connection.id,
      type: connection.type,
      name: connection.name,
      endpoint: connection.endpoint,
      status: connection.status,
      lastPingAt: connection.lastPingAt,
      lastSyncAt: connection.lastSyncAt,
      lastError: connection.lastError,
      availableTools: connection.availableTools,
      serverVersion: connection.serverVersion,
      serverName: connection.serverName,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, endpoint, credentials } = body;

    const connection = await loadConnectionWithAccessCheck(session.user.id, id, 'ADMIN');

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (endpoint) {
      updateData.endpoint = normalizeMcpEndpoint(connection.type, endpoint);
      updateData.status = 'PENDING';
    }
    if (credentials) {
      updateData.credentials = encrypt(JSON.stringify(credentials));
      updateData.status = 'PENDING';
    }

    const updated = await prisma.mCPConnection.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        type: true,
        name: true,
        endpoint: true,
        status: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ success: true, connection: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await loadConnectionWithAccessCheck(session.user.id, id, 'ADMIN');
    await prisma.mCPConnection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

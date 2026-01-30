/**
 * MCP Connection by ID API
 * GET - Get connection details
 * PUT - Update connection
 * DELETE - Delete connection
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { NextResponse } from 'next/server';

// GET - Get connection details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userEmail = session.user.email;

  const { id } = await params;

  const connection = await prisma.mCPConnection.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          owner: { select: { email: true } },
          organization: {
            include: {
              members: { select: { user: { select: { email: true } } } },
            },
          },
          accessList: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  if (!connection || !connection.project) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // Verify access
  const hasAccess =
    connection.project.owner?.email === userEmail ||
    connection.project.accessList.some(a => a.user.email === userEmail) ||
    connection.project.organization?.members.some(m => m.user.email === userEmail);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

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
    updatedAt: connection.updatedAt,
  });
}

// PUT - Update connection
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userEmail = session.user.email;

  const { id } = await params;
  const body = await request.json();
  const { name, endpoint, credentials } = body;

  const connection = await prisma.mCPConnection.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          owner: { select: { email: true } },
          organization: {
            include: {
              members: { select: { user: { select: { email: true } } } },
            },
          },
          accessList: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  if (!connection || !connection.project) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // Verify access
  const hasAccess =
    connection.project.owner?.email === userEmail ||
    connection.project.accessList.some(a => a.user.email === userEmail) ||
    connection.project.organization?.members.some(m => m.user.email === userEmail);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (endpoint) updateData.endpoint = endpoint;
  if (credentials) {
    updateData.credentials = encrypt(JSON.stringify(credentials));
    updateData.status = 'PENDING'; // Reset status when credentials change
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
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, connection: updated });
}

// DELETE - Delete connection
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userEmail = session.user.email;

  const { id } = await params;

  const connection = await prisma.mCPConnection.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          owner: { select: { email: true } },
          organization: {
            include: {
              members: { select: { user: { select: { email: true } } } },
            },
          },
          accessList: { select: { user: { select: { email: true } } } },
        },
      },
    },
  });

  if (!connection || !connection.project) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  // Verify access
  const hasAccess =
    connection.project.owner?.email === userEmail ||
    connection.project.accessList.some(a => a.user.email === userEmail) ||
    connection.project.organization?.members.some(m => m.user.email === userEmail);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  await prisma.mCPConnection.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

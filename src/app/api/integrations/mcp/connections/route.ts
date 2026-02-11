/**
 * MCP Connections API
 * GET - List connections for a project
 * POST - Create new connection
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { normalizeMcpEndpoint } from '@/lib/integrations/mcp/endpoint';
import { NextResponse } from 'next/server';

// GET - List MCP connections for a project
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  // Verify user has access to project
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { owner: { email: session.user.email } },
        { accessList: { some: { user: { email: session.user.email } } } },
        {
          organization: {
            members: { some: { user: { email: session.user.email } } },
          },
        },
      ],
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
  }

  const connections = await prisma.mCPConnection.findMany({
    where: { projectId },
    select: {
      id: true,
      type: true,
      name: true,
      endpoint: true,
      status: true,
      lastPingAt: true,
      lastSyncAt: true,
      lastError: true,
      availableTools: true,
      serverVersion: true,
      serverName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ connections });
}

// POST - Create new MCP connection
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, type, name, endpoint, credentials } = body;

  // Validate required fields
  if (!projectId || !type || !name || !endpoint || !credentials) {
    return NextResponse.json(
      { error: 'Missing required fields: projectId, type, name, endpoint, credentials' },
      { status: 400 }
    );
  }

  // Validate type
  if (!['WORDPRESS', 'WOOCOMMERCE'].includes(type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be WORDPRESS or WOOCOMMERCE' },
      { status: 400 }
    );
  }

  // Verify user has access to project
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { owner: { email: session.user.email } },
        { accessList: { some: { user: { email: session.user.email } } } },
        {
          organization: {
            members: { some: { user: { email: session.user.email } } },
          },
        },
      ],
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
  }

  // Check if connection of this type already exists
  const existingConnection = await prisma.mCPConnection.findFirst({
    where: { projectId, type },
  });

  if (existingConnection) {
    return NextResponse.json(
      { error: `A ${type} connection already exists for this project` },
      { status: 409 }
    );
  }

  // Encrypt credentials
  const encryptedCredentials = encrypt(JSON.stringify(credentials));

  const normalizedEndpoint = normalizeMcpEndpoint(type, endpoint);

  // Create connection
  const connection = await prisma.mCPConnection.create({
    data: {
      projectId,
      type,
      name,
      endpoint: normalizedEndpoint,
      credentials: encryptedCredentials,
      status: 'PENDING',
      createdBy: session.user.email,
      availableTools: [],
    },
    select: {
      id: true,
      type: true,
      name: true,
      endpoint: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    connection,
  });
}

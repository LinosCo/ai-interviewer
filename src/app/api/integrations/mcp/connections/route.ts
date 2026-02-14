/**
 * MCP Connections API
 * GET - List connections for a project
 * POST - Create new connection
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { normalizeMcpEndpoint } from '@/lib/integrations/mcp/endpoint';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';
import { NextResponse } from 'next/server';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

// GET - List MCP connections for a project
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  try {
    await assertProjectAccess(session.user.id, projectId, 'MEMBER');
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

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
  if (!session?.user?.id) {
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true }
  });

  try {
    await assertProjectAccess(session.user.id, projectId, 'ADMIN');
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
  }

  if (project.organizationId) {
    const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
    if (!integrationCheck.allowed) {
      return NextResponse.json(
        { error: integrationCheck.reason || 'Integration creation unavailable on trial' },
        { status: 403 }
      );
    }
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
      createdBy: session.user.id,
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

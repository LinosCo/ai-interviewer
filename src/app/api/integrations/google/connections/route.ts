/**
 * Google Connections API
 * GET - Get connection for a project
 * POST - Create new connection with Service Account
 */

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';
import { NextResponse } from 'next/server';

// GET - Get Google connection for a project
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

  const connection = await prisma.googleConnection.findUnique({
    where: { projectId },
    select: {
      id: true,
      serviceAccountEmail: true,
      ga4Enabled: true,
      ga4PropertyId: true,
      ga4Status: true,
      ga4LastSyncAt: true,
      ga4LastError: true,
      gscEnabled: true,
      gscSiteUrl: true,
      gscStatus: true,
      gscLastSyncAt: true,
      gscLastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ connection });
}

// POST - Create new Google connection
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, serviceAccountJson, ga4PropertyId, gscSiteUrl } = body;

  // Validate required fields
  if (!projectId || !serviceAccountJson) {
    return NextResponse.json(
      { error: 'Missing required fields: projectId, serviceAccountJson' },
      { status: 400 }
    );
  }

  // Parse and validate Service Account JSON
  let serviceAccount: { client_email?: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
    if (!serviceAccount.client_email) {
      return NextResponse.json(
        { error: 'Invalid Service Account JSON: missing client_email' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid Service Account JSON format' },
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

  if (project.organizationId) {
    const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
    if (!integrationCheck.allowed) {
      return NextResponse.json(
        { error: integrationCheck.reason || 'Integration creation unavailable on trial' },
        { status: 403 }
      );
    }
  }

  // Check if connection already exists
  const existingConnection = await prisma.googleConnection.findUnique({
    where: { projectId },
  });

  if (existingConnection) {
    return NextResponse.json(
      { error: 'A Google connection already exists for this project' },
      { status: 409 }
    );
  }

  // Encrypt Service Account JSON
  const encryptedJson = encrypt(serviceAccountJson);

  // Create connection
  const connection = await prisma.googleConnection.create({
    data: {
      projectId,
      serviceAccountEmail: serviceAccount.client_email,
      serviceAccountJson: encryptedJson,
      ga4Enabled: !!ga4PropertyId,
      ga4PropertyId: ga4PropertyId || null,
      ga4Status: ga4PropertyId ? 'PENDING' : 'DISABLED',
      gscEnabled: !!gscSiteUrl,
      gscSiteUrl: gscSiteUrl || null,
      gscStatus: gscSiteUrl ? 'PENDING' : 'DISABLED',
      createdBy: session.user.email,
    },
    select: {
      id: true,
      serviceAccountEmail: true,
      ga4Enabled: true,
      ga4PropertyId: true,
      ga4Status: true,
      gscEnabled: true,
      gscSiteUrl: true,
      gscStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    connection,
  });
}

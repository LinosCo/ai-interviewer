/**
 * Google Connections API
 * GET - Get connection for a project
 * POST - Create new connection with Service Account
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Google connections route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    await assertProjectAccess(session.user.id, projectId, 'MEMBER');

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
        updatedAt: true
      }
    });

    return NextResponse.json({ connection });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, serviceAccountJson, ga4PropertyId, gscSiteUrl } = body;

    if (!projectId || !serviceAccountJson) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, serviceAccountJson' },
        { status: 400 }
      );
    }

    await assertProjectAccess(session.user.id, projectId, 'ADMIN');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true }
    });

    if (!project?.organizationId) {
      throw new WorkspaceError('Project organization not found', 422, 'PROJECT_ORG_MISSING');
    }

    const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
    if (!integrationCheck.allowed) {
      return NextResponse.json(
        { error: integrationCheck.reason || 'Integration creation unavailable on trial' },
        { status: 403 }
      );
    }

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

    const existingConnection = await prisma.googleConnection.findUnique({
      where: { projectId }
    });
    if (existingConnection) {
      return NextResponse.json(
        { error: 'A Google connection already exists for this project' },
        { status: 409 }
      );
    }

    const encryptedJson = encrypt(serviceAccountJson);
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
        createdBy: session.user.id
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
        createdAt: true
      }
    });

    return NextResponse.json({ success: true, connection });
  } catch (error) {
    return toErrorResponse(error);
  }
}

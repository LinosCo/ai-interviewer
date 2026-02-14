/**
 * Google Connection by ID API
 * GET - Get connection details
 * PUT - Update connection (property ID, site URL)
 * DELETE - Delete connection
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/integrations/encryption';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Google connection route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

async function loadConnectionWithAccessCheck(userId: string, id: string, minimumRole: 'MEMBER' | 'ADMIN') {
  const connection = await prisma.googleConnection.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      serviceAccountEmail: true,
      serviceAccountJson: true,
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

  if (!connection) {
    throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');
  }

  await assertProjectAccess(userId, connection.projectId, minimumRole);
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
    return NextResponse.json(connection);
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
    const { serviceAccountJson, ga4PropertyId, gscSiteUrl } = body;

    const connection = await loadConnectionWithAccessCheck(session.user.id, id, 'ADMIN');
    const updateData: Record<string, unknown> = {};

    if (serviceAccountJson) {
      let serviceAccount: { client_email?: string };
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch {
        return NextResponse.json({ error: 'Invalid Service Account JSON format' }, { status: 400 });
      }

      if (!serviceAccount.client_email) {
        return NextResponse.json({ error: 'Invalid Service Account JSON: missing client_email' }, { status: 400 });
      }

      updateData.serviceAccountEmail = serviceAccount.client_email;
      updateData.serviceAccountJson = encrypt(serviceAccountJson);
      updateData.ga4Status = connection.ga4Enabled ? 'PENDING' : 'DISABLED';
      updateData.gscStatus = connection.gscEnabled ? 'PENDING' : 'DISABLED';
    }

    if (ga4PropertyId !== undefined) {
      if (ga4PropertyId) {
        updateData.ga4Enabled = true;
        updateData.ga4PropertyId = ga4PropertyId;
        updateData.ga4Status = 'PENDING';
      } else {
        updateData.ga4Enabled = false;
        updateData.ga4PropertyId = null;
        updateData.ga4Status = 'DISABLED';
      }
    }

    if (gscSiteUrl !== undefined) {
      if (gscSiteUrl) {
        updateData.gscEnabled = true;
        updateData.gscSiteUrl = gscSiteUrl;
        updateData.gscStatus = 'PENDING';
      } else {
        updateData.gscEnabled = false;
        updateData.gscSiteUrl = null;
        updateData.gscStatus = 'DISABLED';
      }
    }

    const updated = await prisma.googleConnection.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        serviceAccountEmail: true,
        ga4Enabled: true,
        ga4PropertyId: true,
        ga4Status: true,
        gscEnabled: true,
        gscSiteUrl: true,
        gscStatus: true,
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
    await prisma.googleConnection.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

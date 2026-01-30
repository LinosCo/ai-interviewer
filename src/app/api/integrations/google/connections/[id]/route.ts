/**
 * Google Connection by ID API
 * GET - Get connection details
 * PUT - Update connection (property ID, site URL)
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

  const connection = await prisma.googleConnection.findUnique({
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
    serviceAccountEmail: connection.serviceAccountEmail,
    ga4Enabled: connection.ga4Enabled,
    ga4PropertyId: connection.ga4PropertyId,
    ga4Status: connection.ga4Status,
    ga4LastSyncAt: connection.ga4LastSyncAt,
    ga4LastError: connection.ga4LastError,
    gscEnabled: connection.gscEnabled,
    gscSiteUrl: connection.gscSiteUrl,
    gscStatus: connection.gscStatus,
    gscLastSyncAt: connection.gscLastSyncAt,
    gscLastError: connection.gscLastError,
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
  const { serviceAccountJson, ga4PropertyId, gscSiteUrl } = body;

  const connection = await prisma.googleConnection.findUnique({
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

  // Update Service Account if provided
  if (serviceAccountJson) {
    let serviceAccount: { client_email?: string };
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      if (!serviceAccount.client_email) {
        return NextResponse.json(
          { error: 'Invalid Service Account JSON: missing client_email' },
          { status: 400 }
        );
      }
      updateData.serviceAccountEmail = serviceAccount.client_email;
      updateData.serviceAccountJson = encrypt(serviceAccountJson);
      // Reset statuses when credentials change
      updateData.ga4Status = connection.ga4Enabled ? 'PENDING' : 'DISABLED';
      updateData.gscStatus = connection.gscEnabled ? 'PENDING' : 'DISABLED';
    } catch {
      return NextResponse.json(
        { error: 'Invalid Service Account JSON format' },
        { status: 400 }
      );
    }
  }

  // Update GA4 property
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

  // Update GSC site
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

  const connection = await prisma.googleConnection.findUnique({
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

  await prisma.googleConnection.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

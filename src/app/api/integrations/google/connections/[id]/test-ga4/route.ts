/**
 * Test GA4 Connection API
 * POST - Test Google Analytics 4 connection
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GoogleService } from '@/lib/integrations/google';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('GA4 test route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.info('[GA4 Test Route]', { requestId, stage: 'request_received', connectionId: id, userId: session.user.id });
    const connection = await prisma.googleConnection.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        ga4Enabled: true,
        ga4PropertyId: true
      }
    });

    if (!connection) {
      console.warn('[GA4 Test Route]', { requestId, stage: 'connection_not_found', connectionId: id });
      throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');
    }

    await assertProjectAccess(session.user.id, connection.projectId, 'ADMIN');
    console.info('[GA4 Test Route]', {
      requestId,
      stage: 'access_granted',
      connectionId: id,
      projectId: connection.projectId,
      ga4Enabled: connection.ga4Enabled,
      ga4PropertyId: connection.ga4PropertyId || null
    });

    if (!connection.ga4Enabled || !connection.ga4PropertyId) {
      console.warn('[GA4 Test Route]', {
        requestId,
        stage: 'ga4_not_configured',
        connectionId: id,
        projectId: connection.projectId
      });
      return NextResponse.json(
        { error: 'GA4 is not configured. Please set ga4PropertyId first.' },
        { status: 400 }
      );
    }

    await prisma.googleConnection.update({
      where: { id },
      data: { ga4Status: 'TESTING' }
    });

    const result = await GoogleService.testGA4(id);
    console.info('[GA4 Test Route]', {
      requestId,
      stage: 'completed',
      connectionId: id,
      projectId: connection.projectId,
      success: result.success,
      propertyName: result.propertyName || null,
      error: result.error || null
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GA4 Test Route]', { requestId, stage: 'fatal_error', error });
    return toErrorResponse(error);
  }
}

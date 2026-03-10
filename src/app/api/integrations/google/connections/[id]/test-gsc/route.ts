/**
 * Test GSC Connection API
 * POST - Test Google Search Console connection
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
  console.error('GSC test route error:', error);
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
    console.info('[GSC Test Route]', { requestId, stage: 'request_received', connectionId: id, userId: session.user.id });
    const connection = await prisma.googleConnection.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        gscEnabled: true,
        gscSiteUrl: true
      }
    });

    if (!connection) {
      console.warn('[GSC Test Route]', { requestId, stage: 'connection_not_found', connectionId: id });
      throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');
    }

    await assertProjectAccess(session.user.id, connection.projectId, 'ADMIN');
    console.info('[GSC Test Route]', {
      requestId,
      stage: 'access_granted',
      connectionId: id,
      projectId: connection.projectId,
      gscEnabled: connection.gscEnabled,
      gscSiteUrl: connection.gscSiteUrl || null
    });

    if (!connection.gscEnabled || !connection.gscSiteUrl) {
      console.warn('[GSC Test Route]', {
        requestId,
        stage: 'gsc_not_configured',
        connectionId: id,
        projectId: connection.projectId
      });
      return NextResponse.json(
        { error: 'Search Console is not configured. Please set gscSiteUrl first.' },
        { status: 400 }
      );
    }

    await prisma.googleConnection.update({
      where: { id },
      data: { gscStatus: 'TESTING' }
    });

    const result = await GoogleService.testGSC(id);
    console.info('[GSC Test Route]', {
      requestId,
      stage: 'completed',
      connectionId: id,
      projectId: connection.projectId,
      success: result.success,
      siteUrl: result.siteUrl || null,
      error: result.error || null
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GSC Test Route]', { requestId, stage: 'fatal_error', error });
    return toErrorResponse(error);
  }
}

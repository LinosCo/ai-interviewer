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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
      throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');
    }

    await assertProjectAccess(session.user.id, connection.projectId, 'ADMIN');

    if (!connection.gscEnabled || !connection.gscSiteUrl) {
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
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

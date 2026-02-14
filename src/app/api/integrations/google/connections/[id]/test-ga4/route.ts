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
        ga4Enabled: true,
        ga4PropertyId: true
      }
    });

    if (!connection) {
      throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');
    }

    await assertProjectAccess(session.user.id, connection.projectId, 'ADMIN');

    if (!connection.ga4Enabled || !connection.ga4PropertyId) {
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
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

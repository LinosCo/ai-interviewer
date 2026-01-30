import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSSessionService } from '@/lib/cms/session.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/cms/dashboard-url
 * Genera URL autenticato per aprire la dashboard CMS.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Trova la connessione CMS per il progetto
    const connection = await prisma.cMSConnection.findUnique({
      where: { projectId }
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No CMS connection for this project' },
        { status: 404 }
      );
    }

    if (connection.status === 'DISABLED') {
      return NextResponse.json(
        { error: 'CMS connection is disabled' },
        { status: 400 }
      );
    }

    // Genera URL con token
    const dashboardUrl = await CMSSessionService.generateCMSDashboardUrl(
      session.user.id,
      projectId,
      connection.id
    );

    console.log('[CMS Dashboard URL] Generated:', {
      cmsDashboardUrl: connection.cmsDashboardUrl,
      fullUrl: dashboardUrl
    });

    return NextResponse.json({ url: dashboardUrl });

  } catch (error: any) {
    console.error('Error generating CMS dashboard URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate URL' },
      { status: 500 }
    );
  }
}

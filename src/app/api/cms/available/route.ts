import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/available
 * Restituisce le connessioni CMS disponibili per un'organizzazione.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verifica che l'utente appartenga all'organizzazione
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this organization' },
        { status: 403 }
      );
    }

    // Trova le connessioni CMS dell'organizzazione
    const connections = await prisma.cMSConnection.findMany({
      where: {
        organizationId,
        status: { not: 'DISABLED' },
      },
      select: {
        id: true,
        name: true,
        status: true,
        cmsApiUrl: true,
        cmsDashboardUrl: true,
        organizationId: true,
        projectId: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error('Error fetching available CMS connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

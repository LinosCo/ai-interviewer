import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/organizations/[orgId]/cms/regenerate-key
 * Regenerate the API key for a CMS connection.
 * Admin only.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { orgId } = await params;

        // Get connection for this organization
        const connection = await prisma.cMSConnection.findUnique({
            where: { organizationId: orgId }
        });

        if (!connection) {
            return NextResponse.json(
                { error: 'CMS connection not found for this organization' },
                { status: 404 }
            );
        }

        // Regenerate API key
        const result = await CMSConnectionService.regenerateApiKey(connection.id);

        return NextResponse.json({
            ...result,
            warning: 'La chiave precedente non è più valida. Aggiorna la configurazione del CMS entro 24 ore.'
        });

    } catch (error: any) {
        console.error('Error regenerating API key:', error);
        return NextResponse.json(
            { error: 'Failed to regenerate API key' },
            { status: 500 }
        );
    }
}

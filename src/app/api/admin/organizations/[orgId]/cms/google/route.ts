import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/admin/organizations/[orgId]/cms/google
 * Disconnect Google (removes tokens and resets GA/SC config).
 * Admin only.
 */
export async function DELETE(
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

        // Disconnect Google
        await googleAnalyticsService.disconnect(connection.id);

        // Update status if needed
        if (connection.status === 'GOOGLE_ONLY') {
            await prisma.cMSConnection.update({
                where: { id: connection.id },
                data: { status: 'PENDING' }
            });
        } else if (connection.status === 'ACTIVE') {
            await prisma.cMSConnection.update({
                where: { id: connection.id },
                data: { status: 'PARTIAL' }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error disconnecting Google:', error);
        return NextResponse.json(
            { error: 'Failed to disconnect Google' },
            { status: 500 }
        );
    }
}

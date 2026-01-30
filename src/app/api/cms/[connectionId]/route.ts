import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/[connectionId]
 * Get details for a specific CMS connection.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId } = await params;

        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true
                    }
                }
            }
        });

        if (!connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // Verify user has access to the organization
        const membership = await prisma.membership.findFirst({
            where: {
                userId: session.user.id,
                organizationId: connection.project.organizationId || ''
            }
        });

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(connection);

    } catch (error: any) {
        console.error('Error fetching CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to fetch CMS connection' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/cms/[connectionId]
 * Delete a specific CMS connection.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId } = await params;

        // Get connection to check permissions
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: { project: true }
        });

        if (!connection) {
            return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
        }

        // Verify user has permission (ADMIN or ORG OWNER/ADMIN)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        const isSystemAdmin = user?.role === 'ADMIN';

        const membership = await prisma.membership.findFirst({
            where: {
                userId: session.user.id,
                organizationId: connection.project.organizationId || '',
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!isSystemAdmin && !membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await CMSConnectionService.deleteConnection(connectionId);

        return NextResponse.json({ success: true, message: 'Connection deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to delete CMS connection' },
            { status: 500 }
        );
    }
}

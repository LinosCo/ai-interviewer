import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/projects/[projectId]/cms/disable
 * Disable the CMS connection.
 * Admin only.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
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

        const { projectId } = await params;

        // Get connection for this project
        const connection = await prisma.cMSConnection.findUnique({
            where: { projectId }
        });

        if (!connection) {
            return NextResponse.json(
                { error: 'CMS connection not found for this project' },
                { status: 404 }
            );
        }

        // Disable connection
        await CMSConnectionService.disableConnection(connection.id);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error disabling CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to disable CMS connection' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/projects/[projectId]/cms/disable
 * Delete the CMS connection entirely.
 * Admin only.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
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

        const { projectId } = await params;

        // Get connection for this project
        const connection = await prisma.cMSConnection.findUnique({
            where: { projectId }
        });

        if (!connection) {
            return NextResponse.json(
                { error: 'CMS connection not found for this project' },
                { status: 404 }
            );
        }

        // Delete connection
        await CMSConnectionService.deleteConnection(connection.id);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to delete CMS connection' },
            { status: 500 }
        );
    }
}

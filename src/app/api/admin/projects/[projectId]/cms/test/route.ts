import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/projects/[projectId]/cms/test
 * Test the CMS connection.
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

        // Test connection
        const result = await CMSConnectionService.testConnection(connection.id);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error testing CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to test CMS connection' },
            { status: 500 }
        );
    }
}

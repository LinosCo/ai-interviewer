import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/organizations/[orgId]/cms/status
 * Get full status of the CMS connection.
 * Admin only.
 */
export async function GET(
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

        const status = await CMSConnectionService.getConnectionStatus(orgId);

        if (!status) {
            return NextResponse.json(
                { error: 'CMS connection not found for this organization' },
                { status: 404 }
            );
        }

        return NextResponse.json(status);

    } catch (error: any) {
        console.error('Error getting CMS status:', error);
        return NextResponse.json(
            { error: 'Failed to get CMS status' },
            { status: 500 }
        );
    }
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/organizations/[orgId]/cms/create
 * Create a new CMS connection for an organization.
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
        const body = await request.json();

        const { name, cmsApiUrl, cmsDashboardUrl, cmsPublicUrl, notes } = body;

        if (!name || !cmsApiUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: name and cmsApiUrl' },
                { status: 400 }
            );
        }

        // Verify organization exists
        const org = await prisma.organization.findUnique({
            where: { id: orgId }
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Create connection
        const result = await CMSConnectionService.createConnection({
            organizationId: orgId,
            name,
            cmsApiUrl,
            cmsDashboardUrl,
            cmsPublicUrl,
            notes,
            enabledBy: session.user.email
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error creating CMS connection:', error);

        if (error.message === 'Organization already has a CMS connection') {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        return NextResponse.json(
            { error: 'Failed to create CMS connection' },
            { status: 500 }
        );
    }
}

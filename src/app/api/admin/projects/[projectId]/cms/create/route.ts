import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/projects/[projectId]/cms/create
 * Create a new CMS connection for a project.
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
        const body = await request.json();

        const { name, cmsApiUrl, cmsDashboardUrl, cmsPublicUrl, notes } = body;

        if (!name || !cmsApiUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: name and cmsApiUrl' },
                { status: 400 }
            );
        }

        // Verify project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Create connection
        const result = await CMSConnectionService.createConnection({
            projectId,
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

        if (error.message === 'Project already has a CMS connection') {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        return NextResponse.json(
            { error: 'Failed to create CMS connection' },
            { status: 500 }
        );
    }
}

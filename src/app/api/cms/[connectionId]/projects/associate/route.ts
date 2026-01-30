/**
 * POST /api/cms/[connectionId]/projects/associate
 * Associate a CMS connection with a project
 */

import { auth } from '@/auth';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId } = await params;
        const body = await request.json();
        const { projectId, role = 'VIEWER' } = body;

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        const result = await CMSConnectionService.associateProject(
            connectionId,
            projectId,
            session.user.id,
            role
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error associating CMS connection:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

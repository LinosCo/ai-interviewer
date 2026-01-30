/**
 * DELETE /api/cms/[connectionId]/projects/[projectId]
 * Dissociate a CMS connection from a project
 */

import { auth } from '@/auth';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ connectionId: string; projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { connectionId, projectId } = await params;

        const result = await CMSConnectionService.dissociateProject(
            connectionId,
            projectId,
            session.user.id
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error dissociating CMS connection:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

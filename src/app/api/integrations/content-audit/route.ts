/**
 * Content Audit API
 * POST - Run a content audit for a project (cross-references site structure + GSC)
 */

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';
import { ContentAuditService } from '@/lib/cms/content-audit.service';

function toErrorResponse(error: unknown) {
    if (error instanceof WorkspaceError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Content audit route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json() as { projectId?: string };
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        await assertProjectAccess(session.user.id, projectId, 'MEMBER');

        const auditResult = await ContentAuditService.runAudit(projectId);

        return NextResponse.json({
            success: true,
            audit: auditResult
        });
    } catch (error) {
        return toErrorResponse(error);
    }
}

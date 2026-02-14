import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CrossChannelSyncEngine } from '@/lib/insights/sync-engine';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';
import {
    WorkspaceError,
    assertOrganizationAccess,
    assertProjectAccess
} from '@/lib/domain/workspace';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const selectedOrganizationId = searchParams.get('organizationId');

        const orgId = await resolveActiveOrganizationIdForUser(session.user.id, {
            preferredOrganizationId: selectedOrganizationId
        });
        if (!orgId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        try {
            if (projectId) {
                const access = await assertProjectAccess(session.user.id, projectId, 'MEMBER');
                if (access.organizationId !== orgId) {
                    return NextResponse.json({ error: 'Project does not belong to selected organization' }, { status: 403 });
                }
            } else {
                await assertOrganizationAccess(session.user.id, orgId, 'MEMBER');
            }
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
            }
            throw error;
        }

        const result = await CrossChannelSyncEngine.sync(orgId, projectId || undefined);

        return NextResponse.json({
            success: true,
            count: result.insights.length,
            insights: result.insights,
            healthReport: result.healthReport
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Failed to sync insights' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const selectedOrganizationId = searchParams.get('organizationId');

        const orgId = await resolveActiveOrganizationIdForUser(session.user.id, {
            preferredOrganizationId: selectedOrganizationId
        });
        if (!orgId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        try {
            if (projectId) {
                const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');
                if (access.organizationId !== orgId) {
                    return NextResponse.json({ error: 'Project does not belong to selected organization' }, { status: 403 });
                }
            } else {
                await assertOrganizationAccess(session.user.id, orgId, 'VIEWER');
            }
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
            }
            throw error;
        }

        const insights = await prisma.crossChannelInsight.findMany({
            where: {
                organizationId: orgId,
                ...(projectId ? { projectId } : {})
            },
            orderBy: { priorityScore: 'desc' }
        });

        return NextResponse.json({ insights });

    } catch (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }
}

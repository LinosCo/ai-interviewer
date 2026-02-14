import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CrossChannelSyncEngine } from '@/lib/insights/sync-engine';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

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

        // Verify project access if projectId is provided
        if (projectId) {
            const access = await prisma.projectAccess.findUnique({
                where: {
                    userId_projectId: { userId: session.user.id, projectId }
                }
            });
            if (!access) {
                return NextResponse.json({ error: 'Project access denied' }, { status: 403 });
            }
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

        if (projectId) {
            const access = await prisma.projectAccess.findUnique({
                where: {
                    userId_projectId: { userId: session.user.id, projectId }
                }
            });
            if (!access) {
                return NextResponse.json({ error: 'Project access denied' }, { status: 403 });
            }
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

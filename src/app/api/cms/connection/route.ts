import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/connection?projectId=xxx
 * Get the CMS connection status for a specific project.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Find project and any CMS connection (direct or shared) that the user can access
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organization: {
                    members: {
                        some: {
                            userId: user.id
                        }
                    }
                }
            },
            include: {
                cmsConnection: true,
                newCmsConnection: true,
                cmsShares: {
                    include: {
                        connection: true
                    }
                }
            }
        });

        if (!project) {
            return NextResponse.json({
                enabled: false,
                message: 'Project not found or access denied'
            });
        }

        const sharedConnection = project.cmsShares.find(s => s.connection.status !== 'DISABLED')?.connection || null;
        const cmsConnection = project.newCmsConnection || project.cmsConnection || sharedConnection;

        if (!cmsConnection) {
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this project'
            });
        }

        return NextResponse.json({
            enabled: true,
            projectId: project.id,
            connection: {
                id: cmsConnection.id,
                name: cmsConnection.name,
                status: cmsConnection.status,
                lastSyncAt: cmsConnection.lastSyncAt,
                lastSyncError: cmsConnection.lastSyncError,
                hasGoogleAnalytics: cmsConnection.googleAnalyticsConnected,
                hasSearchConsole: cmsConnection.searchConsoleConnected,
                cmsPublicUrl: cmsConnection.cmsPublicUrl,
                cmsDashboardUrl: cmsConnection.cmsDashboardUrl
            }
        });

    } catch (error: any) {
        console.error('Error getting CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to get CMS connection' },
            { status: 500 }
        );
    }
}

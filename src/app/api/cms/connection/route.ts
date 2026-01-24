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

        // Verify user has access to this project
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                projects: {
                                    where: { id: projectId },
                                    include: {
                                        cmsConnection: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Find the project with CMS connection
        let cmsConnection = null;
        for (const membership of user.memberships) {
            const project = membership.organization.projects.find(p => p.id === projectId);
            if (project?.cmsConnection) {
                cmsConnection = project.cmsConnection;
                break;
            }
        }

        if (!cmsConnection) {
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this project'
            });
        }

        return NextResponse.json({
            enabled: true,
            connection: {
                name: cmsConnection.name,
                status: cmsConnection.status,
                lastSyncAt: cmsConnection.lastSyncAt,
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

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

        // Find user's memberships and projects with CMS connections
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                projects: {
                                    where: projectId ? { id: projectId } : undefined,
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

        // Find the first project with CMS connection (or specific one if projectId provided)
        let cmsConnection = null;
        let foundProjectId = null;
        for (const membership of user.memberships) {
            for (const project of membership.organization.projects) {
                if (project.cmsConnection) {
                    cmsConnection = project.cmsConnection;
                    foundProjectId = project.id;
                    break;
                }
            }
            if (cmsConnection) break;
        }

        if (!cmsConnection) {
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this project'
            });
        }

        return NextResponse.json({
            enabled: true,
            projectId: foundProjectId,
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

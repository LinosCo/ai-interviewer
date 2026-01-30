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

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Find projects with CMS connections that the user has access to
        const projects = await prisma.project.findMany({
            where: {
                id: projectId || undefined,
                organization: {
                    members: {
                        some: {
                            userId: user.id
                        }
                    }
                },
                OR: [
                    { cmsConnection: { isNot: null } },
                    { newCmsConnection: { isNot: null } }
                ] as any
            },
            include: {
                cmsConnection: true,
                newCmsConnection: true
            } as any
        });

        if (projects.length === 0) {
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this project'
            });
        }

        const project = projects[0];
        const cmsConnection = (project as any).newCmsConnection || (project as any).cmsConnection;
        const foundProjectId = project.id;

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

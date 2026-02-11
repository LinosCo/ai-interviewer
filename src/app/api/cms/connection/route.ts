import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/connection?projectId=xxx
 * Get the CMS connection status for a specific project.
 * If projectId is omitted, resolves the first eligible project in the user's organizations.
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

        // Find projects and any CMS connection (direct or shared) that the user can access
        const projects = await prisma.project.findMany({
            where: {
                ...(projectId ? { id: projectId } : {}),
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

        if (!projects.length) {
            return NextResponse.json({
                enabled: false,
                message: 'Project not found or access denied'
            });
        }

        type ProjectWithConnections = (typeof projects)[number];
        type ResolvedConnection = NonNullable<
            ProjectWithConnections['newCmsConnection']
            | ProjectWithConnections['cmsConnection']
            | ProjectWithConnections['cmsShares'][number]['connection']
        >;

        const resolveConnection = (project: ProjectWithConnections): ResolvedConnection | null => {
            const directConnection = project.newCmsConnection || project.cmsConnection;
            if (directConnection && directConnection.status !== 'DISABLED') {
                return directConnection;
            }
            return project.cmsShares.find((share) => share.connection.status !== 'DISABLED')?.connection || null;
        };

        const eligibleProjects = projects
            .map(project => ({
                project,
                connection: resolveConnection(project)
            }))
            .filter(
                (entry): entry is { project: ProjectWithConnections; connection: ResolvedConnection } => Boolean(entry.connection)
            );

        if (!eligibleProjects.length) {
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this project'
            });
        }

        const preferredProjectId = process.env.BUSINESS_TUNER_SELF_PROJECT_ID;
        const selected = eligibleProjects.find(entry => entry.project.id === preferredProjectId)
            || eligibleProjects.find(entry => entry.project.name.trim().toLowerCase() === 'business tuner')
            || eligibleProjects[0];
        const cmsConnection = selected.connection;
        const project = selected.project;

        return NextResponse.json({
            enabled: true,
            projectId: project.id,
            projectName: project.name,
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

    } catch (error: unknown) {
        console.error('Error getting CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to get CMS connection' },
            { status: 500 }
        );
    }
}

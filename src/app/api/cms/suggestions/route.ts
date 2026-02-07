import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/suggestions?projectId=xxx&status=xxx&type=xxx
 * List content suggestions for a project with CMS.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type');

        // Verify user has access to this project
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const projects = await prisma.project.findMany({
            where: {
                id: projectId || undefined,
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
            } as any,
            orderBy: { updatedAt: 'desc' }
        });

        const eligibleProjects = projects.filter((project: any) =>
            Boolean(project.newCmsConnection || project.cmsConnection || project.cmsShares?.[0]?.connection)
        );

        if (eligibleProjects.length === 0) {
            return NextResponse.json({
                suggestions: [],
                projectId: projectId || null,
                message: 'CMS integration not enabled for this project'
            });
        }

        const project = eligibleProjects[0];
        const cmsConnection = (project as any).newCmsConnection || (project as any).cmsConnection;
        const sharedConnection = (project as any).cmsShares?.[0]?.connection || null;
        const activeConnection = cmsConnection || sharedConnection;

        if (!activeConnection) {
            return NextResponse.json({ error: 'CMS integration not enabled for this project' }, { status: 400 });
        }

        // Build filter
        const where: any = {
            connectionId: activeConnection.id
        };

        if (status) {
            where.status = status;
        }

        if (type) {
            where.type = type;
        }

        // Get suggestions
        const suggestions = await prisma.cMSSuggestion.findMany({
            where,
            orderBy: [
                { priorityScore: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json({
            projectId: project.id,
            suggestions: suggestions.map(s => ({
                id: s.id,
                type: s.type,
                title: s.title,
                reasoning: s.reasoning,
                priorityScore: s.priorityScore,
                status: s.status,
                targetSection: s.targetSection,
                createdAt: s.createdAt,
                pushedAt: s.pushedAt,
                publishedAt: s.publishedAt,
                cmsPreviewUrl: s.cmsPreviewUrl
            }))
        });

    } catch (error: any) {
        console.error('Error getting CMS suggestions:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestions' },
            { status: 500 }
        );
    }
}

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

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Verify user has access to this project
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

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
                newCmsConnection: true
            } as any
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        const cmsConnection = (project as any).newCmsConnection || (project as any).cmsConnection;

        if (!cmsConnection) {
            return NextResponse.json({ error: 'CMS integration not enabled for this project' }, { status: 400 });
        }

        // Build filter
        const where: any = {
            connectionId: cmsConnection.id
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

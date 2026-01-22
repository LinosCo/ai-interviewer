import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/suggestions
 * List content suggestions for the user's organization.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization with CMS connection
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                cmsConnection: true
                            }
                        }
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        const org = user.memberships[0].organization;

        if (!org.hasCMSIntegration || !org.cmsConnection) {
            return NextResponse.json({ error: 'CMS integration not enabled' }, { status: 400 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type');

        // Build filter
        const where: any = {
            connectionId: org.cmsConnection.id
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

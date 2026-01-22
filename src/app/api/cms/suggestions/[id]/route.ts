import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/suggestions/[id]
 * Get a single suggestion's full details.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

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

        // Get suggestion
        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id }
        });

        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
        }

        // Verify ownership
        if (suggestion.connectionId !== org.cmsConnection.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            suggestion: {
                id: suggestion.id,
                type: suggestion.type,
                title: suggestion.title,
                slug: suggestion.slug,
                body: suggestion.body,
                metaDescription: suggestion.metaDescription,
                targetSection: suggestion.targetSection,
                reasoning: suggestion.reasoning,
                sourceSignals: suggestion.sourceSignals,
                priorityScore: suggestion.priorityScore,
                status: suggestion.status,
                cmsContentId: suggestion.cmsContentId,
                cmsPreviewUrl: suggestion.cmsPreviewUrl,
                createdAt: suggestion.createdAt,
                pushedAt: suggestion.pushedAt,
                publishedAt: suggestion.publishedAt,
                rejectedAt: suggestion.rejectedAt,
                rejectedReason: suggestion.rejectedReason
            }
        });

    } catch (error: any) {
        console.error('Error getting CMS suggestion:', error);
        return NextResponse.json(
            { error: 'Failed to get suggestion' },
            { status: 500 }
        );
    }
}

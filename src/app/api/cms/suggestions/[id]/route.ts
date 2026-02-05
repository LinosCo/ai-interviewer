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

        // Get suggestion with connection info
        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id },
            include: {
                connection: true
            }
        });

        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
        }

        // Verify user has access to this project
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    where: {
                        organizationId: suggestion.connection.organizationId || undefined
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
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

/**
 * PATCH /api/cms/suggestions/[id]
 * Update a suggestion draft before pushing to CMS.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const payload = await request.json();

        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id },
            include: { connection: true }
        });

        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
        }

        if (suggestion.status !== 'PENDING') {
            return NextResponse.json({ error: 'Only pending suggestions can be edited' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    where: {
                        organizationId: suggestion.connection.organizationId || undefined
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const data: any = {};
        if (typeof payload.title === 'string') data.title = payload.title.trim();
        if (typeof payload.body === 'string') data.body = payload.body.trim();
        if ('slug' in payload) data.slug = payload.slug ? String(payload.slug).trim() : null;
        if ('metaDescription' in payload) data.metaDescription = payload.metaDescription ? String(payload.metaDescription).trim() : null;
        if ('targetSection' in payload) data.targetSection = payload.targetSection ? String(payload.targetSection).trim() : null;

        if (!Object.keys(data).length) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const updated = await prisma.cMSSuggestion.update({
            where: { id },
            data
        });

        return NextResponse.json({
            success: true,
            suggestion: {
                id: updated.id,
                title: updated.title,
                slug: updated.slug,
                body: updated.body,
                metaDescription: updated.metaDescription,
                targetSection: updated.targetSection
            }
        });
    } catch (error: any) {
        console.error('Error updating CMS suggestion:', error);
        return NextResponse.json(
            { error: 'Failed to update suggestion' },
            { status: 500 }
        );
    }
}

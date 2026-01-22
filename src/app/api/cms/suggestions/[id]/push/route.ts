import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/cms/suggestions/[id]/push
 * Push a suggestion to the CMS as a draft.
 */
export async function POST(
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

        // Check connection status
        if (org.cmsConnection.status !== 'ACTIVE') {
            return NextResponse.json(
                { error: 'CMS connection is not active. Please verify the connection first.' },
                { status: 400 }
            );
        }

        // Push suggestion
        const result = await CMSConnectionService.pushSuggestion(id);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to push suggestion' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            cmsContentId: result.cmsContentId,
            previewUrl: result.previewUrl
        });

    } catch (error: any) {
        console.error('Error pushing suggestion:', error);
        return NextResponse.json(
            { error: 'Failed to push suggestion' },
            { status: 500 }
        );
    }
}

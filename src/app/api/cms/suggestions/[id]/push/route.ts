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

        // Get suggestion with connection info
        const suggestion = await prisma.cMSSuggestion.findUnique({
            where: { id },
            include: {
                connection: {
                    include: {
                        project: true
                    }
                }
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
                        organizationId: suggestion.connection.project.organizationId || undefined
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check connection status
        if (suggestion.connection.status !== 'ACTIVE') {
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

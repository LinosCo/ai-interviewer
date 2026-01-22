import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * POST /api/cms/suggestions/[id]/reject
 * Reject a suggestion.
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
        const body = await request.json().catch(() => ({}));
        const { reason } = body;

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

        // Reject suggestion
        await prisma.cMSSuggestion.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedReason: reason || 'Rifiutato dall\'utente'
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error rejecting suggestion:', error);
        return NextResponse.json(
            { error: 'Failed to reject suggestion' },
            { status: 500 }
        );
    }
}

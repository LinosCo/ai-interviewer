import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/visibility/brands
 * Get all visibility brands for the user's organization, optionally filtered by project
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');

        // Get user's organization
        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true }
        });

        if (!membership?.organizationId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Build filter
        const where: any = {
            organizationId: membership.organizationId
        };

        // If projectId is provided, filter by it
        if (projectId) {
            where.projectId = projectId;
        }

        const brands = await prisma.visibilityConfig.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                project: { select: { id: true, name: true } },
                scans: {
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                    where: { status: 'completed' },
                    select: {
                        score: true,
                        completedAt: true
                    }
                },
                _count: {
                    select: { prompts: true, competitors: true }
                }
            }
        });

        return NextResponse.json({ brands });

    } catch (error: any) {
        console.error('Error fetching visibility brands:', error);
        return NextResponse.json(
            { error: 'Failed to fetch brands' },
            { status: 500 }
        );
    }
}

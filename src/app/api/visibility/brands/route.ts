import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

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
        const selectedOrganizationId = url.searchParams.get('organizationId');

        const organizationId = await resolveActiveOrganizationIdForUser(session.user.id, {
            preferredOrganizationId: selectedOrganizationId
        });

        if (!organizationId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Build filter
        const where: any = {
            organizationId
        };

        // If projectId is provided, include direct and shared associations.
        if (projectId) {
            where.OR = [
                { projectId },
                { projectShares: { some: { projectId } } }
            ];
        }

        let brands: any[] = [];
        try {
            brands = await prisma.visibilityConfig.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    project: { select: { id: true, name: true } },
                    projectShares: { select: { projectId: true } },
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
        } catch (err: any) {
            // Backward compatibility: DB not migrated yet (missing ProjectVisibilityConfig)
            if (err?.code !== 'P2021') throw err;
            const legacyWhere: any = {
                organizationId
            };
            if (projectId) {
                legacyWhere.projectId = projectId;
            }
            brands = await prisma.visibilityConfig.findMany({
                where: legacyWhere,
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
        }

        const filteredBrands = projectId
            ? brands.filter((b: any) => b.projectId === projectId || b.projectShares?.some((s: any) => s.projectId === projectId))
            : brands;

        return NextResponse.json({ brands: filteredBrands });

    } catch (error: any) {
        console.error('Error fetching visibility brands:', error);
        return NextResponse.json(
            { error: 'Failed to fetch brands' },
            { status: 500 }
        );
    }
}

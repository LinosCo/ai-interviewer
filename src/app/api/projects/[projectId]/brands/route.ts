import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = await params;

        // Verify user has access to project
        let project = null as any;
        try {
            project = await prisma.project.findUnique({
                where: { id: projectId },
                include: {
                    organization: {
                        include: {
                            subscription: true,
                            visibilityConfigs: {
                                include: {
                                    projectShares: {
                                        select: { projectId: true }
                                    },
                                    scans: {
                                        where: { status: 'completed' },
                                        orderBy: { completedAt: 'desc' },
                                        take: 1
                                    }
                                }
                            }
                        }
                    },
                    accessList: true
                }
            });
        } catch (error: any) {
            if (error?.code !== 'P2021') throw error;
            project = await prisma.project.findUnique({
                where: { id: projectId },
                include: {
                    organization: {
                        include: {
                            subscription: true,
                            visibilityConfigs: {
                                include: {
                                    scans: {
                                        where: { status: 'completed' },
                                        orderBy: { completedAt: 'desc' },
                                        take: 1
                                    }
                                }
                            }
                        }
                    },
                    accessList: true
                }
            });
        }

        if (!project || !project.organization) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const userId = session.user.id;

        // Check access
        const hasAccess = project.ownerId === userId ||
            project.accessList.some((a: any) => a.userId === userId);

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const org = project.organization;
        const allBrands = org.visibilityConfigs;

        // Get plan limits
        const planType = org.subscription
            ? subscriptionTierToPlanType(org.subscription.tier)
            : 'TRIAL';
        const plan = PLANS[planType as keyof typeof PLANS];
        // Brand tracking limit - allow unlimited (-1) if visibility is enabled, else 0
        const maxBrands = plan.limits.visibilityEnabled ? -1 : 0;

        // Separate linked and unlinked brands
        const linkedBrands = allBrands
            .filter((b: any) => b.projectId === projectId || b.projectShares?.some((s: any) => s.projectId === projectId))
            .map((b: any) => ({
                id: b.id,
                brandName: b.brandName,
                category: b.category,
                projectId: b.projectId,
                latestScore: b.scans[0]?.score || null
            }));

        const unlinkedBrands = allBrands
            .filter((b: any) => b.projectId !== projectId && !b.projectShares?.some((s: any) => s.projectId === projectId))
            .map((b: any) => ({
                id: b.id,
                brandName: b.brandName,
                category: b.category,
                projectId: b.projectId,
                latestScore: b.scans[0]?.score || null
            }));

        return NextResponse.json({
            linkedBrands,
            unlinkedBrands,
            maxBrands,
            totalBrands: allBrands.length
        });

    } catch (error) {
        console.error('Error fetching project brands:', error);
        return NextResponse.json(
            { error: 'Failed to fetch brands' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = await params;
        const body = await request.json();
        const { brandId, action } = body;

        if (!brandId || !action) {
            return NextResponse.json(
                { error: 'brandId and action are required' },
                { status: 400 }
            );
        }

        // Verify user has OWNER access to project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { accessList: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const userId = session.user.id;
        const userAccess = project.accessList.find((a: any) => a.userId === userId);
        const isOwner = project.ownerId === userId || userAccess?.role === 'OWNER';

        if (!isOwner) {
            return NextResponse.json(
                { error: 'Only project owners can manage brand associations' },
                { status: 403 }
            );
        }

        // Verify brand belongs to same organization
        const brand = await prisma.visibilityConfig.findUnique({
            where: { id: brandId }
        });

        if (!brand || brand.organizationId !== project.organizationId) {
            return NextResponse.json(
                { error: 'Brand not found or belongs to different organization' },
                { status: 404 }
            );
        }

        // Check if ProjectVisibilityConfig table exists to avoid transaction poisoning
        const tableCheck = await prisma.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ProjectVisibilityConfig')
        `;
        const projectVisibilityConfigExists = tableCheck[0]?.exists || false;

        if (action === 'link') {
            // 1. Project-Visibility association (OUTSIDE transaction to avoid poisoning)
            if (projectVisibilityConfigExists) {
                try {
                    await prisma.projectVisibilityConfig.upsert({
                        where: {
                            projectId_configId: {
                                projectId,
                                configId: brandId
                            }
                        },
                        update: {},
                        create: {
                            projectId,
                            configId: brandId,
                            createdBy: userId
                        }
                    });
                } catch (error: any) {
                    console.warn('Error during projectVisibilityConfig upsert:', error?.code, error?.message);
                }
            }

            // 2. Keep backward compatibility: ensure a primary project exists.
            if (!brand.projectId) {
                try {
                    await prisma.visibilityConfig.update({
                        where: { id: brandId },
                        data: { projectId }
                    });
                } catch (error: any) {
                    console.error('Error updating primary projectId:', error);
                }
            }

            return NextResponse.json({ success: true, action: 'linked' });

        } else if (action === 'unlink') {
            // 1. Delete project association (OUTSIDE transaction to avoid poisoning)
            if (projectVisibilityConfigExists) {
                try {
                    await prisma.projectVisibilityConfig.deleteMany({
                        where: {
                            projectId,
                            configId: brandId
                        }
                    });
                } catch (error: any) {
                    console.warn('Error during projectVisibilityConfig delete:', error?.code, error?.message);
                }
            }

            // 2. If this project is the primary one, switch primary to another shared project if available.
            let currentBrand: { projectId: string | null; projectShares?: Array<{ projectId: string }> } | null = null;
            if (projectVisibilityConfigExists) {
                try {
                    currentBrand = await prisma.visibilityConfig.findUnique({
                        where: { id: brandId },
                        select: {
                            projectId: true,
                            projectShares: {
                                where: { projectId: { not: projectId } },
                                orderBy: { createdAt: 'asc' },
                                select: { projectId: true }
                            }
                        }
                    });
                } catch (error: any) {
                    console.warn('Error checking project shares:', error?.code, error?.message);
                    currentBrand = await prisma.visibilityConfig.findUnique({
                        where: { id: brandId },
                        select: { projectId: true }
                    });
                }
            } else {
                currentBrand = await prisma.visibilityConfig.findUnique({
                    where: { id: brandId },
                    select: { projectId: true }
                });
            }

            if (currentBrand?.projectId === projectId) {
                try {
                    await prisma.visibilityConfig.update({
                        where: { id: brandId },
                        data: { projectId: currentBrand.projectShares?.[0]?.projectId || null }
                    });
                } catch (error: any) {
                    console.error('Error switching primary projectId:', error);
                }
            }

            return NextResponse.json({ success: true, action: 'unlinked' });

        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "link" or "unlink"' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('Error managing project brand:', error);
        return NextResponse.json(
            { error: 'Failed to manage brand association' },
            { status: 500 }
        );
    }
}

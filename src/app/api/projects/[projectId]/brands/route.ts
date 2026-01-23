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
        const project = await prisma.project.findUnique({
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

        if (!project || !project.organization) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const userId = session.user.id;

        // Check access
        const hasAccess = project.ownerId === userId ||
            project.accessList.some(a => a.userId === userId);

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
            .filter(b => b.projectId === projectId)
            .map(b => ({
                id: b.id,
                brandName: b.brandName,
                category: b.category,
                projectId: b.projectId,
                latestScore: b.scans[0]?.score || null
            }));

        const unlinkedBrands = allBrands
            .filter(b => !b.projectId)
            .map(b => ({
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
        const userAccess = project.accessList.find(a => a.userId === userId);
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

        if (action === 'link') {
            await prisma.visibilityConfig.update({
                where: { id: brandId },
                data: { projectId }
            });

            return NextResponse.json({ success: true, action: 'linked' });

        } else if (action === 'unlink') {
            await prisma.visibilityConfig.update({
                where: { id: brandId },
                data: { projectId: null }
            });

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

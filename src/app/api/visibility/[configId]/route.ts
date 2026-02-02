import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/visibility/[configId]
 * Get details for a specific visibility configuration (brand).
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ configId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { configId } = await params;

        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            include: {
                organization: {
                    select: { id: true, name: true }
                },
                project: {
                    select: { id: true, name: true }
                },
                prompts: {
                    orderBy: { orderIndex: 'asc' }
                },
                competitors: true,
                scans: {
                    orderBy: { startedAt: 'desc' },
                    take: 1,
                    include: { metrics: true }
                },
                _count: {
                    select: { prompts: true, competitors: true, scans: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Verify user has access to the organization
        const membership = await prisma.membership.findFirst({
            where: {
                userId: session.user.id,
                organizationId: config.organizationId
            }
        });

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            config: {
                ...config,
                latestScan: config.scans[0] || null
            }
        });

    } catch (error: any) {
        console.error('Error fetching visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch visibility configuration' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/visibility/[configId]
 * Update a specific visibility configuration (brand).
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ configId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { configId } = await params;
        const body = await request.json();

        // Get config to check permissions
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Verify user has permission (ADMIN or ORG OWNER/ADMIN)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        const isSystemAdmin = user?.role === 'ADMIN';

        const membership = await prisma.membership.findFirst({
            where: {
                userId: session.user.id,
                organizationId: config.organizationId,
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!isSystemAdmin && !membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Update allowed fields only
        const updateData: any = {};
        if (body.brandName !== undefined) updateData.brandName = body.brandName;
        if (body.category !== undefined) updateData.category = body.category;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.language !== undefined) updateData.language = body.language;
        if (body.territory !== undefined) updateData.territory = body.territory;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.projectId !== undefined) updateData.projectId = body.projectId;

        const updatedConfig = await prisma.visibilityConfig.update({
            where: { id: configId },
            data: updateData,
            include: {
                organization: {
                    select: { id: true, name: true }
                },
                project: {
                    select: { id: true, name: true }
                }
            }
        });

        return NextResponse.json({
            success: true,
            config: updatedConfig
        });

    } catch (error: any) {
        console.error('Error updating visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to update visibility configuration' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/visibility/[configId]
 * Delete a specific visibility configuration (brand) and all related data.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ configId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { configId } = await params;

        // Get config to check permissions
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: {
                id: true,
                brandName: true,
                organizationId: true,
                _count: {
                    select: { scans: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Verify user has permission (ADMIN or ORG OWNER/ADMIN)
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        const isSystemAdmin = user?.role === 'ADMIN';

        const membership = await prisma.membership.findFirst({
            where: {
                userId: session.user.id,
                organizationId: config.organizationId,
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!isSystemAdmin && !membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete the config (cascade will delete prompts, competitors, scans, etc.)
        await prisma.visibilityConfig.delete({
            where: { id: configId }
        });

        return NextResponse.json({
            success: true,
            message: `Brand "${config.brandName}" deleted successfully`
        });

    } catch (error: any) {
        console.error('Error deleting visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to delete visibility configuration' },
            { status: 500 }
        );
    }
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * POST /api/visibility/[configId]/transfer-organization
 * Transfer a Brand Monitor config to another organization.
 */
export async function POST(
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
        const { targetOrganizationId } = body;

        if (!targetOrganizationId || typeof targetOrganizationId !== 'string') {
            return NextResponse.json(
                { error: 'targetOrganizationId is required' },
                { status: 400 }
            );
        }

        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: {
                id: true,
                brandName: true,
                organizationId: true
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
        }

        if (config.organizationId === targetOrganizationId) {
            return NextResponse.json(
                { error: 'Brand is already in the target organization' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });
        const isSystemAdmin = user?.role === 'ADMIN';

        const targetOrg = await prisma.organization.findUnique({
            where: { id: targetOrganizationId },
            select: { id: true }
        });

        if (!targetOrg) {
            return NextResponse.json(
                { error: 'Target organization not found' },
                { status: 404 }
            );
        }

        if (!isSystemAdmin) {
            const [sourceMembership, targetMembership] = await Promise.all([
                prisma.membership.findFirst({
                    where: {
                        userId: session.user.id,
                        organizationId: config.organizationId,
                        role: { in: ['OWNER', 'ADMIN'] }
                    },
                    select: { id: true }
                }),
                prisma.membership.findFirst({
                    where: {
                        userId: session.user.id,
                        organizationId: targetOrganizationId,
                        role: { in: ['OWNER', 'ADMIN'] }
                    },
                    select: { id: true }
                })
            ]);

            if (!sourceMembership) {
                return NextResponse.json(
                    { error: 'Insufficient permissions in source organization' },
                    { status: 403 }
                );
            }

            if (!targetMembership) {
                return NextResponse.json(
                    { error: 'Insufficient permissions in target organization' },
                    { status: 403 }
                );
            }
        }

        const updatedConfig = await prisma.$transaction(async (tx) => {
            await tx.projectVisibilityConfig.deleteMany({
                where: { configId: config.id }
            });

            return tx.visibilityConfig.update({
                where: { id: config.id },
                data: {
                    organizationId: targetOrganizationId,
                    // Project association is org-scoped, so reset on transfer.
                    projectId: null
                },
                select: {
                    id: true,
                    brandName: true,
                    organizationId: true,
                    projectId: true
                }
            });
        });

        return NextResponse.json({
            success: true,
            brand: updatedConfig,
            message: `Brand "${config.brandName}" transferred successfully`
        });

    } catch (error: unknown) {
        console.error('Error transferring brand to organization:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

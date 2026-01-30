import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, PlanType } from '@/config/plans';

/**
 * PATCH /api/admin/organizations/[orgId]
 * Update or transfer organization (Admin only)
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, slug, newOwnerEmail, plan } = body;

        // Check if organization exists
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                members: {
                    where: { role: 'OWNER' }
                }
            }
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const data: any = {};
            if (name) data.name = name;
            if (slug) data.slug = slug;
            if (plan) {
                // Determine PlanType enum value
                const planValue = plan === 'FREE' ? 'TRIAL' : plan.toUpperCase();
                data.plan = planValue;

                // Sync monthlyCreditsLimit from PLANS
                const planConfig = PLANS[planValue as PlanType] || PLANS[PlanType.FREE];
                data.monthlyCreditsLimit = BigInt(planConfig.monthlyCredits);

                // Also upsert Subscription to keep strictly in sync
                const subscriptionTier = plan.toUpperCase();
                await tx.subscription.upsert({
                    where: { organizationId: orgId },
                    update: {
                        tier: subscriptionTier as any,
                        status: 'ACTIVE',
                    },
                    create: {
                        organizationId: orgId,
                        tier: subscriptionTier as any,
                        status: 'ACTIVE',
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    }
                });
            }

            const updatedOrg = await tx.organization.update({
                where: { id: orgId },
                data
            });

            if (newOwnerEmail) {
                // Find new owner
                const newOwner = await tx.user.findUnique({
                    where: { email: newOwnerEmail }
                });

                if (!newOwner) {
                    throw new Error('New owner user not found');
                }

                // Demote existing owner(s) to MEMBER if any
                await tx.membership.updateMany({
                    where: {
                        organizationId: orgId,
                        role: 'OWNER'
                    },
                    data: {
                        role: 'MEMBER'
                    }
                });

                // Upsert new owner membership
                await tx.membership.upsert({
                    where: {
                        userId_organizationId: {
                            userId: newOwner.id,
                            organizationId: orgId
                        }
                    },
                    update: {
                        role: 'OWNER',
                        status: 'ACTIVE'
                    },
                    create: {
                        userId: newOwner.id,
                        organizationId: orgId,
                        role: 'OWNER',
                        status: 'ACTIVE',
                        joinedAt: new Date()
                    }
                });
            }

            return updatedOrg;
        });

        // Serialize BigInts before returning
        const serializedOrg = {
            ...result,
            monthlyCreditsLimit: result.monthlyCreditsLimit ? result.monthlyCreditsLimit.toString() : null,
            monthlyCreditsUsed: result.monthlyCreditsUsed ? result.monthlyCreditsUsed.toString() : '0',
            packCreditsAvailable: result.packCreditsAvailable ? result.packCreditsAvailable.toString() : '0'
        };

        return NextResponse.json(serializedOrg);

    } catch (error: any) {
        console.error('Error updating organization:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update organization' },
            { status: 500 }
        );
    }
}

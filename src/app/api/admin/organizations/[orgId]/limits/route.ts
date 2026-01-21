import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
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

        const { orgId } = await params;
        const body = await request.json();
        const { maxInterviews, maxChatbots, maxProjects, plan } = body;

        // Update organization
        const updateData: any = {};

        if (plan) {
            updateData.plan = plan;
        }

        // Store custom limits in organization's metadata or a dedicated field
        // For now, we'll update the subscription if it exists
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: { subscription: true }
        });

        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Update org plan if changed
        if (plan && plan !== org.plan) {
            await prisma.organization.update({
                where: { id: orgId },
                data: { plan }
            });

            // Also update subscription tier if exists
            if (org.subscription) {
                await prisma.subscription.update({
                    where: { id: org.subscription.id },
                    data: { tier: plan }
                });
            }
        }

        // Store custom limits in subscription metadata or a JSON field
        // For this implementation, we'll store them in the subscription customLimits field
        if (org.subscription) {
            await prisma.subscription.update({
                where: { id: org.subscription.id },
                data: {
                    customLimits: {
                        maxInterviews: maxInterviews || null,
                        maxChatbots: maxChatbots || null,
                        maxProjects: maxProjects || null
                    }
                }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error updating organization limits:', error);
        return NextResponse.json(
            { error: 'Failed to update limits' },
            { status: 500 }
        );
    }
}

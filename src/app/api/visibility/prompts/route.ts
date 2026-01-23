import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getOrCreateSubscription } from '@/lib/usage';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';

// Create new prompt
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    take: 1,
                    include: { organization: true }
                }
            }
        });

        if (!user || !user.memberships[0]) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0].organizationId;

        // Check plan limits
        const subscription = await getOrCreateSubscription(organizationId);
        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }
        const planType = subscriptionTierToPlanType(subscription.tier);
        const plan = PLANS[planType];

        const config = await prisma.visibilityConfig.findFirst({
            where: { organizationId },
            include: {
                prompts: {
                    where: { enabled: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Check if limit is reached (default 20 prompts if visibility enabled)
        const maxPrompts = plan.limits.visibilityEnabled ? 20 : 0;
        if (config.prompts.length >= maxPrompts) {
            return NextResponse.json(
                { error: `Maximum prompts limit (${maxPrompts}) reached for your plan` },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { text, enabled = true } = body;

        if (!text) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }

        // Get the highest orderIndex
        const maxOrder = await prisma.visibilityPrompt.findFirst({
            where: { configId: config.id },
            orderBy: { orderIndex: 'desc' },
            select: { orderIndex: true }
        });

        const prompt = await prisma.visibilityPrompt.create({
            data: {
                configId: config.id,
                text,
                enabled,
                orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
                generatedByAI: false,
                lastEditedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, prompt });

    } catch (error) {
        console.error('Error creating prompt:', error);
        return NextResponse.json(
            { error: 'Failed to create prompt' },
            { status: 500 }
        );
    }
}

// Reorder prompts
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, promptIds } = body;

        if (action === 'reorder' && promptIds) {
            // Update order for multiple prompts
            const updates = promptIds.map((id: string, index: number) =>
                prisma.visibilityPrompt.update({
                    where: { id },
                    data: { orderIndex: index }
                })
            );

            await prisma.$transaction(updates);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Error reordering prompts:', error);
        return NextResponse.json(
            { error: 'Failed to reorder prompts' },
            { status: 500 }
        );
    }
}

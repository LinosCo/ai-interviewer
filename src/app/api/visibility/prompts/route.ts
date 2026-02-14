import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, PlanType } from '@/config/plans';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

// Create new prompt
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                plan: true,
                role: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = await resolveActiveOrganizationIdForUser(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Use user's plan (admin has unlimited access)
        const isAdmin = user.role === 'ADMIN' || user.plan === 'ADMIN';
        const plan = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];

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

        // Check if limit is reached (admin bypasses, 20 prompts if visibility enabled)
        const maxPrompts = isAdmin ? 999 : (plan.features.visibilityTracker ? 20 : 0);
        if (!isAdmin && config.prompts.length >= maxPrompts) {
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

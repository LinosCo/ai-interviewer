import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getOrCreateSubscription } from '@/lib/usage';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';

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

        if (plan.limits.maxVisibilityPrompts === 0) {
            return NextResponse.json(
                { error: 'Visibility tracking not available in your plan' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { brandName, category, description, language, territory, prompts, competitors } = body;

        if (!brandName || !category) {
            return NextResponse.json(
                { error: 'brandName and category are required' },
                { status: 400 }
            );
        }

        // Validate limits
        const enabledPrompts = prompts?.filter((p: any) => p.enabled) || [];
        const enabledCompetitors = competitors?.filter((c: any) => c.enabled) || [];

        if (enabledPrompts.length > plan.limits.maxVisibilityPrompts) {
            return NextResponse.json(
                { error: `Your plan allows a maximum of ${plan.limits.maxVisibilityPrompts} prompts` },
                { status: 400 }
            );
        }

        if (enabledCompetitors.length > plan.limits.maxCompetitorsTracked) {
            return NextResponse.json(
                { error: `Your plan allows a maximum of ${plan.limits.maxCompetitorsTracked} competitors` },
                { status: 400 }
            );
        }

        // Check if config already exists
        const existingConfig = await prisma.visibilityConfig.findUnique({
            where: { organizationId }
        });

        if (existingConfig) {
            return NextResponse.json(
                { error: 'Visibility configuration already exists. Use PATCH to update.' },
                { status: 409 }
            );
        }

        // Create configuration with prompts and competitors
        const config = await prisma.visibilityConfig.create({
            data: {
                organizationId,
                brandName,
                category,
                description: description || '',
                language: language || 'it',
                territory: territory || 'IT',
                isActive: true,
                // Schedule first scan for 1 week from now
                nextScanAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                prompts: {
                    create: prompts?.map((p: any, index: number) => ({
                        text: p.text,
                        enabled: p.enabled ?? true,
                        orderIndex: index,
                        generatedByAI: true,
                        lastEditedAt: new Date()
                    })) || []
                },
                competitors: {
                    create: competitors?.map((c: any) => ({
                        name: c.name,
                        website: c.website || null,
                        enabled: c.enabled ?? true
                    })) || []
                }
            },
            include: {
                prompts: true,
                competitors: true
            }
        });

        return NextResponse.json({
            success: true,
            configId: config.id,
            config: {
                ...config,
                promptCount: config.prompts.length,
                competitorCount: config.competitors.length,
                nextScanAt: config.nextScanAt
            }
        });

    } catch (error) {
        console.error('Error creating visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to create visibility configuration' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
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

        const config = await prisma.visibilityConfig.findUnique({
            where: { organizationId },
            include: {
                prompts: {
                    orderBy: { orderIndex: 'asc' }
                },
                competitors: true,
                scans: {
                    orderBy: { startedAt: 'desc' },
                    take: 1,
                    include: {
                        metrics: true
                    }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        return NextResponse.json({
            config: {
                ...config,
                latestScan: config.scans[0] || null
            }
        });

    } catch (error) {
        console.error('Error fetching visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch visibility configuration' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
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

        const body = await request.json();
        const { brandName, category, description, language, territory, isActive } = body;

        const config = await prisma.visibilityConfig.update({
            where: { organizationId },
            data: {
                ...(brandName && { brandName }),
                ...(category && { category }),
                ...(description !== undefined && { description }),
                ...(language && { language }),
                ...(territory && { territory }),
                ...(isActive !== undefined && { isActive })
            }
        });

        return NextResponse.json({
            success: true,
            config
        });

    } catch (error) {
        console.error('Error updating visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to update visibility configuration' },
            { status: 500 }
        );
    }
}

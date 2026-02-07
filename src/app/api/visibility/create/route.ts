import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, PlanType } from '@/config/plans';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user with plan info
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                plan: true,
                role: true,
                memberships: {
                    select: { organizationId: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { brandName, category, description, language, territory, prompts, competitors, organizationId, websiteUrl, additionalUrls } = body;

        // Determine organizationId: use provided if admin, or fallback to first membership
        let finalOrganizationId = organizationId;

        if (!finalOrganizationId || user.role !== 'ADMIN') {
            finalOrganizationId = user.memberships[0]?.organizationId;
        }

        if (!finalOrganizationId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Get organization's subscription (the source of truth for limits)
        const subscription = await prisma.subscription.findUnique({
            where: { organizationId: finalOrganizationId }
        });

        // Use organization's plan (admin role has unlimited access)
        const isAdmin = user.role === 'ADMIN';
        const tier = subscription?.tier as PlanType || PlanType.FREE;
        const plan = PLANS[tier];

        if (!isAdmin && !plan.features.visibilityTracker) {
            return NextResponse.json(
                { error: 'Visibility tracking non disponibile nel tuo piano' },
                { status: 403 }
            );
        }

        // Check brand limit (unlimited if visibility enabled)
        const existingBrands = await prisma.visibilityConfig.count({
            where: { organizationId: finalOrganizationId }
        });

        const maxBrands = (isAdmin || plan.features.visibilityTracker) ? -1 : 0; // -1 = unlimited
        if (maxBrands !== -1 && existingBrands >= maxBrands) {
            return NextResponse.json(
                { error: `Limite brand raggiunto (${maxBrands}). Passa a un piano superiore per monitorare più brand.` },
                { status: 400 }
            );
        }

        const { projectId } = body;

        if (!brandName || !category) {
            return NextResponse.json(
                { error: 'brandName and category are required' },
                { status: 400 }
            );
        }

        // Validate limits based on plan config
        const enabledPrompts = prompts?.filter((p: any) => p.enabled) || [];
        const enabledCompetitors = competitors?.filter((c: any) => c.enabled) || [];

        // Let's use more generous default limits from our plans
        const maxPrompts = isAdmin ? 999 : (plan.limits.maxAiSuggestionsPerMonth || 10); // Reuse suggestion limit or default 10
        const maxCompetitors = isAdmin ? 999 : (plan.limits.maxVisibilityQueriesPerMonth > 0 ? 15 : 5); // Default 15 for pro/business, 5 for trial

        if (!isAdmin && enabledPrompts.length > maxPrompts) {
            return NextResponse.json(
                { error: `Your plan allows a maximum of ${maxPrompts} prompts` },
                { status: 400 }
            );
        }

        if (!isAdmin && enabledCompetitors.length > maxCompetitors) {
            return NextResponse.json(
                { error: `Your plan allows a maximum of ${maxCompetitors} competitors` },
                { status: 400 }
            );
        }

        // If no projectId or specific brand name provided, we might want to check for duplicates
        // but for now let's allow multiple brands in the same organization
        /*
        const existingConfig = await prisma.visibilityConfig.findFirst({
            where: { organizationId, brandName }
        });
        */

        // Create configuration with prompts and competitors
        const config = await prisma.visibilityConfig.create({
            data: {
                organizationId: finalOrganizationId,
                brandName,
                category,
                description: description || '',
                websiteUrl: websiteUrl || null,
                additionalUrls: additionalUrls || null,
                language: language || 'it',
                territory: territory || 'IT',
                isActive: true,
                projectId: projectId || null,
                // Schedule first scan for 1 week from now
                nextScanAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                prompts: {
                    create: prompts?.map((p: any, index: number) => ({
                        text: p.text,
                        enabled: p.enabled ?? true,
                        orderIndex: index,
                        generatedByAI: true,
                        lastEditedAt: new Date(),
                        referenceUrl: p.referenceUrl || null
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

        if (projectId) {
            await prisma.projectVisibilityConfig.upsert({
                where: {
                    projectId_configId: {
                        projectId,
                        configId: config.id
                    }
                },
                update: {},
                create: {
                    projectId,
                    configId: config.id,
                    createdBy: user.id
                }
            });
        }

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
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('id');
        const projectId = searchParams.get('projectId');

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                memberships: {
                    take: 1,
                    select: { organizationId: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0]?.organizationId;

        let config;
        try {
            config = await prisma.visibilityConfig.findFirst({
                where: {
                    organizationId,
                    ...(configId ? { id: configId } : {}),
                    ...(projectId ? {
                        OR: [
                            { projectId },
                            { projectShares: { some: { projectId } } }
                        ]
                    } : {})
                },
                include: {
                    prompts: {
                        orderBy: { orderIndex: 'asc' }
                    },
                    competitors: true,
                    projectShares: {
                        select: { projectId: true }
                    },
                    scans: {
                        orderBy: { startedAt: 'desc' },
                        take: 1,
                        include: {
                            metrics: true
                        }
                    }
                }
            });
        } catch (error: any) {
            if (error?.code !== 'P2021') throw error;
            config = await prisma.visibilityConfig.findFirst({
                where: {
                    organizationId,
                    ...(configId ? { id: configId } : {}),
                    ...(projectId ? { projectId } : {})
                },
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
        }

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
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                plan: true,
                role: true,
                memberships: {
                    take: 1,
                    select: { organizationId: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0]?.organizationId;

        const body = await request.json();
        const { id, brandName, category, description, language, territory, isActive, prompts, competitors, projectId, websiteUrl, additionalUrls } = body;

        // Check if config exists
        const existingConfig = await prisma.visibilityConfig.findFirst({
            where: {
                organizationId,
                ...(id ? { id } : {})
            }
        });

        if (!existingConfig) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Get organization's subscription
        const subscription = await prisma.subscription.findUnique({
            where: { organizationId }
        });

        // Use organization's plan (admin bypasses limits)
        const isAdmin = user.role === 'ADMIN';
        const tier = subscription?.tier as PlanType || PlanType.FREE;
        const plan = PLANS[tier];

        // Limits validation
        const maxPrompts = isAdmin ? 999 : (plan.limits.maxAiSuggestionsPerMonth || 10);
        const maxCompetitors = isAdmin ? 999 : (plan.limits.maxVisibilityQueriesPerMonth > 0 ? 15 : 5);

        if (!isAdmin && prompts) {
            const enabledPrompts = prompts.filter((p: any) => p.enabled);
            if (enabledPrompts.length > maxPrompts) {
                return NextResponse.json(
                    { error: `Your plan allows a maximum of ${maxPrompts} prompts` },
                    { status: 400 }
                );
            }
        }

        if (!isAdmin && competitors) {
            const enabledCompetitors = competitors.filter((c: any) => c.enabled);
            if (enabledCompetitors.length > maxCompetitors) {
                return NextResponse.json(
                    { error: `Your plan allows a maximum of ${maxCompetitors} competitors` },
                    { status: 400 }
                );
            }
        }

        // Use a transaction to ensure atomic updates
        const updatedConfig = await prisma.$transaction(async (tx) => {
            // 1. Update basic info
            const config = await tx.visibilityConfig.update({
                where: { id: existingConfig.id },
                data: {
                    ...(brandName && { brandName }),
                    ...(category && { category }),
                    ...(description !== undefined && { description }),
                    ...(websiteUrl !== undefined && { websiteUrl }),
                    ...(additionalUrls !== undefined && { additionalUrls }),
                    ...(language && { language }),
                    ...(territory && { territory }),
                    ...(isActive !== undefined && { isActive }),
                    ...(projectId !== undefined && { projectId })
                }
            });

            if (projectId !== undefined && projectId) {
                await tx.projectVisibilityConfig.upsert({
                    where: {
                        projectId_configId: {
                            projectId,
                            configId: config.id
                        }
                    },
                    update: {},
                    create: {
                        projectId,
                        configId: config.id,
                        createdBy: user.id
                    }
                });
            }

            // 2. Sync Prompts if provided
            if (prompts) {
                // Delete existing
                await tx.visibilityPrompt.deleteMany({
                    where: { configId: config.id }
                });

                // Create new
                if (prompts.length > 0) {
                    await tx.visibilityPrompt.createMany({
                        data: prompts.map((p: any, index: number) => ({
                            configId: config.id,
                            text: p.text,
                            enabled: p.enabled ?? true,
                            orderIndex: index,
                            generatedByAI: p.generatedByAI ?? false,
                            lastEditedAt: new Date(),
                            referenceUrl: p.referenceUrl || null
                        }))
                    });
                }
            }

            // 3. Sync Competitors if provided
            if (competitors) {
                // Delete existing
                await tx.competitor.deleteMany({
                    where: { configId: config.id }
                });

                // Create new
                if (competitors.length > 0) {
                    await tx.competitor.createMany({
                        data: competitors.map((c: any) => ({
                            configId: config.id,
                            name: c.name,
                            website: c.website || null,
                            enabled: c.enabled ?? true
                        }))
                    });
                }
            }

            return config;
        });

        return NextResponse.json({
            success: true,
            config: updatedConfig
        });

    } catch (error) {
        console.error('Error updating visibility config:', error);
        return NextResponse.json(
            { error: 'Failed to update visibility configuration' },
            { status: 500 }
        );
    }
}

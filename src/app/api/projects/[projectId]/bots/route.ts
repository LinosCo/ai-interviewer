import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
        const currentUserId = session.user.id;

        const { projectId } = await params;
        const { searchParams } = new URL(req.url);
        const botType = searchParams.get('type'); // 'chatbot' or 'interview'
        const includeAll = searchParams.get('includeAll') === 'true';

        // Check user has access to this project
        const access = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: currentUserId,
                    projectId
                }
            }
        });

        // Check if user is the project owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true, organizationId: true }
        });
        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        // Admin can access all
        const user = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { role: true }
        });

        const isOwner = project.ownerId === currentUserId;
        const isAdmin = user?.role === 'ADMIN';

        if (!access && !isOwner && !isAdmin) {
            return new Response('Access denied', { status: 403 });
        }

        // If includeAll, return both linked and available tools (bots + trackers)
        if (includeAll) {
            const projectOrganizationId = project.organizationId;

            // 1. Fetch Bots
            const linkedBots = await prisma.bot.findMany({
                where: { projectId },
                include: { project: { select: { name: true, organization: { select: { name: true } } } } },
                orderBy: { updatedAt: 'desc' }
            });

            // 2. Fetch Trackers (VisibilityConfigs)
            let linkedTrackers: any[] = [];
            try {
                linkedTrackers = await prisma.visibilityConfig.findMany({
                    where: {
                        organizationId: projectOrganizationId || undefined,
                        OR: [
                            { projectId },
                            { projectShares: { some: { projectId } } }
                        ]
                    },
                    include: {
                        project: { select: { name: true, organization: { select: { name: true } } } },
                        projectShares: { select: { projectId: true } }
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            } catch (error: any) {
                if (error?.code !== 'P2021') throw error;
                linkedTrackers = await prisma.visibilityConfig.findMany({
                    where: {
                        organizationId: projectOrganizationId || undefined,
                        projectId
                    },
                    include: {
                        project: { select: { name: true, organization: { select: { name: true } } } }
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            }

            // Keep tool association scope consistent with current project organization.
            // This avoids cross-organization leakage in the project tools manager.
            const allAccessibleProjects = await prisma.project.findMany({
                where: {
                    organizationId: projectOrganizationId || undefined
                },
                select: { id: true }
            });
            const allProjectIds = allAccessibleProjects.map(p => p.id);

            const availableBots = await prisma.bot.findMany({
                where: {
                    projectId: { in: allProjectIds, not: projectId }
                },
                include: { project: { select: { name: true, organization: { select: { name: true } } } } },
                orderBy: { updatedAt: 'desc' }
            });

            let availableTrackers: any[] = [];
            try {
                availableTrackers = await prisma.visibilityConfig.findMany({
                    where: {
                        organizationId: projectOrganizationId || undefined,
                        NOT: {
                            OR: [
                                { projectId },
                                { projectShares: { some: { projectId } } }
                            ]
                        },
                        OR: [
                            { projectId: { in: allProjectIds, not: projectId } },
                            { projectShares: { some: { projectId: { in: allProjectIds, not: projectId } } } }
                        ]
                    },
                    include: {
                        project: { select: { name: true, organization: { select: { name: true } } } },
                        projectShares: { select: { projectId: true } }
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            } catch (error: any) {
                if (error?.code !== 'P2021') throw error;
                availableTrackers = await prisma.visibilityConfig.findMany({
                    where: {
                        organizationId: projectOrganizationId || undefined,
                        projectId: { in: allProjectIds, not: projectId }
                    },
                    include: {
                        project: { select: { name: true, organization: { select: { name: true } } } }
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            }

            // Find the owner's personal project ID
            const personalProject = await prisma.project.findFirst({
                where: { ownerId: currentUserId, isPersonal: true },
                select: { id: true }
            });

            const mapBot = (b: any) => ({
                id: b.id,
                name: b.name,
                type: 'bot',
                botType: b.botType,
                projectId: b.projectId,
                projectName: b.project?.name || null,
                orgName: b.project?.organization?.name || null
            });

            const mapTracker = (t: any) => ({
                id: t.id,
                name: t.brandName,
                type: 'tracker',
                botType: 'tracker',
                projectId: t.projectId || t.projectShares?.[0]?.projectId || null,
                projectName: t.project?.name || null,
                orgName: t.project?.organization?.name || null
            });

            return NextResponse.json({
                personalProjectId: personalProject?.id || null,
                linkedTools: [
                    ...linkedBots.map(mapBot),
                    ...linkedTrackers.map(mapTracker)
                ],
                availableTools: [
                    ...availableBots.map(mapBot),
                    ...availableTrackers.map(mapTracker)
                ]
            });
        }

        const bots = await prisma.bot.findMany({
            where: {
                projectId,
                ...(botType && { botType })
            },
            include: {
                conversations: {
                    select: {
                        id: true,
                        status: true,
                        completedAt: true,
                        candidateProfile: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json(bots);

    } catch (error) {
        console.error('Get Project Bots Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
        const currentUserId = session.user.id;

        const { projectId } = await params;
        const body = await req.json();
        const { botId, targetProjectId } = body;

        if (!botId || !targetProjectId) {
            return NextResponse.json(
                { error: 'botId e targetProjectId sono richiesti' },
                { status: 400 }
            );
        }

        // Verify user has OWNER access to the current project
        const currentAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: currentUserId,
                    projectId
                }
            }
        });

        // Also check if user is the project owner via ownerId
        const currentProject = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        const isOwner = currentProject?.ownerId === currentUserId;
        const hasOwnerAccess = currentAccess?.role === 'OWNER';

        if (!isOwner && !hasOwnerAccess) {
            return NextResponse.json(
                { error: 'Solo il proprietario può gestire i tool del progetto' },
                { status: 403 }
            );
        }

        // Verify user has access to target project
        const targetAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: currentUserId,
                    projectId: targetProjectId
                }
            }
        });

        // Also check if user is the owner of target project
        const targetProject = await prisma.project.findUnique({
            where: { id: targetProjectId },
            select: { ownerId: true, organizationId: true }
        });

        if (!targetProject) {
            return NextResponse.json(
                { error: 'Progetto di destinazione non trovato' },
                { status: 404 }
            );
        }

        const isTargetOwner = targetProject.ownerId === currentUserId;

        if (!targetAccess && !isTargetOwner) {
            return NextResponse.json(
                { error: 'Non hai accesso al progetto di destinazione' },
                { status: 403 }
            );
        }

        // Detect tool type and verify existence
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { select: { id: true, ownerId: true } } }
        });

        let tracker = null;
        if (!bot) {
            tracker = await prisma.visibilityConfig.findUnique({
                where: { id: botId },
                include: { project: { select: { id: true, ownerId: true } } }
            });
        }

        if (!bot && !tracker) {
            return NextResponse.json(
                { error: 'Tool non trovato' },
                { status: 404 }
            );
        }

        const tool = bot || tracker;
        const toolCurrentProjectId = bot ? bot.projectId : tracker!.projectId;

        if (!toolCurrentProjectId) {
            return NextResponse.json(
                { error: 'Progetto del tool non trovato' },
                { status: 404 }
            );
        }

        // Verify user has access to the tool's current project
        const botProjectAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: currentUserId,
                    projectId: toolCurrentProjectId
                }
            }
        });

        // Also check if user is owner of tool's current project
        const isToolProjectOwner = tool?.project?.ownerId === currentUserId;

        if (!botProjectAccess && !isToolProjectOwner) {
            return NextResponse.json(
                { error: 'Non hai accesso a questo tool' },
                { status: 403 }
            );
        }

        // Transfer the tool
        if (bot) {
            await prisma.bot.update({
                where: { id: botId },
                data: { projectId: targetProjectId }
            });
        } else {
            // For visibility configs, we update organizationId and projectId
            await prisma.visibilityConfig.update({
                where: { id: botId },
                data: {
                    projectId: targetProjectId,
                    ...(targetProject.organizationId && { organizationId: targetProject.organizationId })
                }
            });

            // Handle ProjectVisibilityConfig associations (OUTSIDE transaction to avoid poisoning)
            // 1. Check if table exists
            const tableCheck = await prisma.$queryRaw<{ exists: boolean }[]>`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ProjectVisibilityConfig')
            `;
            const projectVisibilityConfigExists = tableCheck[0]?.exists || false;

            if (projectVisibilityConfigExists) {
                try {
                    // 2. Upsert target association
                    await prisma.projectVisibilityConfig.upsert({
                        where: {
                            projectId_configId: {
                                projectId: targetProjectId,
                                configId: botId
                            }
                        },
                        update: {},
                        create: {
                            projectId: targetProjectId,
                            configId: botId,
                            createdBy: currentUserId
                        }
                    });

                    // 3. Delete source association
                    await prisma.projectVisibilityConfig.deleteMany({
                        where: {
                            projectId,
                            configId: botId
                        }
                    });
                } catch (error: any) {
                    console.warn('Error during projectVisibilityConfig operations in bots transfer:', error?.code, error?.message);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Tool trasferito con successo'
        });

    } catch (error) {
        console.error('Transfer Bot Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

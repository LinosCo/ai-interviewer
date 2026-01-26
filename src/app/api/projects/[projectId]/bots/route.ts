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

        const { projectId } = await params;
        const { searchParams } = new URL(req.url);
        const botType = searchParams.get('type'); // 'chatbot' or 'interview'
        const includeAll = searchParams.get('includeAll') === 'true';

        // Check user has access to this project
        const access = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        });

        // Check if user is the project owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true, organizationId: true }
        });

        // Admin can access all
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        const isOwner = project?.ownerId === session.user.id;
        const isAdmin = user?.role === 'ADMIN';

        if (!access && !isOwner && !isAdmin) {
            return new Response('Access denied', { status: 403 });
        }

        // If includeAll, return both linked and available bots for the tools manager
        if (includeAll) {
            // Bots linked to this project
            const linkedBots = await prisma.bot.findMany({
                where: {
                    projectId,
                    ...(botType && { botType })
                },
                include: {
                    project: { select: { name: true } }
                },
                orderBy: { updatedAt: 'desc' }
            });

            // Get projects the user has access to via ProjectAccess
            const userProjects = await prisma.projectAccess.findMany({
                where: { userId: session.user.id },
                select: { projectId: true }
            });

            // Also get projects the user owns directly
            const ownedProjects = await prisma.project.findMany({
                where: { ownerId: session.user.id },
                select: { id: true }
            });

            // Combine and deduplicate project IDs
            const allProjectIds = [...new Set([
                ...userProjects.map(p => p.projectId),
                ...ownedProjects.map(p => p.id)
            ])];

            // Get bots from all accessible projects (except current one)
            const availableBots = await prisma.bot.findMany({
                where: {
                    projectId: {
                        in: allProjectIds,
                        not: projectId
                    },
                    ...(botType && { botType })
                },
                include: {
                    project: { select: { name: true } }
                },
                orderBy: { updatedAt: 'desc' }
            });

            // Find the owner's personal project ID
            const personalProject = await prisma.project.findFirst({
                where: {
                    ownerId: session.user.id,
                    isPersonal: true
                },
                select: { id: true }
            });

            return NextResponse.json({
                personalProjectId: personalProject?.id || null,
                linkedBots: linkedBots.map(b => ({
                    id: b.id,
                    name: b.name,
                    botType: b.botType,
                    projectId: b.projectId,
                    projectName: b.project?.name || null
                })),
                availableBots: availableBots.map(b => ({
                    id: b.id,
                    name: b.name,
                    botType: b.botType,
                    projectId: b.projectId,
                    projectName: b.project?.name || null
                }))
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
                    userId: session.user.id,
                    projectId
                }
            }
        });

        if (!currentAccess || currentAccess.role !== 'OWNER') {
            return NextResponse.json(
                { error: 'Solo il proprietario può gestire i tool del progetto' },
                { status: 403 }
            );
        }

        // Verify user has access to target project
        const targetAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: targetProjectId
                }
            }
        });

        if (!targetAccess) {
            return NextResponse.json(
                { error: 'Non hai accesso al progetto di destinazione' },
                { status: 403 }
            );
        }

        // Verify bot exists and user has access to it
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { select: { id: true } } }
        });

        if (!bot) {
            return NextResponse.json(
                { error: 'Bot non trovato' },
                { status: 404 }
            );
        }

        // Verify user has access to the bot's current project
        const botProjectAccess = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: bot.projectId
                }
            }
        });

        if (!botProjectAccess) {
            return NextResponse.json(
                { error: 'Non hai accesso a questo bot' },
                { status: 403 }
            );
        }

        // Transfer the bot
        await prisma.bot.update({
            where: { id: botId },
            data: { projectId: targetProjectId }
        });

        return NextResponse.json({
            success: true,
            message: 'Bot trasferito con successo'
        });

    } catch (error) {
        console.error('Transfer Bot Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

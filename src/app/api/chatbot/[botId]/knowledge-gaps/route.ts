import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

/** Resolve bot → projectId and assert the requesting user has at least VIEWER access. */
async function resolveBotAndAssertAccess(botId: string, userId: string) {
    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { id: true, projectId: true }
    });
    if (!bot) return null;
    await assertProjectAccess(userId, bot.projectId, 'VIEWER');
    return bot;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    const { botId } = await params;
    const session = await auth();

    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const bot = await resolveBotAndAssertAccess(botId, session.user.id);
        if (!bot) return new NextResponse("Not Found", { status: 404 });
    } catch (error) {
        if (error instanceof WorkspaceError) {
            return new NextResponse(error.message, { status: error.status });
        }
        return new NextResponse("Forbidden", { status: 403 });
    }

    const gaps = await prisma.knowledgeGap.findMany({
        where: {
            botId,
            status: { not: 'dismissed' }
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ gaps });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    const { botId } = await params;
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const bot = await resolveBotAndAssertAccess(botId, session.user.id);
        if (!bot) return new NextResponse("Not Found", { status: 404 });
    } catch (error) {
        if (error instanceof WorkspaceError) {
            return new NextResponse(error.message, { status: error.status });
        }
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const body = await req.json();
        const { topic, priority } = body;

        const gap = await prisma.knowledgeGap.create({
            data: {
                botId,
                topic,
                priority: priority || 'medium',
                evidence: { manual: true },
                status: 'pending'
            }
        });

        return NextResponse.json(gap);
    } catch (e) {
        return new NextResponse("Error creating gap", { status: 500 });
    }
}

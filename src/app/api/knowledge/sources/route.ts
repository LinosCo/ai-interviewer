import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { assertProjectAccess } from '@/lib/domain/workspace';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { searchParams } = new URL(req.url);
        const botId = searchParams.get('botId');

        if (!botId) return new Response('Missing botId', { status: 400 });

        const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { projectId: true } });
        if (!bot) return new Response('Not found', { status: 404 });
        await assertProjectAccess(session.user.id, bot.projectId, 'VIEWER');

        const sources = await prisma.knowledgeSource.findMany({
            where: { botId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                type: true,
                createdAt: true
            }
        });

        return NextResponse.json(sources);
    } catch (error) {
        return new Response('Error', { status: 500 });
    }
}

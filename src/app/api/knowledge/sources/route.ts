import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

        const { searchParams } = new URL(req.url);
        const botId = searchParams.get('botId');

        if (!botId) return new Response('Missing botId', { status: 400 });

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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveDemoInterviewBotId(): Promise<string | null> {
    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: { publicDemoBotId: true }
    });

    if (globalConfig?.publicDemoBotId) {
        const explicitBot = await prisma.bot.findUnique({
            where: { id: globalConfig.publicDemoBotId },
            select: { id: true, botType: true, status: true }
        });
        if (explicitBot && explicitBot.botType === 'interview') {
            return explicitBot.id;
        }
    }

    const fallbackBot = await prisma.bot.findFirst({
        where: {
            botType: 'interview',
            status: 'PUBLISHED'
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
    });

    if (fallbackBot?.id) return fallbackBot.id;

    const fallbackAnyInterviewBot = await prisma.bot.findFirst({
        where: { botType: 'interview' },
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
    });

    return fallbackAnyInterviewBot?.id || null;
}

export async function GET() {
    try {
        const botId = await resolveDemoInterviewBotId();
        if (!botId) {
            return NextResponse.json(
                { useDefault: true },
                { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
            );
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                topics: {
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!bot) {
            return NextResponse.json(
                { useDefault: true },
                { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
            );
        }

        return NextResponse.json(
            {
                useDefault: false,
                botId: bot.id,
                config: {
                    name: bot.name,
                    researchGoal: bot.researchGoal || "",
                    targetAudience: bot.targetAudience || "",
                    language: bot.language || "it",
                    tone: bot.tone || "Professional",
                    topics: bot.topics.map(t => ({
                        id: t.id,
                        label: t.label,
                        description: t.description || "",
                        subGoals: Array.isArray(t.subGoals) ? t.subGoals : [],
                        maxTurns: t.maxTurns || 5
                    }))
                }
            },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
        );
    } catch (error) {
        console.error('Error fetching public demo config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST() {
    try {
        const botId = await resolveDemoInterviewBotId();
        if (!botId) {
            return NextResponse.json(
                { error: 'Demo bot not configured' },
                {
                    status: 400,
                    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
                }
            );
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { topics: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        const firstTopic = bot.topics[0];
        const participantId = `demo-${crypto.randomUUID().slice(0, 8)}`;

        const conversation = await prisma.conversation.create({
            data: {
                botId: bot.id,
                participantId,
                status: 'STARTED',
                currentTopicId: firstTopic?.id || null,
            },
            include: {
                bot: {
                    include: {
                        topics: { orderBy: { orderIndex: 'asc' } },
                        rewardConfig: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        return NextResponse.json(conversation, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch (error) {
        console.error('Error starting demo conversation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

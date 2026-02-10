import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { publicDemoBotId: true }
        });

        if (!globalConfig?.publicDemoBotId) {
            return NextResponse.json({ useDefault: true });
        }

        const bot = await prisma.bot.findUnique({
            where: { id: globalConfig.publicDemoBotId },
            include: {
                topics: {
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!bot) {
            return NextResponse.json({ useDefault: true });
        }

        return NextResponse.json({
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
        });
    } catch (error) {
        console.error('Error fetching public demo config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST() {
    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { publicDemoBotId: true }
        });

        if (!globalConfig?.publicDemoBotId) {
            return NextResponse.json({ error: 'Demo bot not configured' }, { status: 400 });
        }

        const bot = await prisma.bot.findUnique({
            where: { id: globalConfig.publicDemoBotId },
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

        return NextResponse.json(conversation);
    } catch (error) {
        console.error('Error starting demo conversation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

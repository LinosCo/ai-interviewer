import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { botId } = await params;
        const data = await req.json();

        // Verify ownership/access to bot
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: true }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        try {
            await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
            }
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const rewardConfig = await prisma.rewardConfig.upsert({
            where: { botId },
            update: {
                enabled: data.enabled,
                type: data.type,
                payload: data.payload,
                displayText: data.displayText,
                showOnLanding: data.showOnLanding
            },
            create: {
                botId,
                enabled: data.enabled,
                type: data.type,
                payload: data.payload,
                displayText: data.displayText,
                showOnLanding: data.showOnLanding
            }
        });

        return NextResponse.json(rewardConfig);
    } catch (error) {
        console.error('Error updating reward config:', error);
        return NextResponse.json(
            { error: 'Failed to update reward configuration' },
            { status: 500 }
        );
    }
}

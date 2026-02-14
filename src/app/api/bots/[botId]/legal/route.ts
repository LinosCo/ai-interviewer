import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

export async function PATCH(
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
        const existingBot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: true }
        });

        if (!existingBot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        try {
            await assertProjectAccess(session.user.id, existingBot.projectId, 'MEMBER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
            }
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const bot = await prisma.bot.update({
            where: { id: botId },
            data: {
                privacyNotice: data.privacyNotice,
                dataUsageInfo: data.dataUsageInfo,
                consentText: data.consentText,
                showAnonymityInfo: data.showAnonymityInfo,
                showDataUsageInfo: data.showDataUsageInfo,
                anonymizationLevel: data.anonymizationLevel
            }
        });

        return NextResponse.json(bot);
    } catch (error) {
        console.error('Error updating legal settings:', error);
        return NextResponse.json(
            { error: 'Failed to update legal settings' },
            { status: 500 }
        );
    }
}

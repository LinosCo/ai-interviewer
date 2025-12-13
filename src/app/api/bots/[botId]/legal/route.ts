import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const { botId } = await params;
        const data = await req.json();

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

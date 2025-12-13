import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const { botId } = await params;
        const data = await req.json();

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

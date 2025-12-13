import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId, settingsId, methodologyKnowledge, platformOpenaiApiKey, platformAnthropicApiKey } = await req.json();

        // Verify user owns these settings
        const user = await prisma.user.findUnique({
            where: { id: userId, email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Update user's API keys
        await prisma.user.update({
            where: { id: userId },
            data: {
                platformOpenaiApiKey,
                platformAnthropicApiKey
            }
        });

        // Upsert platform settings
        const settings = await prisma.platformSettings.upsert({
            where: { userId },
            update: { methodologyKnowledge },
            create: {
                userId,
                methodologyKnowledge
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error saving platform settings:', error);
        return NextResponse.json(
            { error: 'Failed to save settings' },
            { status: 500 }
        );
    }
}

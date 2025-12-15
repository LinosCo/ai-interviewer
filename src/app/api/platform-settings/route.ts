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

        // Update user's methodology (PlatformSettings)
        const settings = await prisma.platformSettings.upsert({
            where: { userId },
            update: { methodologyKnowledge },
            create: {
                userId,
                methodologyKnowledge
            }
        });

        // If Admin, update Global Config API Keys
        if (user.role === 'ADMIN') {
            await prisma.globalConfig.upsert({
                where: { id: "default" },
                update: {
                    openaiApiKey: platformOpenaiApiKey || null,
                    anthropicApiKey: platformAnthropicApiKey || null,
                },
                create: {
                    id: "default",
                    openaiApiKey: platformOpenaiApiKey || null,
                    anthropicApiKey: platformAnthropicApiKey || null,
                }
            });
        }

        // Note: We are NO LONGER updating user.platformOpenaiApiKey to avoid confusion.
        // Personal keys are deprecated in favor of Bot-specific or Global keys.

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error saving platform settings:', error);
        return NextResponse.json(
            { error: 'Failed to save settings' },
            { status: 500 }
        );
    }
}

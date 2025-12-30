import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            userId,
            settingsId,
            methodologyKnowledge,
            platformOpenaiApiKey,
            platformAnthropicApiKey,
            // Stripe fields
            stripeSecretKey,
            stripeWebhookSecret,
            stripePriceStarter,
            stripePricePro
        } = await req.json();

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

        // If Admin, update Global Config API Keys and Stripe Config
        if (user.role === 'ADMIN') {
            const updateData: any = {};
            if (platformOpenaiApiKey) updateData.openaiApiKey = platformOpenaiApiKey;
            if (platformAnthropicApiKey) updateData.anthropicApiKey = platformAnthropicApiKey;
            if (stripeSecretKey) updateData.stripeSecretKey = stripeSecretKey;
            if (stripeWebhookSecret) updateData.stripeWebhookSecret = stripeWebhookSecret;
            if (stripePriceStarter) updateData.stripePriceStarter = stripePriceStarter;
            if (stripePricePro) updateData.stripePricePro = stripePricePro;

            await prisma.globalConfig.upsert({
                where: { id: "default" },
                update: updateData,
                create: {
                    id: "default",
                    openaiApiKey: platformOpenaiApiKey || null,
                    anthropicApiKey: platformAnthropicApiKey || null,
                    stripeSecretKey: stripeSecretKey || '',
                    stripeWebhookSecret: stripeWebhookSecret || '',
                    stripePriceStarter: stripePriceStarter || '',
                    stripePricePro: stripePricePro || ''
                }
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error saving platform settings:', error);
        return NextResponse.json(
            { error: 'Failed to save settings' },
            { status: 500 }
        );
    }
}

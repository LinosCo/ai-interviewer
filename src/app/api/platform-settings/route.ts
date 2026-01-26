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
            strategicPlan,
            platformOpenaiApiKey,
            platformAnthropicApiKey,
            platformGeminiApiKey,
            googleSerpApiKey,
            stripeSecretKey,
            stripeWebhookSecret,
            stripePriceStarter,
            stripePriceStarterYearly,
            stripePricePro,
            stripePriceProYearly
        } = await req.json();

        // Verify user owns these settings
        const user = await prisma.user.findUnique({
            where: { id: userId, email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Update user's methodology and strategic plan (PlatformSettings)
        const settings = await prisma.platformSettings.upsert({
            where: { userId },
            update: {
                methodologyKnowledge,
                strategicPlan: strategicPlan || null
            },
            create: {
                userId,
                methodologyKnowledge,
                strategicPlan: strategicPlan || null
            }
        });

        // If Admin, update Global Config API Keys and Stripe Config
        if (user.role === 'ADMIN') {
            const updateData: any = {};

            if (platformOpenaiApiKey !== undefined) updateData.openaiApiKey = platformOpenaiApiKey || null;
            if (platformAnthropicApiKey !== undefined) updateData.anthropicApiKey = platformAnthropicApiKey || null;
            if (platformGeminiApiKey !== undefined) updateData.geminiApiKey = platformGeminiApiKey || null;
            if (googleSerpApiKey !== undefined) updateData.googleSerpApiKey = googleSerpApiKey || null;
            if (stripeSecretKey !== undefined) updateData.stripeSecretKey = stripeSecretKey || null;
            if (stripeWebhookSecret !== undefined) updateData.stripeWebhookSecret = stripeWebhookSecret || null;
            if (stripePriceStarter !== undefined) updateData.stripePriceStarter = stripePriceStarter || null;
            if (stripePriceStarterYearly !== undefined) updateData.stripePriceStarterYearly = stripePriceStarterYearly || null;
            if (stripePricePro !== undefined) updateData.stripePricePro = stripePricePro || null;
            if (stripePriceProYearly !== undefined) updateData.stripePriceProYearly = stripePriceProYearly || null;

            await prisma.globalConfig.upsert({
                where: { id: "default" },
                update: updateData,
                create: {
                    id: "default",
                    ...updateData
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

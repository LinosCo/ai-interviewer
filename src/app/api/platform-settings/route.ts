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
            openaiApiKey,
            anthropicApiKey,
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
            const updateData: any = {
                openaiApiKey: openaiApiKey || null,
                anthropicApiKey: anthropicApiKey || null,
                stripeSecretKey: stripeSecretKey || null,
                stripeWebhookSecret: stripeWebhookSecret || null,
                stripePriceStarter: stripePriceStarter || null,
                stripePriceStarterYearly: stripePriceStarterYearly || null,
                stripePricePro: stripePricePro || null,
                stripePriceProYearly: stripePriceProYearly || null,
            };

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

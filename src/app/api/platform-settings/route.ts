import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            organizationId,
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
            stripePriceProYearly,
            stripePriceBusiness,
            stripePriceBusinessYearly,
            stripePricePackSmall,
            stripePricePackMedium,
            stripePricePackLarge,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            smtpFromEmail,
            smtpNotificationEmail
        } = body;

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
        }

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId
                }
            }
        });

        if (!membership && currentUser?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Update organization's methodology and strategic plan
        const settings = await prisma.platformSettings.upsert({
            where: { organizationId },
            update: {
                methodologyKnowledge,
                strategicPlan: strategicPlan || null
            },
            create: {
                organizationId,
                methodologyKnowledge,
                strategicPlan: strategicPlan || null
            }
        });

        // Link organization to these settings if not already
        await prisma.organization.update({
            where: { id: organizationId },
            data: { platformSettingsId: settings.id }
        });

        // If Admin, update Global Config API Keys and Stripe Config
        if (currentUser?.role === 'ADMIN') {
            const updateData: Prisma.GlobalConfigUpdateInput = {};

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
            if (stripePriceBusiness !== undefined) updateData.stripePriceBusiness = stripePriceBusiness || null;
            if (stripePriceBusinessYearly !== undefined) updateData.stripePriceBusinessYearly = stripePriceBusinessYearly || null;
            if (stripePricePackSmall !== undefined) updateData.stripePricePackSmall = stripePricePackSmall || null;
            if (stripePricePackMedium !== undefined) updateData.stripePricePackMedium = stripePricePackMedium || null;
            if (stripePricePackLarge !== undefined) updateData.stripePricePackLarge = stripePricePackLarge || null;
            if (smtpHost !== undefined) updateData.smtpHost = smtpHost || null;
            if (smtpPort !== undefined) updateData.smtpPort = smtpPort ? Number(smtpPort) : null;
            if (smtpSecure !== undefined) updateData.smtpSecure = Boolean(smtpSecure);
            if (smtpUser !== undefined) updateData.smtpUser = smtpUser || null;
            if (smtpPass !== undefined) updateData.smtpPass = smtpPass || null;
            if (smtpFromEmail !== undefined) updateData.smtpFromEmail = smtpFromEmail || null;
            if (smtpNotificationEmail !== undefined) updateData.smtpNotificationEmail = smtpNotificationEmail || null;

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

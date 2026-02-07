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
            const createData: Prisma.GlobalConfigCreateInput = {
                id: 'default'
            };

            if (platformOpenaiApiKey !== undefined) {
                const value = platformOpenaiApiKey || null;
                updateData.openaiApiKey = value;
                createData.openaiApiKey = value;
            }
            if (platformAnthropicApiKey !== undefined) {
                const value = platformAnthropicApiKey || null;
                updateData.anthropicApiKey = value;
                createData.anthropicApiKey = value;
            }
            if (platformGeminiApiKey !== undefined) {
                const value = platformGeminiApiKey || null;
                updateData.geminiApiKey = value;
                createData.geminiApiKey = value;
            }
            if (googleSerpApiKey !== undefined) {
                const value = googleSerpApiKey || null;
                updateData.googleSerpApiKey = value;
                createData.googleSerpApiKey = value;
            }
            if (stripeSecretKey !== undefined) {
                const value = stripeSecretKey || null;
                updateData.stripeSecretKey = value;
                createData.stripeSecretKey = value;
            }
            if (stripeWebhookSecret !== undefined) {
                const value = stripeWebhookSecret || null;
                updateData.stripeWebhookSecret = value;
                createData.stripeWebhookSecret = value;
            }
            if (stripePriceStarter !== undefined) {
                const value = stripePriceStarter || null;
                updateData.stripePriceStarter = value;
                createData.stripePriceStarter = value;
            }
            if (stripePriceStarterYearly !== undefined) {
                const value = stripePriceStarterYearly || null;
                updateData.stripePriceStarterYearly = value;
                createData.stripePriceStarterYearly = value;
            }
            if (stripePricePro !== undefined) {
                const value = stripePricePro || null;
                updateData.stripePricePro = value;
                createData.stripePricePro = value;
            }
            if (stripePriceProYearly !== undefined) {
                const value = stripePriceProYearly || null;
                updateData.stripePriceProYearly = value;
                createData.stripePriceProYearly = value;
            }
            if (stripePriceBusiness !== undefined) {
                const value = stripePriceBusiness || null;
                updateData.stripePriceBusiness = value;
                createData.stripePriceBusiness = value;
            }
            if (stripePriceBusinessYearly !== undefined) {
                const value = stripePriceBusinessYearly || null;
                updateData.stripePriceBusinessYearly = value;
                createData.stripePriceBusinessYearly = value;
            }
            if (stripePricePackSmall !== undefined) {
                const value = stripePricePackSmall || null;
                updateData.stripePricePackSmall = value;
                createData.stripePricePackSmall = value;
            }
            if (stripePricePackMedium !== undefined) {
                const value = stripePricePackMedium || null;
                updateData.stripePricePackMedium = value;
                createData.stripePricePackMedium = value;
            }
            if (stripePricePackLarge !== undefined) {
                const value = stripePricePackLarge || null;
                updateData.stripePricePackLarge = value;
                createData.stripePricePackLarge = value;
            }
            if (smtpHost !== undefined) {
                const value = smtpHost || null;
                updateData.smtpHost = value;
                createData.smtpHost = value;
            }
            if (smtpPort !== undefined) {
                const value = smtpPort ? Number(smtpPort) : null;
                updateData.smtpPort = value;
                createData.smtpPort = value;
            }
            if (smtpSecure !== undefined) {
                const value = Boolean(smtpSecure);
                updateData.smtpSecure = value;
                createData.smtpSecure = value;
            }
            if (smtpUser !== undefined) {
                const value = smtpUser || null;
                updateData.smtpUser = value;
                createData.smtpUser = value;
            }
            if (smtpPass !== undefined) {
                const value = smtpPass || null;
                updateData.smtpPass = value;
                createData.smtpPass = value;
            }
            if (smtpFromEmail !== undefined) {
                const value = smtpFromEmail || null;
                updateData.smtpFromEmail = value;
                createData.smtpFromEmail = value;
            }
            if (smtpNotificationEmail !== undefined) {
                const value = smtpNotificationEmail || null;
                updateData.smtpNotificationEmail = value;
                createData.smtpNotificationEmail = value;
            }

            await prisma.globalConfig.upsert({
                where: { id: 'default' },
                update: updateData,
                create: createData
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

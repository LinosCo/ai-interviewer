import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

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
            stripePricePartner,
            stripePricePartnerYearly,
            stripePriceEnterprise,
            stripePriceEnterpriseYearly,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            smtpFromEmail,
            smtpNotificationEmail,
            publicDemoBotId
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
        const canManageGlobalConfig = currentUser?.role === 'ADMIN';

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

        const hasGlobalConfigPayload = [
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
            stripePricePartner,
            stripePricePartnerYearly,
            stripePriceEnterprise,
            stripePriceEnterpriseYearly,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            smtpFromEmail,
            smtpNotificationEmail,
            publicDemoBotId
        ].some((value) => value !== undefined);

        if (hasGlobalConfigPayload && !canManageGlobalConfig) {
            return NextResponse.json(
                { error: 'Access denied for global configuration' },
                { status: 403 }
            );
        }

        // If allowed, update Global Config API Keys and Stripe Config
        if (canManageGlobalConfig) {
            const globalConfigUpdate: any = {};
            if (platformOpenaiApiKey !== undefined) globalConfigUpdate.openaiApiKey = platformOpenaiApiKey || null;
            if (platformAnthropicApiKey !== undefined) globalConfigUpdate.anthropicApiKey = platformAnthropicApiKey || null;
            if (platformGeminiApiKey !== undefined) globalConfigUpdate.geminiApiKey = platformGeminiApiKey || null;
            if (googleSerpApiKey !== undefined) globalConfigUpdate.googleSerpApiKey = googleSerpApiKey || null;
            if (stripeSecretKey !== undefined) globalConfigUpdate.stripeSecretKey = stripeSecretKey || null;
            if (stripeWebhookSecret !== undefined) globalConfigUpdate.stripeWebhookSecret = stripeWebhookSecret || null;
            if (stripePriceStarter !== undefined) globalConfigUpdate.stripePriceStarter = stripePriceStarter || null;
            if (stripePriceStarterYearly !== undefined) globalConfigUpdate.stripePriceStarterYearly = stripePriceStarterYearly || null;
            if (stripePricePro !== undefined) globalConfigUpdate.stripePricePro = stripePricePro || null;
            if (stripePriceProYearly !== undefined) globalConfigUpdate.stripePriceProYearly = stripePriceProYearly || null;
            if (stripePriceBusiness !== undefined) globalConfigUpdate.stripePriceBusiness = stripePriceBusiness || null;
            if (stripePriceBusinessYearly !== undefined) globalConfigUpdate.stripePriceBusinessYearly = stripePriceBusinessYearly || null;
            if (stripePricePackSmall !== undefined) globalConfigUpdate.stripePricePackSmall = stripePricePackSmall || null;
            if (stripePricePackMedium !== undefined) globalConfigUpdate.stripePricePackMedium = stripePricePackMedium || null;
            if (stripePricePackLarge !== undefined) globalConfigUpdate.stripePricePackLarge = stripePricePackLarge || null;
            if (stripePricePartner !== undefined) globalConfigUpdate.stripePricePartner = stripePricePartner || null;
            if (stripePricePartnerYearly !== undefined) globalConfigUpdate.stripePricePartnerYearly = stripePricePartnerYearly || null;
            if (stripePriceEnterprise !== undefined) globalConfigUpdate.stripePriceEnterprise = stripePriceEnterprise || null;
            if (stripePriceEnterpriseYearly !== undefined) globalConfigUpdate.stripePriceEnterpriseYearly = stripePriceEnterpriseYearly || null;
            if (smtpHost !== undefined) globalConfigUpdate.smtpHost = smtpHost || null;
            if (smtpPort !== undefined) globalConfigUpdate.smtpPort = smtpPort ? Number(smtpPort) : null;
            if (smtpSecure !== undefined) globalConfigUpdate.smtpSecure = Boolean(smtpSecure);
            if (smtpUser !== undefined) globalConfigUpdate.smtpUser = smtpUser || null;
            if (smtpPass !== undefined) globalConfigUpdate.smtpPass = smtpPass || null;
            if (smtpFromEmail !== undefined) globalConfigUpdate.smtpFromEmail = smtpFromEmail || null;
            if (smtpNotificationEmail !== undefined) globalConfigUpdate.smtpNotificationEmail = smtpNotificationEmail || null;
            if (publicDemoBotId !== undefined) globalConfigUpdate.publicDemoBotId = publicDemoBotId || null;

            if (Object.keys(globalConfigUpdate).length > 0) {
                await prisma.globalConfig.upsert({
                    where: { id: 'default' },
                    update: globalConfigUpdate,
                    create: { id: 'default', ...globalConfigUpdate }
                });
            }
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
            // Self-healing schema check
            try {
                const requiredColumns = [
                    { name: 'stripePricePartner', type: 'TEXT' },
                    { name: 'stripePricePartnerYearly', type: 'TEXT' },
                    { name: 'stripePriceEnterprise', type: 'TEXT' },
                    { name: 'stripePriceEnterpriseYearly', type: 'TEXT' },
                    { name: 'stripePriceBusinessYearly', type: 'TEXT' },
                    { name: 'smtpHost', type: 'TEXT' },
                    { name: 'smtpPort', type: 'INTEGER' },
                    { name: 'smtpSecure', type: 'BOOLEAN' },
                    { name: 'smtpUser', type: 'TEXT' },
                    { name: 'smtpPass', type: 'TEXT' },
                    { name: 'smtpFromEmail', type: 'TEXT' },
                    { name: 'smtpNotificationEmail', type: 'TEXT' },
                    { name: 'publicDemoBotId', type: 'TEXT' }
                ];

                const existingColumns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND LOWER(table_name) = LOWER('GlobalConfig')
                `);

                const existingSet = new Set(existingColumns.map(c => c.column_name));
                const missing = requiredColumns.filter(c => !existingSet.has(c.name));

                if (missing.length > 0) {
                    console.log('[platform-settings] Found missing columns, attempting to patch schema:', missing.map(c => c.name));
                    for (const col of missing) {
                        try {
                            await prisma.$executeRawUnsafe(`ALTER TABLE "GlobalConfig" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
                            console.log(`[platform-settings] Added column: ${col.name}`);
                        } catch (alterError) {
                            console.error(`[platform-settings] Failed to add column ${col.name}:`, alterError);
                        }
                    }
                }
            } catch (schemaCheckError) {
                console.error('[platform-settings] Schema check failed:', schemaCheckError);
                // Continue execution, maybe it works anyway
            }

            const globalConfigUpdate: Prisma.GlobalConfigUpdateInput = {};

            if (platformOpenaiApiKey !== undefined) globalConfigUpdate.openaiApiKey = platformOpenaiApiKey;
            if (platformAnthropicApiKey !== undefined) globalConfigUpdate.anthropicApiKey = platformAnthropicApiKey;
            if (platformGeminiApiKey !== undefined) globalConfigUpdate.geminiApiKey = platformGeminiApiKey;
            if (googleSerpApiKey !== undefined) globalConfigUpdate.googleSerpApiKey = googleSerpApiKey;

            if (stripeSecretKey !== undefined) globalConfigUpdate.stripeSecretKey = stripeSecretKey;
            if (stripeWebhookSecret !== undefined) globalConfigUpdate.stripeWebhookSecret = stripeWebhookSecret;

            if (stripePriceStarter !== undefined) globalConfigUpdate.stripePriceStarter = stripePriceStarter;
            if (stripePriceStarterYearly !== undefined) globalConfigUpdate.stripePriceStarterYearly = stripePriceStarterYearly;
            if (stripePricePro !== undefined) globalConfigUpdate.stripePricePro = stripePricePro;
            if (stripePriceProYearly !== undefined) globalConfigUpdate.stripePriceProYearly = stripePriceProYearly;
            if (stripePriceBusiness !== undefined) globalConfigUpdate.stripePriceBusiness = stripePriceBusiness;
            if (stripePriceBusinessYearly !== undefined) globalConfigUpdate.stripePriceBusinessYearly = stripePriceBusinessYearly;
            if (stripePricePackSmall !== undefined) globalConfigUpdate.stripePricePackSmall = stripePricePackSmall;
            if (stripePricePackMedium !== undefined) globalConfigUpdate.stripePricePackMedium = stripePricePackMedium;
            if (stripePricePackLarge !== undefined) globalConfigUpdate.stripePricePackLarge = stripePricePackLarge;
            if (stripePricePartner !== undefined) globalConfigUpdate.stripePricePartner = stripePricePartner;
            if (stripePricePartnerYearly !== undefined) globalConfigUpdate.stripePricePartnerYearly = stripePricePartnerYearly;
            if (stripePriceEnterprise !== undefined) globalConfigUpdate.stripePriceEnterprise = stripePriceEnterprise;
            if (stripePriceEnterpriseYearly !== undefined) globalConfigUpdate.stripePriceEnterpriseYearly = stripePriceEnterpriseYearly;

            if (smtpHost !== undefined) globalConfigUpdate.smtpHost = smtpHost;
            if (smtpPort !== undefined) globalConfigUpdate.smtpPort = smtpPort ? Number(smtpPort) : null;
            if (smtpSecure !== undefined) globalConfigUpdate.smtpSecure = Boolean(smtpSecure);
            if (smtpUser !== undefined) globalConfigUpdate.smtpUser = smtpUser;
            if (smtpPass !== undefined) globalConfigUpdate.smtpPass = smtpPass;
            if (smtpFromEmail !== undefined) globalConfigUpdate.smtpFromEmail = smtpFromEmail;
            if (smtpNotificationEmail !== undefined) globalConfigUpdate.smtpNotificationEmail = smtpNotificationEmail;

            if (publicDemoBotId !== undefined) globalConfigUpdate.publicDemoBotId = publicDemoBotId;

            // Only perform update if there are fields to update
            if (Object.keys(globalConfigUpdate).length > 0) {
                console.log('Updating GlobalConfig with:', globalConfigUpdate);
                await prisma.globalConfig.upsert({
                    where: { id: 'default' },
                    update: globalConfigUpdate,
                    create: {
                        id: 'default',
                        ...globalConfigUpdate as Prisma.GlobalConfigCreateInput
                    }
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

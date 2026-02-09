import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

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
            const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'GlobalConfig'
            `).catch(() => []);
            const available = new Set(availableColumns.map((c) => c.column_name));

            const updateData: Prisma.GlobalConfigUpdateInput = {};
            const createData: Prisma.GlobalConfigCreateInput = {
                id: 'default'
            };
            const assignIfAvailable = (column: string, key: keyof Prisma.GlobalConfigUpdateInput, value: unknown) => {
                if (!available.has(column)) return;
                (updateData as any)[key] = value;
                (createData as any)[key] = value;
            };

            if (platformOpenaiApiKey !== undefined) {
                const value = platformOpenaiApiKey || null;
                assignIfAvailable('openaiApiKey', 'openaiApiKey', value);
            }
            if (platformAnthropicApiKey !== undefined) {
                const value = platformAnthropicApiKey || null;
                assignIfAvailable('anthropicApiKey', 'anthropicApiKey', value);
            }
            if (platformGeminiApiKey !== undefined) {
                const value = platformGeminiApiKey || null;
                assignIfAvailable('geminiApiKey', 'geminiApiKey', value);
            }
            if (googleSerpApiKey !== undefined) {
                const value = googleSerpApiKey || null;
                assignIfAvailable('googleSerpApiKey', 'googleSerpApiKey', value);
            }
            if (stripeSecretKey !== undefined) {
                const value = stripeSecretKey || null;
                assignIfAvailable('stripeSecretKey', 'stripeSecretKey', value);
            }
            if (stripeWebhookSecret !== undefined) {
                const value = stripeWebhookSecret || null;
                assignIfAvailable('stripeWebhookSecret', 'stripeWebhookSecret', value);
            }
            if (stripePriceStarter !== undefined) {
                const value = stripePriceStarter || null;
                assignIfAvailable('stripePriceStarter', 'stripePriceStarter', value);
            }
            if (stripePriceStarterYearly !== undefined) {
                const value = stripePriceStarterYearly || null;
                assignIfAvailable('stripePriceStarterYearly', 'stripePriceStarterYearly', value);
            }
            if (stripePricePro !== undefined) {
                const value = stripePricePro || null;
                assignIfAvailable('stripePricePro', 'stripePricePro', value);
            }
            if (stripePriceProYearly !== undefined) {
                const value = stripePriceProYearly || null;
                assignIfAvailable('stripePriceProYearly', 'stripePriceProYearly', value);
            }
            if (stripePriceBusiness !== undefined) {
                const value = stripePriceBusiness || null;
                assignIfAvailable('stripePriceBusiness', 'stripePriceBusiness', value);
            }
            if (stripePriceBusinessYearly !== undefined) {
                const value = stripePriceBusinessYearly || null;
                assignIfAvailable('stripePriceBusinessYearly', 'stripePriceBusinessYearly', value);
            }
            if (stripePricePackSmall !== undefined) {
                const value = stripePricePackSmall || null;
                assignIfAvailable('stripePricePackSmall', 'stripePricePackSmall', value);
            }
            if (stripePricePackMedium !== undefined) {
                const value = stripePricePackMedium || null;
                assignIfAvailable('stripePricePackMedium', 'stripePricePackMedium', value);
            }
            if (stripePricePackLarge !== undefined) {
                const value = stripePricePackLarge || null;
                assignIfAvailable('stripePricePackLarge', 'stripePricePackLarge', value);
            }
            if (smtpHost !== undefined) {
                const value = smtpHost || null;
                assignIfAvailable('smtpHost', 'smtpHost', value);
            }
            if (smtpPort !== undefined) {
                const value = smtpPort ? Number(smtpPort) : null;
                assignIfAvailable('smtpPort', 'smtpPort', value);
            }
            if (smtpSecure !== undefined) {
                const value = Boolean(smtpSecure);
                assignIfAvailable('smtpSecure', 'smtpSecure', value);
            }
            if (smtpUser !== undefined) {
                const value = smtpUser || null;
                assignIfAvailable('smtpUser', 'smtpUser', value);
            }
            if (smtpPass !== undefined) {
                const value = smtpPass || null;
                assignIfAvailable('smtpPass', 'smtpPass', value);
            }
            if (smtpFromEmail !== undefined) {
                const value = smtpFromEmail || null;
                assignIfAvailable('smtpFromEmail', 'smtpFromEmail', value);
            }
            if (smtpNotificationEmail !== undefined) {
                const value = smtpNotificationEmail || null;
                assignIfAvailable('smtpNotificationEmail', 'smtpNotificationEmail', value);
            }
            if (publicDemoBotId !== undefined) {
                const value = publicDemoBotId || null;
                assignIfAvailable('publicDemoBotId', 'publicDemoBotId', value);
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

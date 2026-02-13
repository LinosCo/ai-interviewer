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
            const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND LOWER(table_name) = LOWER('GlobalConfig')
            `).catch(() => []);
            const actualByLower = new Map(availableColumns.map((c) => [c.column_name.toLowerCase(), c.column_name]));

            const requested: Record<string, unknown> = {
                openaiApiKey: platformOpenaiApiKey !== undefined ? platformOpenaiApiKey || null : undefined,
                anthropicApiKey: platformAnthropicApiKey !== undefined ? platformAnthropicApiKey || null : undefined,
                geminiApiKey: platformGeminiApiKey !== undefined ? platformGeminiApiKey || null : undefined,
                googleSerpApiKey: googleSerpApiKey !== undefined ? googleSerpApiKey || null : undefined,
                stripeSecretKey: stripeSecretKey !== undefined ? stripeSecretKey || null : undefined,
                stripeWebhookSecret: stripeWebhookSecret !== undefined ? stripeWebhookSecret || null : undefined,
                stripePriceStarter: stripePriceStarter !== undefined ? stripePriceStarter || null : undefined,
                stripePriceStarterYearly: stripePriceStarterYearly !== undefined ? stripePriceStarterYearly || null : undefined,
                stripePricePro: stripePricePro !== undefined ? stripePricePro || null : undefined,
                stripePriceProYearly: stripePriceProYearly !== undefined ? stripePriceProYearly || null : undefined,
                stripePriceBusiness: stripePriceBusiness !== undefined ? stripePriceBusiness || null : undefined,
                stripePriceBusinessYearly: stripePriceBusinessYearly !== undefined ? stripePriceBusinessYearly || null : undefined,
                stripePricePackSmall: stripePricePackSmall !== undefined ? stripePricePackSmall || null : undefined,
                stripePricePackMedium: stripePricePackMedium !== undefined ? stripePricePackMedium || null : undefined,
                stripePricePackLarge: stripePricePackLarge !== undefined ? stripePricePackLarge || null : undefined,
                stripePricePartner: stripePricePartner !== undefined ? stripePricePartner || null : undefined,
                stripePricePartnerYearly: stripePricePartnerYearly !== undefined ? stripePricePartnerYearly || null : undefined,
                stripePriceEnterprise: stripePriceEnterprise !== undefined ? stripePriceEnterprise || null : undefined,
                stripePriceEnterpriseYearly: stripePriceEnterpriseYearly !== undefined ? stripePriceEnterpriseYearly || null : undefined,
                smtpHost: smtpHost !== undefined ? smtpHost || null : undefined,
                smtpPort: smtpPort !== undefined ? (smtpPort ? Number(smtpPort) : null) : undefined,
                smtpSecure: smtpSecure !== undefined ? Boolean(smtpSecure) : undefined,
                smtpUser: smtpUser !== undefined ? smtpUser || null : undefined,
                smtpPass: smtpPass !== undefined ? smtpPass || null : undefined,
                smtpFromEmail: smtpFromEmail !== undefined ? smtpFromEmail || null : undefined,
                smtpNotificationEmail: smtpNotificationEmail !== undefined ? smtpNotificationEmail || null : undefined,
                publicDemoBotId: publicDemoBotId !== undefined ? publicDemoBotId || null : undefined
            };

            const assignments: Array<[string, unknown]> = [];
            const missingRequestedColumns: string[] = [];
            for (const [field, value] of Object.entries(requested)) {
                if (value === undefined) continue;
                const actual = actualByLower.get(field.toLowerCase());
                if (!actual) {
                    missingRequestedColumns.push(field);
                    continue;
                }
                assignments.push([actual, value]);
            }

            if (missingRequestedColumns.length > 0) {
                console.warn('[platform-settings] Missing GlobalConfig columns in DB:', missingRequestedColumns);
            }

            if (assignments.length > 0) {
                for (const [column] of assignments) {
                    if (!SAFE_SQL_IDENTIFIER.test(column)) {
                        throw new Error(`[platform-settings] Unsafe GlobalConfig column name: ${column}`);
                    }
                }

                const updatedAtColumn = actualByLower.get('updatedat');
                await prisma.$executeRawUnsafe(
                    updatedAtColumn
                        ? `INSERT INTO "GlobalConfig" ("id", "${updatedAtColumn}") VALUES ('default', NOW()) ON CONFLICT ("id") DO NOTHING`
                        : `INSERT INTO "GlobalConfig" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING`
                );

                const setClause = assignments
                    .map(([column], index) => `"${column}" = $${index + 1}`)
                    .join(', ');
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalConfig" SET ${setClause} WHERE "id" = 'default'`,
                    ...assignments.map(([, value]) => value)
                );
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

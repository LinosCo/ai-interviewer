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
            const missingRequestedColumns = new Set<string>();

            const compatValues: Record<string, unknown> = {};
            const assignIfAvailable = (column: string, value: unknown) => {
                if (!available.has(column)) {
                    missingRequestedColumns.add(column);
                    return;
                }
                compatValues[column] = value;
            };

            if (platformOpenaiApiKey !== undefined) {
                const value = platformOpenaiApiKey || null;
                assignIfAvailable('openaiApiKey', value);
            }
            if (platformAnthropicApiKey !== undefined) {
                const value = platformAnthropicApiKey || null;
                assignIfAvailable('anthropicApiKey', value);
            }
            if (platformGeminiApiKey !== undefined) {
                const value = platformGeminiApiKey || null;
                assignIfAvailable('geminiApiKey', value);
            }
            if (googleSerpApiKey !== undefined) {
                const value = googleSerpApiKey || null;
                assignIfAvailable('googleSerpApiKey', value);
            }
            if (stripeSecretKey !== undefined) {
                const value = stripeSecretKey || null;
                assignIfAvailable('stripeSecretKey', value);
            }
            if (stripeWebhookSecret !== undefined) {
                const value = stripeWebhookSecret || null;
                assignIfAvailable('stripeWebhookSecret', value);
            }
            if (stripePriceStarter !== undefined) {
                const value = stripePriceStarter || null;
                assignIfAvailable('stripePriceStarter', value);
            }
            if (stripePriceStarterYearly !== undefined) {
                const value = stripePriceStarterYearly || null;
                assignIfAvailable('stripePriceStarterYearly', value);
            }
            if (stripePricePro !== undefined) {
                const value = stripePricePro || null;
                assignIfAvailable('stripePricePro', value);
            }
            if (stripePriceProYearly !== undefined) {
                const value = stripePriceProYearly || null;
                assignIfAvailable('stripePriceProYearly', value);
            }
            if (stripePriceBusiness !== undefined) {
                const value = stripePriceBusiness || null;
                assignIfAvailable('stripePriceBusiness', value);
            }
            if (stripePriceBusinessYearly !== undefined) {
                const value = stripePriceBusinessYearly || null;
                assignIfAvailable('stripePriceBusinessYearly', value);
            }
            if (stripePricePackSmall !== undefined) {
                const value = stripePricePackSmall || null;
                assignIfAvailable('stripePricePackSmall', value);
            }
            if (stripePricePackMedium !== undefined) {
                const value = stripePricePackMedium || null;
                assignIfAvailable('stripePricePackMedium', value);
            }
            if (stripePricePackLarge !== undefined) {
                const value = stripePricePackLarge || null;
                assignIfAvailable('stripePricePackLarge', value);
            }
            if (stripePricePartner !== undefined) {
                const value = stripePricePartner || null;
                assignIfAvailable('stripePricePartner', value);
            }
            if (stripePricePartnerYearly !== undefined) {
                const value = stripePricePartnerYearly || null;
                assignIfAvailable('stripePricePartnerYearly', value);
            }
            if (stripePriceEnterprise !== undefined) {
                const value = stripePriceEnterprise || null;
                assignIfAvailable('stripePriceEnterprise', value);
            }
            if (stripePriceEnterpriseYearly !== undefined) {
                const value = stripePriceEnterpriseYearly || null;
                assignIfAvailable('stripePriceEnterpriseYearly', value);
            }
            if (smtpHost !== undefined) {
                const value = smtpHost || null;
                assignIfAvailable('smtpHost', value);
            }
            if (smtpPort !== undefined) {
                const value = smtpPort ? Number(smtpPort) : null;
                assignIfAvailable('smtpPort', value);
            }
            if (smtpSecure !== undefined) {
                const value = Boolean(smtpSecure);
                assignIfAvailable('smtpSecure', value);
            }
            if (smtpUser !== undefined) {
                const value = smtpUser || null;
                assignIfAvailable('smtpUser', value);
            }
            if (smtpPass !== undefined) {
                const value = smtpPass || null;
                assignIfAvailable('smtpPass', value);
            }
            if (smtpFromEmail !== undefined) {
                const value = smtpFromEmail || null;
                assignIfAvailable('smtpFromEmail', value);
            }
            if (smtpNotificationEmail !== undefined) {
                const value = smtpNotificationEmail || null;
                assignIfAvailable('smtpNotificationEmail', value);
            }
            if (publicDemoBotId !== undefined) {
                const value = publicDemoBotId || null;
                assignIfAvailable('publicDemoBotId', value);
            }

            if (missingRequestedColumns.size > 0) {
                return NextResponse.json(
                    {
                        error: 'GlobalConfig schema mismatch',
                        missingColumns: Array.from(missingRequestedColumns).sort()
                    },
                    { status: 500 }
                );
            }

            if (available.has('updatedAt')) {
                compatValues.updatedAt = new Date();
            }

            const assignments = Object.entries(compatValues);
            if (assignments.length > 0) {
                for (const [column] of assignments) {
                    if (!SAFE_SQL_IDENTIFIER.test(column)) {
                        throw new Error(`[platform-settings] Unsafe GlobalConfig column name: ${column}`);
                    }
                }

                await prisma.$executeRawUnsafe(
                    available.has('updatedAt')
                        ? `INSERT INTO "GlobalConfig" ("id", "updatedAt") VALUES ('default', NOW()) ON CONFLICT ("id") DO NOTHING`
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

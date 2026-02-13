import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function getGlobalConfigCompat() {
    try {
        const fields = [
            'openaiApiKey',
            'anthropicApiKey',
            'geminiApiKey',
            'googleSerpApiKey',
            'stripeSecretKey',
            'stripeWebhookSecret',
            'stripePriceStarter',
            'stripePriceStarterYearly',
            'stripePricePro',
            'stripePriceProYearly',
            'stripePriceBusiness',
            'stripePriceBusinessYearly',
            'stripePricePackSmall',
            'stripePricePackMedium',
            'stripePricePackLarge',
            'stripePricePartner',
            'stripePricePartnerYearly',
            'stripePriceEnterprise',
            'stripePriceEnterpriseYearly',
            'smtpHost',
            'smtpPort',
            'smtpSecure',
            'smtpUser',
            'smtpPass',
            'smtpFromEmail',
            'smtpNotificationEmail',
            'publicDemoBotId'
        ] as const;

        const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>(Prisma.sql`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND LOWER(table_name) = LOWER('GlobalConfig')
        `).catch(() => []);
        if (columns.length === 0) return null;

        const tableName = columns[0]?.table_name;
        if (!tableName || !SAFE_SQL_IDENTIFIER.test(tableName)) return null;

        const actualByLower = new Map(columns.map((c) => [c.column_name.toLowerCase(), c.column_name]));
        const selectParts: string[] = [];
        for (const field of fields) {
            const actual = actualByLower.get(field.toLowerCase());
            if (actual && SAFE_SQL_IDENTIFIER.test(actual)) {
                selectParts.push(`"${actual}" AS "${field}"`);
            }
        }
        if (selectParts.length === 0) return null;

        const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT ${selectParts.join(', ')} FROM "public"."${tableName}" WHERE "id" = 'default' LIMIT 1`
        );
        return rows[0] ?? null;
    } catch (error) {
        console.error('[settings] getGlobalConfigCompat error:', error);
        return null;
    }
}

function getDefaultMethodologyKnowledge(): string {
    try {
        const filePath = path.join(process.cwd(), 'knowledge', 'interview-methodology.md');
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error('Error loading default methodology knowledge:', error);
        return '';
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });
        const isPlatformAdmin = currentUser?.role === 'ADMIN';

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!membership && !isPlatformAdmin) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        const canViewGlobalConfig = isPlatformAdmin;

        // Fetch organization settings
        const settings = await prisma.platformSettings.findUnique({
            where: { organizationId: orgId }
        });

        const defaultMethodology = getDefaultMethodologyKnowledge();
        const settingsWithDefaults = settings
            ? {
                ...settings,
                methodologyKnowledge: settings.methodologyKnowledge?.trim()
                    ? settings.methodologyKnowledge
                    : defaultMethodology
            }
            : {
                methodologyKnowledge: defaultMethodology,
                strategicPlan: null
            };

        // If admin, also return global config
        let globalConfig = null;
        if (canViewGlobalConfig) {
            globalConfig = await getGlobalConfigCompat();
        }

        return NextResponse.json({
            settings: settingsWithDefaults,
            globalConfig
        });
    } catch (error) {
        console.error('Error fetching organization settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

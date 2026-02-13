import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GLOBAL_CONFIG_FIELDS = [
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
const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function getGlobalConfigCompat() {
    try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND LOWER(table_name) = LOWER('GlobalConfig')
        `);
        const actualByLower = new Map(columns.map((c) => [c.column_name.toLowerCase(), c.column_name]));
        const selectable = GLOBAL_CONFIG_FIELDS.filter((f) => actualByLower.has(f.toLowerCase()));
        const rowKeyMap = new Map<string, string>();
        for (const c of columns) {
            rowKeyMap.set(c.column_name.toLowerCase(), c.column_name);
        }

        if (selectable.length === 0) return null;

        const selectFragments: string[] = [];
        for (const field of selectable) {
            const actual = actualByLower.get(field.toLowerCase());
            if (!actual) continue;
            if (!SAFE_SQL_IDENTIFIER.test(actual) || !SAFE_SQL_IDENTIFIER.test(field)) {
                throw new Error(`Unsafe GlobalConfig identifier mapping: ${actual} -> ${field}`);
            }
            selectFragments.push(`"${actual}" AS "${field}"`);
        }
        if (selectFragments.length === 0) return null;

        const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `SELECT ${selectFragments.join(', ')} FROM "GlobalConfig" WHERE id = 'default' LIMIT 1`
        );

        const raw = rows[0];
        if (!raw) return null;

        const normalized: Record<string, unknown> = {};
        for (const field of selectable) {
            const direct = raw[field];
            const lower = raw[field.toLowerCase()];
            const mappedKey = rowKeyMap.get(field.toLowerCase());
            const mapped = mappedKey ? raw[mappedKey] : undefined;
            normalized[field] = direct ?? lower ?? mapped ?? null;
        }
        return normalized;
    } catch (error) {
        console.error('Error loading global config compat:', error);
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
        const isAdmin = currentUser?.role === 'ADMIN';

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!membership && !isAdmin) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

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
        if (isAdmin) {
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

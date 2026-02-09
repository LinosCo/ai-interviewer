import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

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
    'smtpHost',
    'smtpPort',
    'smtpSecure',
    'smtpUser',
    'smtpPass',
    'smtpFromEmail',
    'smtpNotificationEmail',
    'publicDemoBotId'
] as const;

async function getGlobalConfigCompat() {
    try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'GlobalConfig'
        `);
        const available = new Set(columns.map((c) => c.column_name));
        const selectable = GLOBAL_CONFIG_FIELDS.filter((f) => available.has(f));

        if (selectable.length === 0) return null;

        const columnSql = Prisma.join(selectable.map((f) => Prisma.raw(`"${f}"`)));
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
            SELECT ${columnSql}
            FROM "GlobalConfig"
            WHERE id = 'default'
            LIMIT 1
        `);

        return rows[0] ?? null;
    } catch (error) {
        console.error('Error loading global config compat:', error);
        return null;
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

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!membership && (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch organization settings
        const settings = await prisma.platformSettings.findUnique({
            where: { organizationId: orgId }
        });

        // If admin, also return global config
        let globalConfig = null;
        if ((session.user as any).role === 'ADMIN') {
            globalConfig = await getGlobalConfigCompat();
        }

        return NextResponse.json({
            settings,
            globalConfig
        });
    } catch (error) {
        console.error('Error fetching organization settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

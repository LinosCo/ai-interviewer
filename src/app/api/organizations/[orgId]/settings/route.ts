import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getGlobalConfigCompat() {
    return prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            openaiApiKey: true,
            anthropicApiKey: true,
            geminiApiKey: true,
            googleSerpApiKey: true,
            stripeSecretKey: true,
            stripeWebhookSecret: true,
            stripePriceStarter: true,
            stripePriceStarterYearly: true,
            stripePricePro: true,
            stripePriceProYearly: true,
            stripePriceBusiness: true,
            stripePriceBusinessYearly: true,
            stripePricePackSmall: true,
            stripePricePackMedium: true,
            stripePricePackLarge: true,
            stripePricePartner: true,
            stripePricePartnerYearly: true,
            stripePriceEnterprise: true,
            stripePriceEnterpriseYearly: true,
            smtpHost: true,
            smtpPort: true,
            smtpSecure: true,
            smtpUser: true,
            smtpPass: true,
            smtpFromEmail: true,
            smtpNotificationEmail: true,
            publicDemoBotId: true
        }
    });
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

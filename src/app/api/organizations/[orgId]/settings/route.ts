import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import {
    getDefaultInterviewMethodologyKnowledge,
    getDefaultStrategicMarketingKnowledge,
    getStrategicMarketingKnowledgeByOrg
} from '@/lib/marketing/strategic-kb';
import { getDefaultTrainingMethodologyKnowledge, getTrainingMethodologyKnowledgeByOrg } from '@/lib/training/training-methodology-kb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getGlobalConfigCompat() {
    try {
        const config = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });

        if (!config) return null;

        // Return only the fields we expect, to match previous behavior (though returning the whole object is fine for admin)
        return {
            openaiApiKey: config.openaiApiKey,
            anthropicApiKey: config.anthropicApiKey,
            geminiApiKey: config.geminiApiKey,
            googleSerpApiKey: config.googleSerpApiKey,
            stripeSecretKey: config.stripeSecretKey,
            stripeWebhookSecret: config.stripeWebhookSecret,
            stripePriceStarter: config.stripePriceStarter,
            stripePriceStarterYearly: config.stripePriceStarterYearly,
            stripePricePro: config.stripePricePro,
            stripePriceProYearly: config.stripePriceProYearly,
            stripePriceBusiness: config.stripePriceBusiness,
            stripePriceBusinessYearly: config.stripePriceBusinessYearly,
            stripePricePackSmall: config.stripePricePackSmall,
            stripePricePackMedium: config.stripePricePackMedium,
            stripePricePackLarge: config.stripePricePackLarge,
            stripePricePartner: config.stripePricePartner,
            stripePricePartnerYearly: config.stripePricePartnerYearly,
            stripePriceEnterprise: config.stripePriceEnterprise,
            stripePriceEnterpriseYearly: config.stripePriceEnterpriseYearly,
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort,
            smtpSecure: config.smtpSecure,
            smtpUser: config.smtpUser,
            smtpPass: config.smtpPass,
            smtpFromEmail: config.smtpFromEmail,
            smtpNotificationEmail: config.smtpNotificationEmail,
            publicDemoBotId: config.publicDemoBotId,
            resendApiKey: config.resendApiKey
        };
    } catch (error) {
        console.error('[settings] getGlobalConfigCompat error:', error);
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

        const defaultMethodology = getDefaultInterviewMethodologyKnowledge();
        const defaultTrainingKnowledge = getDefaultTrainingMethodologyKnowledge();
        const defaultMarketingKnowledge = getDefaultStrategicMarketingKnowledge();
        const trainingKnowledgeRow = await getTrainingMethodologyKnowledgeByOrg(orgId);
        const marketingKnowledgeRow = await getStrategicMarketingKnowledgeByOrg(orgId);
        const trainingMethodologyKnowledge = (trainingKnowledgeRow.knowledge || '').trim() || defaultTrainingKnowledge;
        const strategicMarketingKnowledge = (marketingKnowledgeRow.knowledge || '').trim() || defaultMarketingKnowledge;
        const settingsWithDefaults = settings
            ? {
                ...settings,
                methodologyKnowledge: settings.methodologyKnowledge?.trim()
                    ? settings.methodologyKnowledge
                    : defaultMethodology,
                trainingMethodologyKnowledge,
                strategicMarketingKnowledge
            }
            : {
                methodologyKnowledge: defaultMethodology,
                trainingMethodologyKnowledge,
                strategicMarketingKnowledge,
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

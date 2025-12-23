import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/config/plans';

// Lazy Stripe client
let _stripe: Stripe | null = null;

export const PRICING_CONSTANTS = {
    PLANS: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const,
};

export type PlanKey = (typeof PRICING_CONSTANTS.PLANS)[number];

interface PriceConfig {
    name: string;
    price: number | null;
    priceId: string | null;
    features: {
        maxActiveBots: number;
        maxInterviewsPerMonth: number;
        maxUsers: number;
        watermark: boolean;
        customBranding: boolean;
        advancedAnalytics: boolean;
        apiAccess: boolean;
        sso?: boolean;
        prioritySupport?: boolean;
        dedicatedSupport?: boolean;
    };
}

async function getStripeConfig() {
    // 1. Env vars take precedence
    if (process.env.STRIPE_SECRET_KEY) {
        return {
            secretKey: process.env.STRIPE_SECRET_KEY,
            prices: {
                STARTER: process.env.STRIPE_PRICE_STARTER,
                PRO: process.env.STRIPE_PRICE_PRO,
                BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
            }
        };
    }

    // 2. DB fallback
    try {
        const config = await prisma.globalConfig.findUnique({ where: { id: 'default' } });
        if (config?.stripeSecretKey) {
            return {
                secretKey: config.stripeSecretKey,
                prices: {
                    STARTER: config.stripePriceStarter,
                    PRO: config.stripePricePro,
                    BUSINESS: config.stripePriceBusiness,
                }
            };
        }
    } catch (e) {
        console.warn("Failed to fetch global config for Stripe", e);
    }

    return null;
}

export async function getStripeClient(): Promise<Stripe> {
    if (_stripe) return _stripe;

    const config = await getStripeConfig();
    if (!config || !config.secretKey) {
        throw new Error("Stripe is not configured. Please set env vars or configure in dashboard.");
    }

    _stripe = new Stripe(config.secretKey, {
        typescript: true,
        apiVersion: '2025-12-15.clover',
    });

    return _stripe;
}

export async function getPricingPlans(): Promise<Record<PlanKey, PriceConfig>> {
    const config = await getStripeConfig();
    const dbPrices = config?.prices || {};

    const getPriceId = (tier: PlanType) => {
        const upperTier = tier.toUpperCase() as keyof typeof dbPrices;
        return dbPrices[upperTier] || PLANS[tier].stripePriceId || null;
    };

    return {
        FREE: {
            name: PLANS[PlanType.TRIAL].name,
            price: PLANS[PlanType.TRIAL].price,
            priceId: null,
            features: {
                maxActiveBots: PLANS[PlanType.TRIAL].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.TRIAL].responsesPerMonth,
                maxUsers: PLANS[PlanType.TRIAL].users,
                watermark: PLANS[PlanType.TRIAL].features.watermark,
                customBranding: PLANS[PlanType.TRIAL].features.customLogo,
                advancedAnalytics: PLANS[PlanType.TRIAL].features.basicStats,
                apiAccess: PLANS[PlanType.TRIAL].features.apiAccess,
            },
        },
        STARTER: {
            name: PLANS[PlanType.STARTER].name,
            price: PLANS[PlanType.STARTER].price,
            priceId: getPriceId(PlanType.STARTER),
            features: {
                maxActiveBots: PLANS[PlanType.STARTER].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.STARTER].responsesPerMonth,
                maxUsers: PLANS[PlanType.STARTER].users,
                watermark: PLANS[PlanType.STARTER].features.watermark,
                customBranding: PLANS[PlanType.STARTER].features.customLogo,
                advancedAnalytics: PLANS[PlanType.STARTER].features.basicStats,
                apiAccess: PLANS[PlanType.STARTER].features.apiAccess,
            },
        },
        PRO: {
            name: PLANS[PlanType.PRO].name,
            price: PLANS[PlanType.PRO].price,
            priceId: getPriceId(PlanType.PRO),
            features: {
                maxActiveBots: PLANS[PlanType.PRO].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.PRO].responsesPerMonth,
                maxUsers: PLANS[PlanType.PRO].users,
                watermark: PLANS[PlanType.PRO].features.watermark,
                customBranding: PLANS[PlanType.PRO].features.customLogo,
                advancedAnalytics: PLANS[PlanType.PRO].features.basicStats,
                apiAccess: PLANS[PlanType.PRO].features.apiAccess,
            },
        },
        BUSINESS: {
            name: PLANS[PlanType.BUSINESS].name,
            price: PLANS[PlanType.BUSINESS].price,
            priceId: getPriceId(PlanType.BUSINESS),
            features: {
                maxActiveBots: PLANS[PlanType.BUSINESS].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.BUSINESS].responsesPerMonth,
                maxUsers: PLANS[PlanType.BUSINESS].users,
                watermark: PLANS[PlanType.BUSINESS].features.watermark,
                customBranding: PLANS[PlanType.BUSINESS].features.customLogo,
                advancedAnalytics: PLANS[PlanType.BUSINESS].features.basicStats,
                apiAccess: PLANS[PlanType.BUSINESS].features.apiAccess,
            },
        },
        ENTERPRISE: {
            name: 'Enterprise',
            price: null,
            priceId: null,
            features: {
                maxActiveBots: -1,
                maxInterviewsPerMonth: -1,
                maxUsers: -1,
                watermark: false,
                customBranding: true,
                advancedAnalytics: true,
                apiAccess: true,
                sso: true,
                prioritySupport: true,
                dedicatedSupport: true,
            },
        },
    };
}

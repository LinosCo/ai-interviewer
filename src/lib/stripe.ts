import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, PlanFeatures } from '@/config/plans';

// Lazy Stripe client
let _stripe: Stripe | null = null;

export const PRICING_CONSTANTS = {
    PLANS: ['TRIAL', 'FREE', 'STARTER', 'PRO', 'BUSINESS', 'PARTNER', 'ENTERPRISE'] as const,
};

export type PlanKey = (typeof PRICING_CONSTANTS.PLANS)[number];

interface PriceConfig {
    name: string;
    price: number | null;
    priceId: string | null;
    priceYearly: number | null;
    priceIdYearly: string | null;
    features: {
        maxActiveBots: number;
        maxInterviewsPerMonth: number;
        maxUsers: number;
    } & PlanFeatures;
}

async function getStripeConfig() {
    // 1. Env vars take precedence
    if (process.env.STRIPE_SECRET_KEY) {
        return {
            secretKey: process.env.STRIPE_SECRET_KEY,
            prices: {
                STARTER: process.env.STRIPE_PRICE_STARTER,
                STARTER_YEARLY: process.env.STRIPE_PRICE_STARTER_YEARLY,
                PRO: process.env.STRIPE_PRICE_PRO,
                PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
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
                    STARTER_YEARLY: config.stripePriceStarterYearly,
                    PRO: config.stripePricePro,
                    PRO_YEARLY: config.stripePriceProYearly,
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

    const getPriceIdYearly = (tier: PlanType) => {
        const upperTier = `${tier.toUpperCase()}_YEARLY` as keyof typeof dbPrices;
        // @ts-ignore
        return dbPrices[upperTier] || PLANS[tier].stripePriceIdYearly || null;
    };

    return {
        TRIAL: {
            name: PLANS[PlanType.TRIAL].name,
            price: PLANS[PlanType.TRIAL].price,
            priceId: null,
            priceYearly: 0,
            priceIdYearly: null,
            features: {
                maxActiveBots: PLANS[PlanType.TRIAL].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.TRIAL].responsesPerMonth,
                maxUsers: PLANS[PlanType.TRIAL].users,
                ...PLANS[PlanType.TRIAL].features,
            },
        } as PriceConfig,
        FREE: {
            name: PLANS[PlanType.TRIAL].name,
            price: PLANS[PlanType.TRIAL].price,
            priceId: null,
            priceYearly: 0,
            priceIdYearly: null,
            features: {
                maxActiveBots: PLANS[PlanType.TRIAL].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.TRIAL].responsesPerMonth,
                maxUsers: PLANS[PlanType.TRIAL].users,
                ...PLANS[PlanType.TRIAL].features,
            },
        } as PriceConfig,
        STARTER: {
            name: PLANS[PlanType.STARTER].name,
            price: PLANS[PlanType.STARTER].price,
            priceId: getPriceId(PlanType.STARTER),
            priceYearly: PLANS[PlanType.STARTER].priceYearly,
            priceIdYearly: getPriceIdYearly(PlanType.STARTER),
            features: {
                maxActiveBots: PLANS[PlanType.STARTER].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.STARTER].responsesPerMonth,
                maxUsers: PLANS[PlanType.STARTER].users,
                ...PLANS[PlanType.STARTER].features,
            },
        } as PriceConfig,
        PRO: {
            name: PLANS[PlanType.PRO].name,
            price: PLANS[PlanType.PRO].price,
            priceId: getPriceId(PlanType.PRO),
            priceYearly: PLANS[PlanType.PRO].priceYearly,
            priceIdYearly: getPriceIdYearly(PlanType.PRO),
            features: {
                maxActiveBots: PLANS[PlanType.PRO].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.PRO].responsesPerMonth,
                maxUsers: PLANS[PlanType.PRO].users,
                ...PLANS[PlanType.PRO].features,
            },
        } as PriceConfig,
        BUSINESS: {
            name: PLANS[PlanType.BUSINESS].name,
            price: PLANS[PlanType.BUSINESS].price,
            priceId: getPriceId(PlanType.BUSINESS),
            priceYearly: PLANS[PlanType.BUSINESS].priceYearly,
            priceIdYearly: getPriceIdYearly(PlanType.BUSINESS),
            features: {
                maxActiveBots: PLANS[PlanType.BUSINESS].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.BUSINESS].responsesPerMonth,
                maxUsers: PLANS[PlanType.BUSINESS].users,
                ...PLANS[PlanType.BUSINESS].features,
            },
        } as PriceConfig,
        PARTNER: {
            name: PLANS[PlanType.PARTNER].name,
            price: PLANS[PlanType.PARTNER].price,
            priceId: null,
            priceYearly: 0,
            priceIdYearly: null,
            features: {
                maxActiveBots: PLANS[PlanType.PARTNER].activeInterviews,
                maxInterviewsPerMonth: PLANS[PlanType.PARTNER].responsesPerMonth,
                maxUsers: PLANS[PlanType.PARTNER].users,
                ...PLANS[PlanType.PARTNER].features,
            },
        } as PriceConfig,
        ENTERPRISE: {
            name: 'Enterprise',
            price: null,
            priceId: null,
            priceYearly: null,
            priceIdYearly: null,
            features: {
                maxActiveBots: -1,
                maxInterviewsPerMonth: -1,
                maxUsers: -1,
                ...PLANS[PlanType.BUSINESS].features,
            },
        } as PriceConfig,
    };
}

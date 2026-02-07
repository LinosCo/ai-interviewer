import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, PlanLimits, PlanFeatures } from '@/config/plans';

// Lazy Stripe client
let _stripe: Stripe | null = null;

export const PRICING_CONSTANTS = {
    PLANS: ['TRIAL', 'FREE', 'STARTER', 'PRO', 'BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN'] as const,
};

export type PlanKey = (typeof PRICING_CONSTANTS.PLANS)[number];

interface PriceConfig {
    name: string;
    price: number | null;
    priceId: string | null;
    priceYearly: number | null;
    priceIdYearly: string | null;
    limits: PlanLimits;
    features: PlanFeatures;
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
                BUSINESS_YEARLY: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
                PACK_SMALL: process.env.STRIPE_PRICE_PACK_SMALL,
                PACK_MEDIUM: process.env.STRIPE_PRICE_PACK_MEDIUM,
                PACK_LARGE: process.env.STRIPE_PRICE_PACK_LARGE
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
                    BUSINESS_YEARLY: config.stripePriceBusinessYearly,
                    PACK_SMALL: config.stripePricePackSmall,
                    PACK_MEDIUM: config.stripePricePackMedium,
                    PACK_LARGE: config.stripePricePackLarge
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
        apiVersion: '2025-12-15.clover', // Updated to a stable version used in other files
    });

    return _stripe;
}

export async function getPricingPlans(): Promise<Record<PlanKey, PriceConfig>> {
    const config = await getStripeConfig();
    const dbPrices = (config?.prices || {}) as Record<string, string | undefined>;

    const getPriceId = (tier: PlanType) => {
        const upperTier = tier.toUpperCase() as keyof typeof dbPrices;
        return dbPrices[upperTier] || PLANS[tier].stripePriceIdMonthly || null;
    };

    const getPriceIdYearly = (tier: PlanType) => {
        const upperTier = `${tier.toUpperCase()}_YEARLY` as keyof typeof dbPrices;
        return dbPrices[upperTier] || PLANS[tier].stripePriceIdYearly || null;
    };

    const result: Partial<Record<PlanKey, PriceConfig>> = {};

    for (const key of PRICING_CONSTANTS.PLANS) {
        const plan = PLANS[key as PlanType];
        if (!plan) continue;
        result[key] = {
            name: plan.name,
            price: plan.monthlyPrice,
            priceId: getPriceId(key as PlanType),
            priceYearly: plan.yearlyPrice,
            priceIdYearly: getPriceIdYearly(key as PlanType),
            limits: plan.limits,
            features: plan.features
        };
    }

    return result as Record<PlanKey, PriceConfig>;
}

export async function getStripePriceIdForPlan(
    tier: PlanType,
    billingPeriod: 'monthly' | 'yearly'
): Promise<string | null> {
    const config = await getStripeConfig();
    const dbPrices = (config?.prices || {}) as Record<string, string | undefined>;
    const key =
        billingPeriod === 'yearly'
            ? `${tier.toUpperCase()}_YEARLY`
            : tier.toUpperCase();

    const fromConfig = dbPrices[key as keyof typeof dbPrices];
    if (fromConfig) return fromConfig;

    const plan = PLANS[tier];
    if (!plan) return null;

    return billingPeriod === 'yearly'
        ? plan.stripePriceIdYearly || null
        : plan.stripePriceIdMonthly || null;
}

export async function getStripePriceIdForPack(packType: string): Promise<string | null> {
    const config = await getStripeConfig();
    const dbPrices = (config?.prices || {}) as Record<string, string | undefined>;
    const normalized = packType.toLowerCase();

    if (normalized === 'small') {
        return dbPrices.PACK_SMALL || process.env.STRIPE_PRICE_PACK_SMALL || null;
    }
    if (normalized === 'medium') {
        return dbPrices.PACK_MEDIUM || process.env.STRIPE_PRICE_PACK_MEDIUM || null;
    }
    if (normalized === 'large') {
        return dbPrices.PACK_LARGE || process.env.STRIPE_PRICE_PACK_LARGE || null;
    }

    return null;
}

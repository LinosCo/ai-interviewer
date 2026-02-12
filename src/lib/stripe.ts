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
    const envPrices = {
        STARTER: process.env.STRIPE_PRICE_STARTER,
        STARTER_YEARLY: process.env.STRIPE_PRICE_STARTER_YEARLY,
        PRO: process.env.STRIPE_PRICE_PRO,
        PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
        BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
        BUSINESS_YEARLY: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
        PACK_SMALL: process.env.STRIPE_PRICE_PACK_SMALL,
        PACK_MEDIUM: process.env.STRIPE_PRICE_PACK_MEDIUM,
        PACK_LARGE: process.env.STRIPE_PRICE_PACK_LARGE,
        PARTNER: process.env.STRIPE_PRICE_PARTNER,
        PARTNER_YEARLY: process.env.STRIPE_PRICE_PARTNER_YEARLY,
        ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
        ENTERPRISE_YEARLY: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY
    };

    // 1. Env vars take precedence
    if (process.env.STRIPE_SECRET_KEY) {
        return {
            secretKey: process.env.STRIPE_SECRET_KEY,
            prices: envPrices
        };
    }

    // 2. DB fallback
    let secretKeyFromDb: string | null = null;

    try {
        // Keep this query minimal to avoid hard-failing when some optional
        // pricing columns are missing in partially migrated environments.
        const secretConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: {
                stripeSecretKey: true
            }
        });
        secretKeyFromDb = secretConfig?.stripeSecretKey || null;
    } catch (e) {
        console.warn("Failed to fetch Stripe secret key from global config", e);
    }

    if (secretKeyFromDb) {
        let dbPrices: Partial<Record<string, string | null>> = {};

        try {
            const priceConfig = await prisma.globalConfig.findUnique({
                where: { id: 'default' },
                select: {
                    stripePriceStarter: true,
                    stripePriceStarterYearly: true,
                    stripePricePro: true,
                    stripePriceProYearly: true,
                    stripePriceBusiness: true,
                    stripePriceBusinessYearly: true,
                    stripePricePartner: true,
                    stripePricePartnerYearly: true,
                    stripePriceEnterprise: true,
                    stripePriceEnterpriseYearly: true,
                    stripePricePackSmall: true,
                    stripePricePackMedium: true,
                    stripePricePackLarge: true
                }
            });

            if (priceConfig) {
                const pc = priceConfig as any;
                dbPrices = {
                    STARTER: pc.stripePriceStarter,
                    STARTER_YEARLY: pc.stripePriceStarterYearly,
                    PRO: pc.stripePricePro,
                    PRO_YEARLY: pc.stripePriceProYearly,
                    BUSINESS: pc.stripePriceBusiness,
                    BUSINESS_YEARLY: pc.stripePriceBusinessYearly,
                    PARTNER: pc.stripePricePartner,
                    PARTNER_YEARLY: pc.stripePricePartnerYearly,
                    ENTERPRISE: pc.stripePriceEnterprise,
                    ENTERPRISE_YEARLY: pc.stripePriceEnterpriseYearly,
                    PACK_SMALL: pc.stripePricePackSmall,
                    PACK_MEDIUM: pc.stripePricePackMedium,
                    PACK_LARGE: pc.stripePricePackLarge
                };
            }
        } catch (e) {
            // Non-fatal: keep Stripe enabled using secret key + env/default prices.
            console.warn("Failed to fetch Stripe prices from global config", e);
        }

        return {
            secretKey: secretKeyFromDb,
            prices: {
                ...envPrices,
                ...dbPrices
            }
        };
    }

    return null;
}

/**
 * Returns the Stripe client, or null if Stripe is not configured.
 * Use this when Stripe being unconfigured is acceptable (e.g. loading pages).
 */
export async function getStripeClientSafe(): Promise<Stripe | null> {
    if (_stripe) return _stripe;

    const config = await getStripeConfig();
    if (!config || !config.secretKey) {
        console.warn('[Stripe] Not configured – set STRIPE_SECRET_KEY in env or via Admin dashboard.');
        return null;
    }

    _stripe = new Stripe(config.secretKey, {
        typescript: true,
        apiVersion: '2025-12-15.clover',
    });

    return _stripe;
}

/**
 * Returns the Stripe client or throws if not configured.
 * Use in API routes that strictly require Stripe (checkout, webhook, etc.).
 */
export async function getStripeClient(): Promise<Stripe> {
    const client = await getStripeClientSafe();
    if (!client) {
        throw new Error('Stripe is not configured. Please set env vars or configure in dashboard.');
    }
    return client;
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

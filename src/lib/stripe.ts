import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

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
        // Fallback to empty string to avoid crash during build/init if not needed,
        // but throw explicit error when used.
        // Actually, better to throw here if this function is called, it means we NEED stripe.
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
    const prices = config?.prices || {};

    return {
        FREE: {
            name: 'Free',
            price: 0,
            priceId: null,
            features: {
                maxActiveBots: 1,
                maxInterviewsPerMonth: 30,
                maxUsers: 1,
                watermark: true,
                customBranding: false,
                advancedAnalytics: false,
                apiAccess: false,
            },
        },
        STARTER: {
            name: 'Starter',
            price: 29,
            priceId: prices.STARTER || process.env.STRIPE_PRICE_STARTER || null,
            features: {
                maxActiveBots: 3,
                maxInterviewsPerMonth: 150,
                maxUsers: 1,
                watermark: false,
                customBranding: false,
                advancedAnalytics: false,
                apiAccess: false,
            },
        },
        PRO: {
            name: 'Pro',
            price: 79,
            priceId: prices.PRO || process.env.STRIPE_PRICE_PRO || null,
            features: {
                maxActiveBots: 10,
                maxInterviewsPerMonth: 500,
                maxUsers: 3,
                watermark: false,
                customBranding: true,
                advancedAnalytics: true,
                apiAccess: true,
            },
        },
        BUSINESS: {
            name: 'Business',
            price: 199,
            priceId: prices.BUSINESS || process.env.STRIPE_PRICE_BUSINESS || null,
            features: {
                maxActiveBots: -1, // unlimited
                maxInterviewsPerMonth: 2000,
                maxUsers: 10,
                watermark: false,
                customBranding: true,
                advancedAnalytics: true,
                apiAccess: true,
                sso: true,
                prioritySupport: true,
            },
        },
        ENTERPRISE: {
            name: 'Enterprise',
            price: null, // custom
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

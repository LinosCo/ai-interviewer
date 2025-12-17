import Stripe from 'stripe';

// Lazy Stripe client - only initialized when actually needed (not at build time)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        _stripe = new Stripe(key, { typescript: true });
    }
    return _stripe;
}

// For backwards compatibility - use getStripe() in API routes
export const stripe = {
    get customers() { return getStripe().customers; },
    get subscriptions() { return getStripe().subscriptions; },
    get checkout() { return getStripe().checkout; },
    get billingPortal() { return getStripe().billingPortal; },
    get webhooks() { return getStripe().webhooks; },
};

// Pricing configuration
export const PRICING_PLANS = {
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
        priceId: process.env.STRIPE_PRICE_STARTER,
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
        priceId: process.env.STRIPE_PRICE_PRO,
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
        priceId: process.env.STRIPE_PRICE_BUSINESS,
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
} as const;

export type PlanKey = keyof typeof PRICING_PLANS;

export function getPlanLimits(tier: PlanKey) {
    return PRICING_PLANS[tier].features;
}

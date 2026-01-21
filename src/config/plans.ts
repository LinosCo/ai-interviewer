export enum PlanType {
    TRIAL = 'trial',
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business',
    PARTNER = 'partner'
}

// Map SubscriptionTier (Prisma) to PlanType (config)
// SubscriptionTier: FREE, STARTER, PRO, BUSINESS, ENTERPRISE
// PlanType: TRIAL, STARTER, PRO, BUSINESS, PARTNER
export function subscriptionTierToPlanType(tier: string): PlanType {
    const mapping: Record<string, PlanType> = {
        'FREE': PlanType.TRIAL,
        'STARTER': PlanType.STARTER,
        'PRO': PlanType.PRO,
        'BUSINESS': PlanType.BUSINESS,
        'ENTERPRISE': PlanType.BUSINESS, // Enterprise maps to Business config
    };
    return mapping[tier] || PlanType.TRIAL;
}

export interface PlanFeatures {
    // Creazione interviste
    aiGeneration: boolean;
    basicTemplates: boolean;
    advancedTemplates: boolean;
    manualEdit: boolean;
    knowledgeBase: boolean;
    conditionalLogic: boolean;
    customTemplates: boolean;

    // Branding
    watermark: boolean;
    customColor: boolean;
    customLogo: boolean;
    customDomain: boolean;
    whiteLabel: boolean;

    // Analytics
    basicStats: boolean;
    transcripts: boolean;
    sentiment: boolean;
    themeExtraction: boolean;
    keyQuotes: boolean;
    trends: boolean;
    comparison: boolean;
    segmentation: boolean;
    customDashboards: boolean;

    // Export & Integrations
    exportPdf: boolean;
    exportCsv: boolean;
    webhooks: boolean;
    apiAccess: boolean;
    zapier: boolean;
    sso: boolean;

    // Support
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface PlanLimits {
    // Conversazione (nascosti)
    maxExchangesPerInterview: number;
    maxTokensPerInterview: number;
    maxCharsPerUserMessage: number;
    inactivityTimeoutMinutes: number;

    // Configurazione bot (nascosti)
    maxQuestionsPerInterview: number;
    maxKnowledgeBaseChars: number;
    maxKnowledgeBaseFiles: number;

    // Test e simulazioni (nascosti)
    simulationsPerDayPerBot: number;
    aiRegenerationsPerDay: number;

    // Rate limits (nascosti)
    maxParallelInterviews: number;
    messageCooldownSeconds: number;

    // Chatbot limits
    monthlyTokenBudget: number;
    maxActiveChatbots: number;

    // Visibility tracking limits
    maxVisibilityPrompts: number;
    visibilityScansPerWeek: number;
    maxManualScansPerDay: number;
    maxBrandsTracked: number;
    maxCompetitorsTracked: number;

    // AI Features
    aiTipsEnabled: boolean;
}

export interface PlanConfig {
    id: PlanType;
    name: string;
    price: number;           // €/mese
    priceYearly: number;     // €/mese con sconto annuale

    // Limiti visibili (pricing page)
    responsesPerMonth: number;
    activeInterviews: number;
    users: number;

    // Feature flags
    features: PlanFeatures;

    // Limiti nascosti (enforcement)
    limits: PlanLimits;

    // Marketing features (visibili nel pricing)
    marketingFeatures: string[];

    // Stripe
    stripePriceId?: string;
    stripePriceIdYearly?: string;
}

export const PLANS: Record<PlanType, PlanConfig> = {
    [PlanType.TRIAL]: {
        id: PlanType.TRIAL,
        name: 'Free Trial',
        price: 0,
        priceYearly: 0,

        responsesPerMonth: 10,
        activeInterviews: 1,
        users: 1,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: false,
            manualEdit: true,
            knowledgeBase: false,
            conditionalLogic: false,
            customTemplates: false,

            watermark: true,
            customColor: false,
            customLogo: false,
            customDomain: false,
            whiteLabel: false,

            basicStats: true,
            transcripts: true,
            sentiment: false,
            themeExtraction: false,
            keyQuotes: false,
            trends: false,
            comparison: false,
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: false,
            webhooks: false,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'community'
        },

        limits: {
            maxExchangesPerInterview: 10,
            maxTokensPerInterview: 50000,
            maxCharsPerUserMessage: 2000,
            inactivityTimeoutMinutes: 30,

            maxQuestionsPerInterview: 10,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,

            simulationsPerDayPerBot: 5,
            aiRegenerationsPerDay: 10,

            maxParallelInterviews: 10,
            messageCooldownSeconds: 3,
            monthlyTokenBudget: 0,
            maxActiveChatbots: 0,
            maxVisibilityPrompts: 0,
            visibilityScansPerWeek: 0,
            maxManualScansPerDay: 0,
            maxBrandsTracked: 0,
            maxCompetitorsTracked: 0,
            aiTipsEnabled: false
        },
        marketingFeatures: [
            '10 interviste/mese',
            '1 Progetto',
            'Analytics base',
            'Nessun Chatbot',
            'No AI Tips',
            'Supporto Community'
        ],

        stripePriceId: undefined,
        stripePriceIdYearly: undefined
    },

    [PlanType.PARTNER]: {
        id: PlanType.PARTNER,
        name: 'Partner (Lifetime)',
        price: 0,
        priceYearly: 0,

        responsesPerMonth: 1000, // Same as PRO
        activeInterviews: 20,
        users: 5,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
            conditionalLogic: false,
            customTemplates: false,

            watermark: false,
            customColor: true,
            customLogo: true,
            customDomain: false,
            whiteLabel: false,

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: true,
            comparison: true,
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'priority'
        },

        limits: {
            maxExchangesPerInterview: 30,
            maxTokensPerInterview: 100000,
            maxCharsPerUserMessage: 5000,
            inactivityTimeoutMinutes: 45,

            maxQuestionsPerInterview: 20,
            maxKnowledgeBaseChars: 100000,
            maxKnowledgeBaseFiles: 50,

            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,

            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            monthlyTokenBudget: 1000000,
            maxActiveChatbots: 3,
            maxVisibilityPrompts: 45,
            visibilityScansPerWeek: 7,
            maxManualScansPerDay: 10,
            maxBrandsTracked: 3,
            maxCompetitorsTracked: 5,
            aiTipsEnabled: true
        },
        marketingFeatures: [
            'Piano Partner Gratuito',
            'Tutte le funzioni PRO incluse',
            'Gestione multi-utente (5)',
            'Attivabile solo da amministratore'
        ],

        stripePriceId: undefined,
        stripePriceIdYearly: undefined
    },

    [PlanType.STARTER]: {
        id: PlanType.STARTER,
        name: 'Starter',
        price: 69,
        priceYearly: 49,

        responsesPerMonth: 300,
        activeInterviews: 5,
        users: 2,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true, // Activated for KB sources
            conditionalLogic: false,
            customTemplates: false,

            watermark: true,
            customColor: true,
            customLogo: true,
            customDomain: false,
            whiteLabel: false,

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: false,
            comparison: false,
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: false,
            webhooks: false,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'email'
        },

        limits: {
            maxExchangesPerInterview: 20,
            maxTokensPerInterview: 60000,
            maxCharsPerUserMessage: 3000,
            inactivityTimeoutMinutes: 30,

            maxQuestionsPerInterview: 12,
            maxKnowledgeBaseChars: 100000,
            maxKnowledgeBaseFiles: 10,

            simulationsPerDayPerBot: 10,
            aiRegenerationsPerDay: 20,

            maxParallelInterviews: 15,
            messageCooldownSeconds: 2,
            monthlyTokenBudget: 200000,
            maxActiveChatbots: 1,
            maxVisibilityPrompts: 0,
            visibilityScansPerWeek: 0,
            maxManualScansPerDay: 0,
            maxBrandsTracked: 0,
            maxCompetitorsTracked: 0,
            aiTipsEnabled: false
        },
        marketingFeatures: [
            '300 interviste/mese',
            '5 Progetti attivi',
            'Analytics completi',
            '1 Chatbot (2.000 conv/mese)',
            '10 Knowledge Sources',
            'No Visibility',
            'No AI Tips'
        ],

        stripePriceId: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY
    },

    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        price: 199,
        priceYearly: 149,

        responsesPerMonth: 1000,
        activeInterviews: 15,
        users: 5,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
            conditionalLogic: false,
            customTemplates: false,

            watermark: false,
            customColor: true,
            customLogo: true,
            customDomain: false,
            whiteLabel: false,

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: true,
            comparison: true,
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'priority'
        },

        limits: {
            maxExchangesPerInterview: 30,
            maxTokensPerInterview: 100000,
            maxCharsPerUserMessage: 5000,
            inactivityTimeoutMinutes: 45,

            maxQuestionsPerInterview: 20,
            maxKnowledgeBaseChars: 500000,
            maxKnowledgeBaseFiles: 50,

            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,

            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            monthlyTokenBudget: 1000000,
            maxActiveChatbots: 3,
            maxVisibilityPrompts: 45,
            visibilityScansPerWeek: 1,
            maxManualScansPerDay: 10,
            maxBrandsTracked: 3,
            maxCompetitorsTracked: 3,
            aiTipsEnabled: true
        },
        marketingFeatures: [
            '1.000 interviste/mese',
            '15 Progetti attivi',
            '3 Chatbot (10.000 conv/mese)',
            '50 Knowledge Sources',
            'AI Tips inclusi',
            'Visibility: 3 Brand + 3 Competitor',
            '45 Prompt Visibility',
            'Scan Settimanale + 10 manuali/giorno'
        ],

        stripePriceId: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY
    },

    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        price: 399,
        priceYearly: 299,

        responsesPerMonth: 3000,
        activeInterviews: -1,  // Illimitate
        users: 15,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
            conditionalLogic: false,
            customTemplates: false,

            watermark: false,
            customColor: true,
            customLogo: true,
            customDomain: true,
            whiteLabel: true,

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: true,
            comparison: true,
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'dedicated'
        },

        limits: {
            maxExchangesPerInterview: 40,
            maxTokensPerInterview: 200000,
            maxCharsPerUserMessage: 8000,
            inactivityTimeoutMinutes: 60,

            maxQuestionsPerInterview: 30,
            maxKnowledgeBaseChars: 1000000,
            maxKnowledgeBaseFiles: 100,

            simulationsPerDayPerBot: 50,
            aiRegenerationsPerDay: 100,

            maxParallelInterviews: 200,
            messageCooldownSeconds: 0.5,
            monthlyTokenBudget: 3000000,
            maxActiveChatbots: 10,
            maxVisibilityPrompts: 75,
            visibilityScansPerWeek: 1,
            maxManualScansPerDay: 20,
            maxBrandsTracked: 5,
            maxCompetitorsTracked: 10,
            aiTipsEnabled: true
        },
        marketingFeatures: [
            '3.000 interviste/mese',
            'Progetti illimitati',
            '10 Chatbot (30.000 conv/mese)',
            'Visibility: 5 Brand + 10 Competitor',
            '75 Prompt Visibility',
            'White Label & Priority Support'
        ],

        stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
    }
};

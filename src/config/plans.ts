export enum PlanType {
    TRIAL = 'trial',
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business'
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
        name: 'Trial (Partner)',
        price: 0,
        priceYearly: 0,

        responsesPerMonth: -1, // Illimitate per partner
        activeInterviews: -1,  // Illimitate per partner
        users: 1,              // Senza gestione altri utenti

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
            conditionalLogic: true,
            customTemplates: true,

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
            segmentation: true,
            customDashboards: true,

            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: true,
            zapier: true,
            sso: false, // Potere di gestione utenti disabilitato

            supportLevel: 'priority'
        },

        limits: {
            maxExchangesPerInterview: 30,
            maxTokensPerInterview: 150000,
            maxCharsPerUserMessage: 5000,
            inactivityTimeoutMinutes: 60,

            maxQuestionsPerInterview: 20,
            maxKnowledgeBaseChars: 500000,
            maxKnowledgeBaseFiles: 20,

            simulationsPerDayPerBot: 50,
            aiRegenerationsPerDay: 100,

            maxParallelInterviews: 100,
            messageCooldownSeconds: 0.5,
            monthlyTokenBudget: 50000
        },
        marketingFeatures: [
            'Partner Full Access',
            'Illimitate interviste',
            'Full AI Features',
            'Solo uso personale',
            'No multi-user admin'
        ],

        stripePriceId: undefined,
        stripePriceIdYearly: undefined
    },

    [PlanType.STARTER]: {
        id: PlanType.STARTER,
        name: 'Starter',
        price: 49,
        priceYearly: 39,  // -20%

        responsesPerMonth: 100,
        activeInterviews: 3,
        users: 1,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: false,
            conditionalLogic: false,
            customTemplates: false,

            watermark: true,
            customColor: true,
            customLogo: false,
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
            maxExchangesPerInterview: 15,
            maxTokensPerInterview: 50000,
            maxCharsPerUserMessage: 2000,
            inactivityTimeoutMinutes: 30,

            maxQuestionsPerInterview: 10,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,

            simulationsPerDayPerBot: 5,
            aiRegenerationsPerDay: 10,

            maxParallelInterviews: 10,
            messageCooldownSeconds: 2,
            monthlyTokenBudget: 200000
        },
        marketingFeatures: [
            '3 interviste attive',
            '100 risposte/mese',
            'Analytics base',
            'Export PDF',
            '1 utente incluso'
        ],

        stripePriceId: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY
    },

    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        price: 149,
        priceYearly: 119,  // -20%

        responsesPerMonth: 300,
        activeInterviews: 10,
        users: 5,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,        // ⭐ Da Pro
            conditionalLogic: true,     // ⭐ Da Pro
            customTemplates: false,

            watermark: false,           // ⭐ Rimosso da Pro
            customColor: true,
            customLogo: true,           // ⭐ Da Pro
            customDomain: false,
            whiteLabel: false,

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: true,               // ⭐ Da Pro
            comparison: true,           // ⭐ Da Pro
            segmentation: false,
            customDashboards: false,

            exportPdf: true,
            exportCsv: true,            // ⭐ Da Pro
            webhooks: true,             // ⭐ Da Pro
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'priority'
        },

        limits: {
            maxExchangesPerInterview: 20,
            maxTokensPerInterview: 70000,
            maxCharsPerUserMessage: 3000,
            inactivityTimeoutMinutes: 45,

            maxQuestionsPerInterview: 15,
            maxKnowledgeBaseChars: 50000,
            maxKnowledgeBaseFiles: 3,

            simulationsPerDayPerBot: 10,
            aiRegenerationsPerDay: 25,

            maxParallelInterviews: 30,
            messageCooldownSeconds: 1,
            monthlyTokenBudget: 1000000
        },
        marketingFeatures: [
            '10 interviste attive',
            '300 risposte/mese',
            'Data Collection Mode (Recruitment/Lead)',
            'Custom Branding & Landing',
            'AI Analysis Avanzata',
            'Export CSV + Webhook'
        ],

        stripePriceId: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY
    },

    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        price: 299,
        priceYearly: 239,  // -20%

        responsesPerMonth: 1000,
        activeInterviews: -1,  // Illimitate
        users: 15,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
            conditionalLogic: true,
            customTemplates: true,      // ⭐ Solo Business

            watermark: false,
            customColor: true,
            customLogo: true,
            customDomain: true,         // ⭐ Solo Business
            whiteLabel: true,           // ⭐ Solo Business

            basicStats: true,
            transcripts: true,
            sentiment: true,
            themeExtraction: true,
            keyQuotes: true,
            trends: true,
            comparison: true,
            segmentation: true,         // ⭐ Solo Business
            customDashboards: true,     // ⭐ Solo Business

            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: true,            // ⭐ Solo Business
            zapier: true,               // ⭐ Solo Business
            sso: true,                  // ⭐ Solo Business

            supportLevel: 'dedicated'
        },

        limits: {
            maxExchangesPerInterview: 25,
            maxTokensPerInterview: 100000,
            maxCharsPerUserMessage: 5000,
            inactivityTimeoutMinutes: 60,

            maxQuestionsPerInterview: 20,
            maxKnowledgeBaseChars: 200000,
            maxKnowledgeBaseFiles: 10,

            simulationsPerDayPerBot: 20,
            aiRegenerationsPerDay: 50,

            maxParallelInterviews: 100,
            messageCooldownSeconds: 0.5,
            monthlyTokenBudget: 5000000
        },
        marketingFeatures: [
            'Illimitate interviste',
            '1.000+ risposte/mese',
            'Data Collection Illimitata',
            'Full White Label & API',
            'Supporto Prioritario',
            '15 utenti inclusi'
        ],

        stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
    }
};

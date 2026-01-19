export enum PlanType {
    TRIAL = 'trial',
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business',
    PARTNER = 'partner'
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

        responsesPerMonth: 300,
        activeInterviews: 1,
        users: 1,

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
            maxTokensPerInterview: 150000,
            maxCharsPerUserMessage: 5000,
            inactivityTimeoutMinutes: 60,

            maxQuestionsPerInterview: 20,
            maxKnowledgeBaseChars: 100000,
            maxKnowledgeBaseFiles: 10,

            simulationsPerDayPerBot: 50,
            aiRegenerationsPerDay: 100,

            maxParallelInterviews: 100,
            messageCooldownSeconds: 0.5,
            monthlyTokenBudget: 500000,
            maxActiveChatbots: 1
        },
        marketingFeatures: [
            '14 giorni di prova gratuita',
            'Accesso a tutte le funzioni PRO',
            'Supporto prioritario',
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
            maxKnowledgeBaseFiles: 10,

            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,

            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            monthlyTokenBudget: 1000000,
            maxActiveChatbots: 3
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
        priceYearly: 55,  // ~20% discount

        responsesPerMonth: 300,
        activeInterviews: 5,
        users: 2,

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
            maxExchangesPerInterview: 20,
            maxTokensPerInterview: 60000,
            maxCharsPerUserMessage: 3000,
            inactivityTimeoutMinutes: 30,

            maxQuestionsPerInterview: 12,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,

            simulationsPerDayPerBot: 10,
            aiRegenerationsPerDay: 20,

            maxParallelInterviews: 15,
            messageCooldownSeconds: 2,
            monthlyTokenBudget: 200000,
            maxActiveChatbots: 0
        },
        marketingFeatures: [
            '5 interviste attive',
            '300 risposte/mese',
            'Analytics base',
            'Export PDF',
            '2 utenti inclusi'
        ],

        stripePriceId: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY
    },

    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        price: 199,
        priceYearly: 159,  // ~20% discount

        responsesPerMonth: 1000,
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
            maxKnowledgeBaseFiles: 10,

            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,

            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            monthlyTokenBudget: 1000000,
            maxActiveChatbots: 3
        },
        marketingFeatures: [
            '20 interviste attive',
            '1.000 risposte/mese',
            'Fino a 3 Chatbot AI',
            'Data Collection Mode (Recruitment/Lead)',
            'Custom Branding & Logo',
            'Knowledge Base & Knowledge Gaps',
            'AI Analysis Avanzata',
            'Export CSV + Webhook'
        ],

        stripePriceId: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY
    },

    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        price: 399,
        priceYearly: 319,  // ~20% discount

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
            maxKnowledgeBaseChars: 500000,
            maxKnowledgeBaseFiles: 25,

            simulationsPerDayPerBot: 50,
            aiRegenerationsPerDay: 100,

            maxParallelInterviews: 200,
            messageCooldownSeconds: 0.5,
            monthlyTokenBudget: 5000000,
            maxActiveChatbots: -1
        },
        marketingFeatures: [
            'Interviste illimitate',
            '3.000 risposte/mese',
            'Chatbot illimitati',
            'Visibility AI & Web',
            'Cross-Channel Insights',
            'Full White Label',
            'Success Manager dedicato'
        ],

        stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
    }
};

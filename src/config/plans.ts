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
}

export const PLANS: Record<PlanType, PlanConfig> = {
    [PlanType.TRIAL]: {
        id: PlanType.TRIAL,
        name: 'Trial',
        price: 0,
        priceYearly: 0,

        responsesPerMonth: 10,
        activeInterviews: 1,
        users: 1,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: false,
            manualEdit: false,
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

            exportPdf: false,
            exportCsv: false,
            webhooks: false,
            apiAccess: false,
            zapier: false,
            sso: false,

            supportLevel: 'community'
        },

        limits: {
            maxExchangesPerInterview: 10,
            maxTokensPerInterview: 30000,
            maxCharsPerUserMessage: 1000,
            inactivityTimeoutMinutes: 20,

            maxQuestionsPerInterview: 6,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,

            simulationsPerDayPerBot: 2,
            aiRegenerationsPerDay: 3,

            maxParallelInterviews: 2,
            messageCooldownSeconds: 3
        }
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
            messageCooldownSeconds: 2
        }
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
            messageCooldownSeconds: 1
        }
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
            messageCooldownSeconds: 0.5
        }
    }
};

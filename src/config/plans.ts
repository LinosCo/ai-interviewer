export enum PlanType {
    TRIAL = 'trial',
    FREE = 'free',
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business',
    PARTNER = 'partner',
    ENTERPRISE = 'enterprise',
    ADMIN = 'admin'
}

// Map SubscriptionTier (Prisma) to PlanType (config)
export function subscriptionTierToPlanType(tier: string): PlanType {
    const mapping: Record<string, PlanType> = {
        'TRIAL': PlanType.TRIAL,
        'FREE': PlanType.FREE,
        'STARTER': PlanType.STARTER,
        'PRO': PlanType.PRO,
        'BUSINESS': PlanType.BUSINESS,
        'ENTERPRISE': PlanType.ENTERPRISE,
        'PARTNER': PlanType.PARTNER,
        'ADMIN': PlanType.ADMIN,
    };
    return mapping[tier] || PlanType.TRIAL;
}

// Helper per check limiti infiniti (-1 = illimitato)
export function isUnlimited(value: number): boolean {
    return value === -1;
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
    // Conversazione
    maxExchangesPerInterview: number;
    maxTokensPerInterview: number;
    maxCharsPerUserMessage: number;
    inactivityTimeoutMinutes: number;

    // Risorse mensili
    monthlyTokenBudget: number;
    maxInterviewsPerMonth: number;
    maxChatbotSessionsPerMonth: number;
    maxVisibilityQueriesPerMonth: number;
    maxAiSuggestionsPerMonth: number;

    // Configurazione
    maxActiveBots: number;
    maxActiveProjects: number;
    maxUsers: number;
    maxKnowledgeBaseChars: number;
    maxKnowledgeBaseFiles: number;
    maxQuestionsPerInterview: number;

    // Visibility
    maxVisibilityPrompts: number;
    visibilityScansPerWeek: number;
    maxManualScansPerDay: number;
    maxBrandsTracked: number;
    maxCompetitorsTracked: number;

    // Rate limits
    maxParallelInterviews: number;
    messageCooldownSeconds: number;
    simulationsPerDayPerBot: number;
    aiRegenerationsPerDay: number;

    // Features
    aiTipsEnabled: boolean;
    visibilityEnabled: boolean;
    crossChannelEnabled: boolean;
    canTransferProjects: boolean;
}

export interface PlanConfig {
    id: PlanType;
    name: string;
    price: number | null;    // €/mese, null = custom/contact sales
    priceYearly: number | null;
    isInternal?: boolean;    // Per piani non acquistabili
    trialDays?: number;
    contactSales?: boolean;
    popular?: boolean;

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
    // ═══════════════════════════════════════════
    // ADMIN - Staff Voler.ai
    // ═══════════════════════════════════════════
    [PlanType.ADMIN]: {
        id: PlanType.ADMIN,
        name: 'Admin',
        price: 0,
        priceYearly: 0,
        isInternal: true,

        responsesPerMonth: -1,
        activeInterviews: -1,
        users: -1,

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
            sso: true,
            supportLevel: 'dedicated'
        },

        limits: {
            maxExchangesPerInterview: 100,
            maxTokensPerInterview: 500000,
            maxCharsPerUserMessage: 20000,
            inactivityTimeoutMinutes: 120,
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,
            maxActiveBots: -1,
            maxActiveProjects: -1,
            maxUsers: -1,
            maxKnowledgeBaseChars: -1,
            maxKnowledgeBaseFiles: -1,
            maxQuestionsPerInterview: 100,
            maxVisibilityPrompts: -1,
            visibilityScansPerWeek: -1,
            maxManualScansPerDay: -1,
            maxBrandsTracked: -1,
            maxCompetitorsTracked: -1,
            maxParallelInterviews: 1000,
            messageCooldownSeconds: 0,
            simulationsPerDayPerBot: -1,
            aiRegenerationsPerDay: -1,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: true,
            canTransferProjects: true
        },

        marketingFeatures: ['Accesso interno staff']
    },

    // ═══════════════════════════════════════════
    // PARTNER - Lifetime gratuito
    // ═══════════════════════════════════════════
    [PlanType.PARTNER]: {
        id: PlanType.PARTNER,
        name: 'Partner',
        price: 0,
        priceYearly: 0,
        isInternal: true,

        responsesPerMonth: 400,
        activeInterviews: -1,
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
            monthlyTokenBudget: 25000000,
            maxInterviewsPerMonth: 400,
            maxChatbotSessionsPerMonth: 4000,
            maxVisibilityQueriesPerMonth: 800,
            maxAiSuggestionsPerMonth: 25,
            maxActiveBots: 3,
            maxActiveProjects: -1,
            maxUsers: 5,
            maxKnowledgeBaseChars: 500000,
            maxKnowledgeBaseFiles: 50,
            maxQuestionsPerInterview: 20,
            maxVisibilityPrompts: 45,
            visibilityScansPerWeek: 1,
            maxManualScansPerDay: 10,
            maxBrandsTracked: 3,
            maxCompetitorsTracked: 3,
            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: true,
            canTransferProjects: true
        },

        marketingFeatures: [
            'Piano Partner Lifetime',
            'Progetti illimitati',
            'Trasferimento progetti',
            'Tutte le funzioni PRO'
        ]
    },

    // ═══════════════════════════════════════════
    // TRIAL - 14 giorni PRO
    // ═══════════════════════════════════════════
    [PlanType.TRIAL]: {
        id: PlanType.TRIAL,
        name: 'Trial PRO',
        price: 0,
        priceYearly: 0,
        trialDays: 14,

        responsesPerMonth: 50,
        activeInterviews: 3,
        users: 1,

        features: {
            aiGeneration: true,
            basicTemplates: true,
            advancedTemplates: true,
            manualEdit: true,
            knowledgeBase: true,
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
            trends: true,
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
            monthlyTokenBudget: 2000000,
            maxInterviewsPerMonth: 50,
            maxChatbotSessionsPerMonth: 200,
            maxVisibilityQueriesPerMonth: 50,
            maxAiSuggestionsPerMonth: 5,
            maxActiveBots: 1,
            maxActiveProjects: 2,
            maxUsers: 1,
            maxKnowledgeBaseChars: 50000,
            maxKnowledgeBaseFiles: 5,
            maxQuestionsPerInterview: 12,
            maxVisibilityPrompts: 10,
            visibilityScansPerWeek: 1,
            maxManualScansPerDay: 2,
            maxBrandsTracked: 1,
            maxCompetitorsTracked: 1,
            maxParallelInterviews: 5,
            messageCooldownSeconds: 2,
            simulationsPerDayPerBot: 5,
            aiRegenerationsPerDay: 10,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: false,
            canTransferProjects: false
        },

        marketingFeatures: [
            '14 giorni gratis',
            'Tutte le funzioni PRO',
            'Nessuna carta richiesta'
        ]
    },

    // ═══════════════════════════════════════════
    // FREE - Post-trial
    // ═══════════════════════════════════════════
    [PlanType.FREE]: {
        id: PlanType.FREE,
        name: 'Free',
        price: 0,
        priceYearly: 0,

        responsesPerMonth: 20,
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
            maxTokensPerInterview: 40000,
            maxCharsPerUserMessage: 1500,
            inactivityTimeoutMinutes: 20,
            monthlyTokenBudget: 400000,
            maxInterviewsPerMonth: 20,
            maxChatbotSessionsPerMonth: 0,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,
            maxActiveBots: 0,
            maxActiveProjects: 1,
            maxUsers: 1,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,
            maxQuestionsPerInterview: 8,
            maxVisibilityPrompts: 0,
            visibilityScansPerWeek: 0,
            maxManualScansPerDay: 0,
            maxBrandsTracked: 0,
            maxCompetitorsTracked: 0,
            maxParallelInterviews: 2,
            messageCooldownSeconds: 3,
            simulationsPerDayPerBot: 2,
            aiRegenerationsPerDay: 5,
            aiTipsEnabled: false,
            visibilityEnabled: false,
            crossChannelEnabled: false,
            canTransferProjects: false
        },

        marketingFeatures: [
            '20 interviste/mese',
            '1 progetto',
            'Analytics base',
            'Per sempre gratuito'
        ]
    },

    // ═══════════════════════════════════════════
    // STARTER - €69/mese
    // ═══════════════════════════════════════════
    [PlanType.STARTER]: {
        id: PlanType.STARTER,
        name: 'Starter',
        price: 69,
        priceYearly: 49,

        responsesPerMonth: 100,
        activeInterviews: 5,
        users: 2,

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
            monthlyTokenBudget: 4000000,
            maxInterviewsPerMonth: 100,
            maxChatbotSessionsPerMonth: 500,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,
            maxActiveBots: 1,
            maxActiveProjects: 3,
            maxUsers: 2,
            maxKnowledgeBaseChars: 100000,
            maxKnowledgeBaseFiles: 10,
            maxQuestionsPerInterview: 12,
            maxVisibilityPrompts: 0,
            visibilityScansPerWeek: 0,
            maxManualScansPerDay: 0,
            maxBrandsTracked: 0,
            maxCompetitorsTracked: 0,
            maxParallelInterviews: 15,
            messageCooldownSeconds: 2,
            simulationsPerDayPerBot: 10,
            aiRegenerationsPerDay: 20,
            aiTipsEnabled: false,
            visibilityEnabled: false,
            crossChannelEnabled: false,
            canTransferProjects: false
        },

        marketingFeatures: [
            '100 interviste/mese',
            '5 progetti attivi',
            '1 Chatbot (500 sessioni)',
            'Analytics completi',
            '2 utenti'
        ],

        stripePriceId: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY
    },

    // ═══════════════════════════════════════════
    // PRO - €199/mese
    // ═══════════════════════════════════════════
    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        price: 199,
        priceYearly: 149,
        popular: true,

        responsesPerMonth: 400,
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
            monthlyTokenBudget: 25000000,
            maxInterviewsPerMonth: 400,
            maxChatbotSessionsPerMonth: 4000,
            maxVisibilityQueriesPerMonth: 800,
            maxAiSuggestionsPerMonth: 25,
            maxActiveBots: 3,
            maxActiveProjects: 10,
            maxUsers: 5,
            maxKnowledgeBaseChars: 500000,
            maxKnowledgeBaseFiles: 50,
            maxQuestionsPerInterview: 20,
            maxVisibilityPrompts: 45,
            visibilityScansPerWeek: 1,
            maxManualScansPerDay: 10,
            maxBrandsTracked: 3,
            maxCompetitorsTracked: 3,
            maxParallelInterviews: 50,
            messageCooldownSeconds: 1,
            simulationsPerDayPerBot: 25,
            aiRegenerationsPerDay: 50,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: true,
            canTransferProjects: false
        },

        marketingFeatures: [
            '400 interviste/mese',
            '15 progetti attivi',
            '3 Chatbot (4.000 sessioni)',
            'Visibility Tracker',
            'AI Tips',
            '5 utenti'
        ],

        stripePriceId: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY
    },

    // ═══════════════════════════════════════════
    // BUSINESS - €399/mese
    // ═══════════════════════════════════════════
    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        price: 399,
        priceYearly: 299,

        responsesPerMonth: 1000,
        activeInterviews: -1,
        users: 15,

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
            customDashboards: false,
            exportPdf: true,
            exportCsv: true,
            webhooks: true,
            apiAccess: true,
            zapier: true,
            sso: false,
            supportLevel: 'dedicated'
        },

        limits: {
            maxExchangesPerInterview: 40,
            maxTokensPerInterview: 200000,
            maxCharsPerUserMessage: 8000,
            inactivityTimeoutMinutes: 60,
            monthlyTokenBudget: 70000000,
            maxInterviewsPerMonth: 1000,
            maxChatbotSessionsPerMonth: 12000,
            maxVisibilityQueriesPerMonth: 4000,
            maxAiSuggestionsPerMonth: 100,
            maxActiveBots: 10,
            maxActiveProjects: -1,
            maxUsers: 15,
            maxKnowledgeBaseChars: 1000000,
            maxKnowledgeBaseFiles: 100,
            maxQuestionsPerInterview: 30,
            maxVisibilityPrompts: 75,
            visibilityScansPerWeek: 7,
            maxManualScansPerDay: 20,
            maxBrandsTracked: 5,
            maxCompetitorsTracked: 10,
            maxParallelInterviews: 200,
            messageCooldownSeconds: 0.5,
            simulationsPerDayPerBot: 50,
            aiRegenerationsPerDay: 100,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: true,
            canTransferProjects: false
        },

        marketingFeatures: [
            '1.000 interviste/mese',
            'Progetti illimitati',
            '10 Chatbot (12.000 sessioni)',
            'Visibility avanzata',
            'White Label',
            'API Access',
            '15 utenti'
        ],

        stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY
    },

    // ═══════════════════════════════════════════
    // ENTERPRISE - Custom
    // ═══════════════════════════════════════════
    [PlanType.ENTERPRISE]: {
        id: PlanType.ENTERPRISE,
        name: 'Enterprise',
        price: null,
        priceYearly: null,
        contactSales: true,

        responsesPerMonth: -1,
        activeInterviews: -1,
        users: -1,

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
            sso: true,
            supportLevel: 'dedicated'
        },

        limits: {
            maxExchangesPerInterview: 100,
            maxTokensPerInterview: 500000,
            maxCharsPerUserMessage: 20000,
            inactivityTimeoutMinutes: 120,
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,
            maxActiveBots: -1,
            maxActiveProjects: -1,
            maxUsers: -1,
            maxKnowledgeBaseChars: -1,
            maxKnowledgeBaseFiles: -1,
            maxQuestionsPerInterview: 100,
            maxVisibilityPrompts: -1,
            visibilityScansPerWeek: -1,
            maxManualScansPerDay: -1,
            maxBrandsTracked: -1,
            maxCompetitorsTracked: -1,
            maxParallelInterviews: 1000,
            messageCooldownSeconds: 0,
            simulationsPerDayPerBot: -1,
            aiRegenerationsPerDay: -1,
            aiTipsEnabled: true,
            visibilityEnabled: true,
            crossChannelEnabled: true,
            canTransferProjects: true
        },

        marketingFeatures: [
            'Tutto illimitato',
            'SSO / SAML',
            'SLA garantito',
            'Account manager dedicato',
            'Formazione team',
            'Integrazioni custom'
        ]
    }
};

// Helper per ottenere piani pubblici (acquistabili)
export function getPublicPlans(): PlanConfig[] {
    return Object.values(PLANS).filter(p => !p.isInternal && !p.contactSales);
}

// Helper per ottenere tutti i piani visualizzabili nel pricing
export function getPricingPlans(): PlanConfig[] {
    return Object.values(PLANS).filter(p => !p.isInternal);
}

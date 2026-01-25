export enum PlanType {
    TRIAL = 'TRIAL',
    FREE = 'FREE',
    STARTER = 'STARTER',
    PRO = 'PRO',
    BUSINESS = 'BUSINESS',
    ENTERPRISE = 'ENTERPRISE',
    PARTNER = 'PARTNER',
    ADMIN = 'ADMIN'
}

export interface PlanLimits {
    monthlyTokenBudget: number;        // -1 = illimitato
    maxInterviewsPerMonth: number;
    maxChatbotSessionsPerMonth: number;
    maxVisibilityQueriesPerMonth: number;
    maxAiSuggestionsPerMonth: number;
    maxProjects: number;
    maxUsers: number;
    maxChatbots: number;
    maxBrands: number;                 // Max brand monitor configurations (-1 = unlimited)
    maxCmsConnections: number;         // Max CMS integrations (-1 = unlimited)

    // Features boolean
    visibilityEnabled: boolean;
    aiTipsEnabled: boolean;
    apiAccessEnabled: boolean;
    whiteLabelEnabled: boolean;
    canTransferProjects: boolean;
}

export interface PlanConfig {
    id: PlanType;
    name: string;
    description: string;

    // Prezzi
    monthlyPrice: number;           // In EUR, 0 per gratuiti
    yearlyPrice: number;            // Prezzo annuale totale
    yearlyMonthlyEquivalent: number; // Prezzo mensile equivalente

    // Stripe Price IDs
    stripePriceIdMonthly?: string;
    stripePriceIdYearly?: string;

    limits: PlanLimits;

    // Marketing
    popular?: boolean;
    features: string[];
}

export const PLANS: Record<PlanType, PlanConfig> = {
    [PlanType.TRIAL]: {
        id: PlanType.TRIAL,
        name: 'Trial',
        description: 'Prova gratuita 14 giorni',
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        limits: {
            monthlyTokenBudget: 2_000_000,
            maxInterviewsPerMonth: 50,
            maxChatbotSessionsPerMonth: 200,
            maxVisibilityQueriesPerMonth: 50,
            maxAiSuggestionsPerMonth: 5,
            maxProjects: 2,
            maxUsers: 1,
            maxChatbots: 1,
            maxBrands: 1,
            maxCmsConnections: 0,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: false,
            whiteLabelEnabled: false,
            canTransferProjects: false
        },
        features: [
            '50 interviste',
            '1 chatbot (200 sessioni)',
            'Visibility base',
            '14 giorni gratis'
        ]
    },

    [PlanType.FREE]: {
        id: PlanType.FREE,
        name: 'Free',
        description: 'Per sempre gratuito',
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        limits: {
            monthlyTokenBudget: 400_000,
            maxInterviewsPerMonth: 20,
            maxChatbotSessionsPerMonth: 0,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,
            maxProjects: 1,
            maxUsers: 1,
            maxChatbots: 0,
            maxBrands: 0,
            maxCmsConnections: 0,
            visibilityEnabled: false,
            aiTipsEnabled: false,
            apiAccessEnabled: false,
            whiteLabelEnabled: false,
            canTransferProjects: false
        },
        features: [
            '20 interviste/mese',
            '1 progetto',
            'Analytics base',
            'Export PDF (watermark)'
        ]
    },

    [PlanType.STARTER]: {
        id: PlanType.STARTER,
        name: 'Starter',
        description: 'Per team piccoli',
        monthlyPrice: 69,
        yearlyPrice: 588,
        yearlyMonthlyEquivalent: 49,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
        limits: {
            monthlyTokenBudget: 4_000_000,
            maxInterviewsPerMonth: 100,
            maxChatbotSessionsPerMonth: 500,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,
            maxProjects: 3,
            maxUsers: 2,
            maxChatbots: 1,
            maxBrands: 0,
            maxCmsConnections: 0,
            visibilityEnabled: false,
            aiTipsEnabled: false,
            apiAccessEnabled: false,
            whiteLabelEnabled: false,
            canTransferProjects: false
        },
        features: [
            '100 interviste/mese',
            '1 chatbot (500 sessioni)',
            '3 progetti',
            '2 utenti',
            'Analytics completi',
            'Export PDF/CSV'
        ]
    },

    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        description: 'Per team in crescita',
        monthlyPrice: 199,
        yearlyPrice: 1788,
        yearlyMonthlyEquivalent: 149,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
        popular: true,
        limits: {
            monthlyTokenBudget: 25_000_000,
            maxInterviewsPerMonth: 400,
            maxChatbotSessionsPerMonth: 4000,
            maxVisibilityQueriesPerMonth: 800,
            maxAiSuggestionsPerMonth: 25,
            maxProjects: 10,
            maxUsers: 5,
            maxChatbots: 3,
            maxBrands: 3,
            maxCmsConnections: 1,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: false,
            whiteLabelEnabled: false,
            canTransferProjects: false
        },
        features: [
            '400 interviste/mese',
            '3 chatbot (4.000 sessioni)',
            'Brand Monitor (3 brand)',
            'AI Tips',
            '10 progetti',
            '5 utenti'
        ]
    },

    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        description: 'Per aziende',
        monthlyPrice: 399,
        yearlyPrice: 3588,
        yearlyMonthlyEquivalent: 299,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
        limits: {
            monthlyTokenBudget: 70_000_000,
            maxInterviewsPerMonth: 1000,
            maxChatbotSessionsPerMonth: 12000,
            maxVisibilityQueriesPerMonth: 4000,
            maxAiSuggestionsPerMonth: 100,
            maxProjects: -1, // Illimitati
            maxUsers: 15,
            maxChatbots: 10,
            maxBrands: 10,
            maxCmsConnections: 5,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: true,
            whiteLabelEnabled: true,
            canTransferProjects: false
        },
        features: [
            '1.000 interviste/mese',
            '10 chatbot (12.000 sessioni)',
            'Brand Monitor (10 brand)',
            'Visibility avanzata',
            'White Label',
            'API Access',
            'CMS Integrations (5)',
            'Progetti illimitati',
            '15 utenti'
        ]
    },

    [PlanType.PARTNER]: {
        id: PlanType.PARTNER,
        name: 'Partner',
        description: 'Piano partner lifetime',
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        limits: {
            monthlyTokenBudget: 25_000_000, // Come PRO
            maxInterviewsPerMonth: 400,
            maxChatbotSessionsPerMonth: 4000,
            maxVisibilityQueriesPerMonth: 800,
            maxAiSuggestionsPerMonth: 25,
            maxProjects: -1, // ILLIMITATI
            maxUsers: 10,
            maxChatbots: 5,
            maxBrands: 5,
            maxCmsConnections: 2,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: false,
            whiteLabelEnabled: false,
            canTransferProjects: true // PUÒ TRASFERIRE PROGETTI
        },
        features: [
            'Tutte le funzioni PRO',
            'Brand Monitor (5 brand)',
            'Progetti illimitati',
            'Trasferimento progetti',
            'Gratuito lifetime'
        ]
    },

    [PlanType.ADMIN]: {
        id: PlanType.ADMIN,
        name: 'Admin',
        description: 'Staff Voler.ai',
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        limits: {
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,
            maxProjects: -1,
            maxUsers: -1,
            maxChatbots: -1,
            maxBrands: -1,
            maxCmsConnections: -1,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: true,
            whiteLabelEnabled: true,
            canTransferProjects: true
        },
        features: ['Tutto illimitato']
    },

    [PlanType.ENTERPRISE]: {
        id: PlanType.ENTERPRISE,
        name: 'Enterprise',
        description: 'Soluzioni personalizzate',
        monthlyPrice: 0, // Custom
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        limits: {
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,
            maxProjects: -1,
            maxUsers: -1,
            maxChatbots: -1,
            maxBrands: -1,
            maxCmsConnections: -1,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            apiAccessEnabled: true,
            whiteLabelEnabled: true,
            canTransferProjects: true
        },
        features: [
            'Tutto illimitato',
            'SSO / SAML',
            'SLA garantito',
            'Account manager dedicato'
        ]
    }
};

// Helper
export function isUnlimited(value: number): boolean {
    return value === -1;
}

export function getPlanByTier(tier: string): PlanConfig {
    return PLANS[tier as PlanType] || PLANS[PlanType.FREE];
}

export function subscriptionTierToPlanType(tier: string): PlanType {
    return tier as PlanType;
}

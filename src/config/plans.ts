/**
 * Sistema Piani - Basato su Crediti
 *
 * I piani sono per utente (non per organizzazione).
 * Ogni piano ha un budget di crediti mensili.
 * Le feature sono illimitate quando disponibili, ma consumano crediti.
 * I crediti si resettano mensilmente (non si accumulano).
 * I pack crediti acquistati non scadono.
 */

export enum PlanType {
    FREE = 'FREE',
    TRIAL = 'TRIAL',
    STARTER = 'STARTER',
    PRO = 'PRO',
    BUSINESS = 'BUSINESS',
    PARTNER = 'PARTNER',
    ENTERPRISE = 'ENTERPRISE',
    ADMIN = 'ADMIN'
}

/**
 * Feature disponibili per piano
 * - boolean: abilitato/disabilitato
 * - 'base' | 'full': livello funzionalità
 * - 'watermark' | 'clean': tipo export
 * - 'conditional': dipende da condizioni (es. partner con 10+ clienti)
 */
export interface PlanFeatures {
    interviewAI: 'base' | 'full';
    chatbot: boolean;
    visibilityTracker: boolean;
    aiTips: boolean;
    copilotStrategico: boolean;
    whiteLabel: boolean | 'conditional';
    apiAccess: boolean;
    cmsIntegrations: boolean;
    exportPdf: 'watermark' | 'clean';
    exportCsv: boolean;
    analytics: 'base' | 'full';
    canTransferProjects: boolean;
    maxProjects: number;  // -1 = illimitati
    // Partner-exclusive features
    multiClientDashboard?: boolean;
    customLogoReports?: boolean;
}

/**
 * Legacy limits interface for backward compatibility
 * These are derived from monthlyCredits and features
 */
export interface PlanLimits {
    monthlyTokenBudget: number;
    maxInterviewsPerMonth: number;
    maxChatbots: number;
    maxChatbotSessionsPerMonth: number;
    maxVisibilityQueriesPerMonth: number;
    maxAiSuggestionsPerMonth: number;

    visibilityEnabled: boolean;
    aiTipsEnabled: boolean;
    whiteLabelEnabled: boolean;
    apiAccessEnabled: boolean;
    canTransferProjects: boolean;
    customLogo: boolean;
    customColor: boolean;
    themeExtraction: boolean;
    knowledgeBase: boolean;
    conditionalLogic: boolean;
}

export interface PlanConfig {
    id: PlanType;
    name: string;
    description: string;

    // Crediti mensili
    monthlyCredits: number;  // -1 = illimitato

    // Prezzi
    monthlyPrice: number;           // In EUR, 0 per gratuiti
    yearlyPrice: number;            // Prezzo annuale totale
    yearlyMonthlyEquivalent: number; // Prezzo mensile equivalente

    // Stripe Price IDs
    stripePriceIdMonthly?: string;
    stripePriceIdYearly?: string;

    // Feature disponibili
    features: PlanFeatures;

    // Legacy limits (for backward compatibility)
    limits: PlanLimits;

    // Marketing
    popular?: boolean;
    featureList: string[];  // Lista testuale per UI
}

export const PLANS: Record<PlanType, PlanConfig> = {
    [PlanType.FREE]: {
        id: PlanType.FREE,
        name: 'Free',
        description: 'Per sempre gratuito',
        monthlyCredits: 500,
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        features: {
            interviewAI: 'base',
            chatbot: false,
            visibilityTracker: false,
            aiTips: false,
            copilotStrategico: false,
            whiteLabel: false,
            apiAccess: false,
            cmsIntegrations: false,
            exportPdf: 'watermark',
            exportCsv: false,
            analytics: 'base',
            canTransferProjects: false,
            maxProjects: 1
        },
        limits: {
            monthlyTokenBudget: 500,
            maxInterviewsPerMonth: -1,
            maxChatbots: 0,
            maxChatbotSessionsPerMonth: 0,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,

            visibilityEnabled: false,
            aiTipsEnabled: false,
            whiteLabelEnabled: false,
            apiAccessEnabled: false,
            canTransferProjects: false,
            customLogo: false,
            customColor: false,
            themeExtraction: false,
            knowledgeBase: false,
            conditionalLogic: false
        },
        featureList: [
            '500 crediti/mese',
            'Interview AI base',
            '1 progetto',
            'Analytics base',
            'Export PDF (watermark)'
        ]
    },

    [PlanType.TRIAL]: {
        id: PlanType.TRIAL,
        name: 'Trial',
        description: 'Prova gratuita 14 giorni',
        monthlyCredits: 2_000,
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: false,
            apiAccess: false,
            cmsIntegrations: false,
            exportPdf: 'watermark',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: false,
            maxProjects: -1
        },
        limits: {
            monthlyTokenBudget: 2_000,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: 100,
            maxAiSuggestionsPerMonth: 50,

            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: false,
            apiAccessEnabled: false,
            canTransferProjects: false,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: false,
            conditionalLogic: false
        },
        featureList: [
            '2K crediti per 14 giorni',
            'Tutte le funzionalità PRO',
            'Progetti illimitati',
            'Prova gratuita completa'
        ]
    },

    [PlanType.STARTER]: {
        id: PlanType.STARTER,
        name: 'Starter',
        description: 'Per iniziare',
        monthlyCredits: 6_000,
        monthlyPrice: 69,
        yearlyPrice: 588,
        yearlyMonthlyEquivalent: 49,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: false,
            aiTips: false,
            copilotStrategico: false,
            whiteLabel: false,
            apiAccess: false,
            cmsIntegrations: false,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: false,
            maxProjects: -1
        },
        limits: {
            monthlyTokenBudget: 6_000,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: 0,
            maxAiSuggestionsPerMonth: 0,

            visibilityEnabled: false,
            aiTipsEnabled: false,
            whiteLabelEnabled: false,
            apiAccessEnabled: false,
            canTransferProjects: false,
            customLogo: false,
            customColor: false,
            themeExtraction: false,
            knowledgeBase: false,
            conditionalLogic: false
        },
        featureList: [
            '6K crediti/mese',
            'Interview AI completo',
            'Chatbot illimitati',
            'Progetti illimitati',
            'Analytics completi',
            'Export PDF/CSV puliti'
        ]
    },

    [PlanType.PRO]: {
        id: PlanType.PRO,
        name: 'Pro',
        description: 'Per professionisti',
        monthlyCredits: 20_000,
        monthlyPrice: 199,
        yearlyPrice: 1788,
        yearlyMonthlyEquivalent: 149,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
        popular: true,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: false,
            apiAccess: false,
            cmsIntegrations: false,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: false,
            maxProjects: -1
        },
        limits: {
            monthlyTokenBudget: 20_000,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: 200,
            maxAiSuggestionsPerMonth: 100,

            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: false,
            apiAccessEnabled: false,
            canTransferProjects: false,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: true,
            conditionalLogic: true
        },
        featureList: [
            '20K crediti/mese',
            'Interview AI completo',
            'Chatbot illimitati',
            'Brand Monitor',
            'AI Tips',
            'Copilot Strategico',
            'Progetti illimitati',
            'Analytics avanzati',
            'Integra G.Analytics e Search Console'
        ]
    },

    [PlanType.BUSINESS]: {
        id: PlanType.BUSINESS,
        name: 'Business',
        description: 'Per aziende',
        monthlyCredits: 50_000,
        monthlyPrice: 399,
        yearlyPrice: 3588,
        yearlyMonthlyEquivalent: 299,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS,
        stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: true,
            apiAccess: true,
            cmsIntegrations: true,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: false,
            maxProjects: -1
        },
        limits: {
            monthlyTokenBudget: 50_000,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: 500,
            maxAiSuggestionsPerMonth: 200,

            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: true,
            apiAccessEnabled: true,
            canTransferProjects: true,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: true,
            conditionalLogic: true
        },
        featureList: [
            '50K crediti/mese',
            'Tutte le funzionalità PRO',
            'White Label',
            'API Access',
            'CMS Integrations',
            'Integrazioni CMS su misura',
            'Progetti illimitati',
            'Automatizza il tuo sito',
            'Supporto prioritario'
        ]
    },

    [PlanType.PARTNER]: {
        id: PlanType.PARTNER,
        name: 'Partner',
        description: 'Per agenzie e consulenti',
        monthlyCredits: 10_000,
        monthlyPrice: 29, // €0 con 3+ clienti attivi
        yearlyPrice: 348,
        yearlyMonthlyEquivalent: 29,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PARTNER,
        stripePriceIdYearly: process.env.STRIPE_PRICE_PARTNER_YEARLY,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: 'conditional', // Con 10+ clienti
            apiAccess: false,
            cmsIntegrations: false,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: true,
            maxProjects: -1,
            multiClientDashboard: true,
            customLogoReports: true
        },
        limits: {
            monthlyTokenBudget: 10_000,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: 200,
            maxAiSuggestionsPerMonth: 100,

            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: false,
            apiAccessEnabled: false,
            canTransferProjects: false,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: true,
            conditionalLogic: true
        },
        featureList: [
            '10K crediti/mese',
            'Tutte le funzionalità PRO',
            'Trasferimento progetti',
            'Dashboard multi-cliente',
            'Report con logo personalizzato',
            '€0/mese con 3+ clienti',
            'White Label con 10+ clienti'
        ]
    },

    [PlanType.ENTERPRISE]: {
        id: PlanType.ENTERPRISE,
        name: 'Enterprise',
        description: 'Per grandi organizzazioni',
        monthlyCredits: -1, // Custom -1 per mostrare illimitato o gestire via custom limits
        monthlyPrice: 999,
        yearlyPrice: 9990,
        yearlyMonthlyEquivalent: 832.5,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE,
        stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: true,
            apiAccess: true,
            cmsIntegrations: true,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: true,
            maxProjects: -1,
            multiClientDashboard: true,
            customLogoReports: true
        },
        limits: {
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,
            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: true,
            apiAccessEnabled: true,
            canTransferProjects: true,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: true,
            conditionalLogic: true
        },
        featureList: [
            'Crediti illimitati',
            'White Label completo',
            'API Access & Custom Integration',
            'Supporto dedicato',
            'SLA garantiti'
        ]
    },

    [PlanType.ADMIN]: {
        id: PlanType.ADMIN,
        name: 'Admin',
        description: 'Staff Voler.ai',
        monthlyCredits: -1, // Illimitato
        monthlyPrice: 0,
        yearlyPrice: 0,
        yearlyMonthlyEquivalent: 0,
        features: {
            interviewAI: 'full',
            chatbot: true,
            visibilityTracker: true,
            aiTips: true,
            copilotStrategico: true,
            whiteLabel: true,
            apiAccess: true,
            cmsIntegrations: true,
            exportPdf: 'clean',
            exportCsv: true,
            analytics: 'full',
            canTransferProjects: true,
            maxProjects: -1,
            multiClientDashboard: true,
            customLogoReports: true
        },
        limits: {
            monthlyTokenBudget: -1,
            maxInterviewsPerMonth: -1,
            maxChatbots: -1,
            maxChatbotSessionsPerMonth: -1,
            maxVisibilityQueriesPerMonth: -1,
            maxAiSuggestionsPerMonth: -1,

            visibilityEnabled: true,
            aiTipsEnabled: true,
            whiteLabelEnabled: true,
            apiAccessEnabled: true,
            canTransferProjects: true,
            customLogo: true,
            customColor: true,
            themeExtraction: true,
            knowledgeBase: true,
            conditionalLogic: true
        },
        featureList: ['Tutto illimitato']
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica se un valore è illimitato (-1)
 */
export function isUnlimited(value: number): boolean {
    return value === -1;
}

/**
 * Ottiene la configurazione del piano per tier
 */
export function getPlanByTier(tier: string): PlanConfig {
    return PLANS[tier as PlanType] || PLANS[PlanType.FREE];
}

/**
 * Converte tier string a PlanType enum
 */
export function subscriptionTierToPlanType(tier: string): PlanType {
    const upperTier = tier?.toUpperCase();
    if (upperTier && upperTier in PlanType) {
        return upperTier as PlanType;
    }
    return PlanType.FREE;
}

/**
 * Verifica se una feature è disponibile per un piano
 */
export function isFeatureAvailable(plan: PlanType, feature: keyof PlanFeatures): boolean {
    const config = PLANS[plan];
    if (!config) return false;

    const value = config.features[feature];
    if (typeof value === 'boolean') return value;
    if (value === 'conditional') return true; // Disponibile con condizioni
    if (value === 'base' || value === 'full') return true;
    return false;
}

/**
 * Verifica se l'utente ha accesso a una feature specifica
 * Considera anche condizioni speciali (es. partner con X clienti)
 */
export function hasFeatureAccess(
    plan: PlanType,
    feature: keyof PlanFeatures,
    context?: { partnerActiveClients?: number }
): boolean {
    const config = PLANS[plan];
    if (!config) return false;

    const value = config.features[feature];

    // White label per partner è condizionale
    if (feature === 'whiteLabel' && value === 'conditional') {
        return (context?.partnerActiveClients ?? 0) >= 10;
    }

    if (typeof value === 'boolean') return value;
    if (value === 'base' || value === 'full') return true;
    return false;
}

/**
 * Ottiene i crediti mensili formattati per visualizzazione
 */
export function formatMonthlyCredits(credits: number): string {
    if (credits === -1) return 'Illimitati';
    if (credits >= 1_000) {
        return `${(credits / 1_000).toFixed(0)}K`;
    }
    return credits.toString();
}

/**
 * Lista piani ordinati per prezzo (per UI comparativa)
 */
export const PLAN_ORDER: PlanType[] = [
    PlanType.FREE,
    PlanType.STARTER,
    PlanType.PRO,
    PlanType.BUSINESS
];

/**
 * Piani disponibili per l'acquisto
 */
export const PURCHASABLE_PLANS: PlanType[] = [
    PlanType.STARTER,
    PlanType.PRO,
    PlanType.BUSINESS,
    PlanType.PARTNER,
    PlanType.ENTERPRISE
];

// ============================================
// PARTNER CONSTANTS
// ============================================

export const PARTNER_THRESHOLDS = {
    freeThreshold: 3,      // 3+ clienti = €0/mese
    whiteLabelThreshold: 10, // 10+ clienti = white label
    trialDays: 60,         // 60 giorni trial gratuito
    baseMonthlyFee: 29,    // €29/mese base (< 3 clienti)
    gracePeriodDays: 30    // 30 giorni grace period
} as const;

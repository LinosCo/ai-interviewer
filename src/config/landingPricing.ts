/**
 * Landing Page Pricing Configuration
 *
 * Configurazione centralizzata per i prezzi mostrati nelle landing pages.
 * Separata dalla config piani backend per flessibilità marketing.
 */

export interface LandingPlan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number | null;  // null = "Su misura"
    yearlyPrice: number | null;   // null = "Su misura"
    showPrice: boolean;
    features: string[];
    cta: string;
    ctaHref: string;
    popular: boolean;
    badge?: string;
}

export interface LandingCreditPack {
    id: string;
    name: string;
    credits: string;         // Formatted string "2K"
    price: number;
    pricePerThousand: number;
    popular?: boolean;
}

export interface PartnerPlan {
    name: string;
    basePrice: number;           // Base monthly fee
    freeThreshold: number;       // Clients needed for free access
    whiteLabelThreshold: number; // Clients needed for white label
    trialDays: number;
    features: string[];
    benefits: {
        title: string;
        description: string;
    }[];
}

// ============================================
// PIANI LANDING PAGE
// ============================================

export const LANDING_PLANS: LandingPlan[] = [
    {
        id: 'free',
        name: 'Free',
        description: 'Per sempre gratuito',
        monthlyPrice: 0,
        yearlyPrice: 0,
        showPrice: true,
        features: [
            '500 crediti/mese',
            '1 progetto',
            'Interviste AI',
            'Analytics base',
        ],
        cta: 'Inizia Gratis',
        ctaHref: '/register',
        popular: false,
    },
    {
        id: 'starter',
        name: 'Starter',
        description: 'Include tutto Free +',
        monthlyPrice: 69,
        yearlyPrice: 49,
        showPrice: true,
        features: [
            '6K crediti/mese',
            'Insterviste AI con branding personalizzabile',
            'Chatbot AI con lead generation',
            'Progetti illimitati',
            'Analytics completi',
        ],
        cta: 'Inizia 14 giorni gratis',
        ctaHref: '/register?plan=starter',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'Include tutto Starter +',
        monthlyPrice: 199,
        yearlyPrice: 149,
        showPrice: true,
        features: [
            '20K crediti/mese',
            'Brand Monitor',
            'AI Tips',
            'Copilot Strategico',
            'Google Analytics e Search Console',
            'Supporto prioritario',
        ],
        cta: 'Inizia 14 giorni gratis',
        ctaHref: '/register?plan=pro',
        popular: true,
    },
    {
        id: 'business',
        name: 'Business',
        description: 'Include tutto Pro +',
        monthlyPrice: 399,
        yearlyPrice: 299,
        showPrice: true,
        features: [
            '40K crediti/mese',
            'Integrazioni CMS su misura',
            'Automazione sito ed ecommerce',
            'API Access',
            'Account manager dedicato',
        ],
        cta: 'Inizia 14 giorni gratis',
        ctaHref: '/register?plan=business',
        popular: false,
    },
];

// ============================================
// PACK CREDITI LANDING PAGE
// ============================================

export const LANDING_CREDIT_PACKS: LandingCreditPack[] = [
    {
        id: 'small',
        name: 'Pack Small',
        credits: '2K',
        price: 15,
        pricePerThousand: 7.50,
    },
    {
        id: 'medium',
        name: 'Pack Medium',
        credits: '6K',
        price: 39,
        pricePerThousand: 6.50,
        popular: true,
    },
    {
        id: 'large',
        name: 'Pack Large',
        credits: '15K',
        price: 89,
        pricePerThousand: 5.93,
    },
];

// ============================================
// PIANO PARTNER
// ============================================

export const PARTNER_PLAN: PartnerPlan = {
    name: 'Partner',
    basePrice: 29,
    freeThreshold: 3,
    whiteLabelThreshold: 10,
    trialDays: 60,
    features: [
        '10K crediti/mese',
        'Tutte le funzionalità PRO',
        'Dashboard multi-cliente',
        'Trasferimento progetti',
        'Report con logo personalizzato',
        'Supporto dedicato partner',
    ],
    benefits: [
        {
            title: 'Trial 60 giorni',
            description: 'Prova gratuita estesa per costruire il tuo portafoglio clienti.'
        },
        {
            title: 'Gratis con 3+ clienti',
            description: 'Raggiungi 3 clienti attivi e non paghi nulla. Mai.'
        },
        {
            title: 'White Label con 10+ clienti',
            description: 'Personalizza Business Tuner con il tuo brand e logo.'
        },
        {
            title: 'Dashboard dedicata',
            description: 'Gestisci tutti i tuoi clienti da un\'unica interfaccia.'
        },
    ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get yearly discount percentage
 */
export function getYearlyDiscount(): number {
    const starter = LANDING_PLANS.find(p => p.id === 'starter');
    if (starter && starter.monthlyPrice && starter.yearlyPrice) {
        return Math.round((1 - starter.yearlyPrice / starter.monthlyPrice) * 100);
    }
    return 25;
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null, currency = 'EUR'): string {
    if (price === null) return 'Su misura';
    if (price === 0) return 'Gratis';
    return `€${price}`;
}

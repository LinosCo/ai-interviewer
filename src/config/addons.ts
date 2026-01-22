import { AddOnType } from '@prisma/client';

export interface AddOnPackage {
    id: string;
    name: string;
    description: string;
    type: AddOnType;
    quantity: number;
    price: number;  // EUR
    stripePriceId?: string;
    availableForTiers: string[];  // SubscriptionTier values
    icon: 'tokens' | 'interviews' | 'chatbot' | 'visibility' | 'users';
}

export const ADD_ON_PACKAGES: AddOnPackage[] = [
    // ═══════════════════════════════════════════
    // PACCHETTI TOKEN
    // ═══════════════════════════════════════════
    {
        id: 'tokens_5m',
        name: '5M Token Extra',
        description: '5 milioni di token aggiuntivi',
        type: 'TOKENS',
        quantity: 5000000,
        price: 9.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_5M,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        icon: 'tokens'
    },
    {
        id: 'tokens_20m',
        name: '20M Token Extra',
        description: '20 milioni di token aggiuntivi',
        type: 'TOKENS',
        quantity: 20000000,
        price: 29.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_20M,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        icon: 'tokens'
    },
    {
        id: 'tokens_50m',
        name: '50M Token Extra',
        description: '50 milioni di token aggiuntivi',
        type: 'TOKENS',
        quantity: 50000000,
        price: 59.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_50M,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'tokens'
    },

    // ═══════════════════════════════════════════
    // PACCHETTI INTERVISTE
    // ═══════════════════════════════════════════
    {
        id: 'interviews_50',
        name: '+50 Interviste',
        description: '50 interviste aggiuntive questo mese',
        type: 'INTERVIEWS',
        quantity: 50,
        price: 19.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_50,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        icon: 'interviews'
    },
    {
        id: 'interviews_200',
        name: '+200 Interviste',
        description: '200 interviste aggiuntive questo mese',
        type: 'INTERVIEWS',
        quantity: 200,
        price: 59.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_200,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'interviews'
    },
    {
        id: 'interviews_500',
        name: '+500 Interviste',
        description: '500 interviste aggiuntive questo mese',
        type: 'INTERVIEWS',
        quantity: 500,
        price: 129.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_500,
        availableForTiers: ['BUSINESS'],
        icon: 'interviews'
    },

    // ═══════════════════════════════════════════
    // PACCHETTI CHATBOT SESSIONS
    // ═══════════════════════════════════════════
    {
        id: 'chatbot_500',
        name: '+500 Sessioni Chatbot',
        description: '500 sessioni chatbot aggiuntive',
        type: 'CHATBOT',
        quantity: 500,
        price: 14.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_500,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        icon: 'chatbot'
    },
    {
        id: 'chatbot_2000',
        name: '+2.000 Sessioni Chatbot',
        description: '2.000 sessioni chatbot aggiuntive',
        type: 'CHATBOT',
        quantity: 2000,
        price: 39.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_2000,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'chatbot'
    },
    {
        id: 'chatbot_5000',
        name: '+5.000 Sessioni Chatbot',
        description: '5.000 sessioni chatbot aggiuntive',
        type: 'CHATBOT',
        quantity: 5000,
        price: 79.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_5000,
        availableForTiers: ['BUSINESS'],
        icon: 'chatbot'
    },

    // ═══════════════════════════════════════════
    // PACCHETTI VISIBILITY QUERIES
    // ═══════════════════════════════════════════
    {
        id: 'visibility_200',
        name: '+200 Query Visibility',
        description: '200 query visibility aggiuntive',
        type: 'VISIBILITY',
        quantity: 200,
        price: 19.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_200,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'visibility'
    },
    {
        id: 'visibility_500',
        name: '+500 Query Visibility',
        description: '500 query visibility aggiuntive',
        type: 'VISIBILITY',
        quantity: 500,
        price: 39.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_500,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'visibility'
    },
    {
        id: 'visibility_1000',
        name: '+1.000 Query Visibility',
        description: '1.000 query visibility aggiuntive',
        type: 'VISIBILITY',
        quantity: 1000,
        price: 69.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_1000,
        availableForTiers: ['BUSINESS'],
        icon: 'visibility'
    },

    // ═══════════════════════════════════════════
    // UTENTI EXTRA
    // ═══════════════════════════════════════════
    {
        id: 'users_3',
        name: '+3 Utenti',
        description: '3 utenti aggiuntivi al team',
        type: 'USERS',
        quantity: 3,
        price: 29.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_USERS_3,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        icon: 'users'
    },
    {
        id: 'users_5',
        name: '+5 Utenti',
        description: '5 utenti aggiuntivi al team',
        type: 'USERS',
        quantity: 5,
        price: 49.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_USERS_5,
        availableForTiers: ['PRO', 'BUSINESS'],
        icon: 'users'
    },
    {
        id: 'users_10',
        name: '+10 Utenti',
        description: '10 utenti aggiuntivi al team',
        type: 'USERS',
        quantity: 10,
        price: 89.90,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_USERS_10,
        availableForTiers: ['BUSINESS'],
        icon: 'users'
    }
];

/**
 * Ottiene add-on disponibili per un tier specifico
 */
export function getAvailableAddOns(tier: string): AddOnPackage[] {
    return ADD_ON_PACKAGES.filter(addon =>
        addon.availableForTiers.includes(tier)
    );
}

/**
 * Ottiene add-on per tipo
 */
export function getAddOnsByType(type: AddOnType): AddOnPackage[] {
    return ADD_ON_PACKAGES.filter(addon => addon.type === type);
}

/**
 * Trova un add-on per ID
 */
export function getAddOnById(id: string): AddOnPackage | undefined {
    return ADD_ON_PACKAGES.find(addon => addon.id === id);
}

/**
 * Calcola il prezzo totale per multipli add-on
 */
export function calculateAddOnsTotal(addOnIds: string[]): number {
    return addOnIds.reduce((total, id) => {
        const addon = getAddOnById(id);
        return total + (addon?.price || 0);
    }, 0);
}

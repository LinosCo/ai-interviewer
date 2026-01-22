export interface AddOnConfig {
    id: string;
    type: 'TOKENS' | 'INTERVIEWS' | 'CHATBOT_SESSIONS' | 'VISIBILITY_QUERIES' | 'AI_SUGGESTIONS' | 'EXTRA_USERS';
    name: string;
    description: string;
    quantity: number;
    price: number;  // In centesimi
    stripePriceId: string;
    availableForTiers: string[];
    recurring?: boolean;
}

export const ADD_ONS: AddOnConfig[] = [
    // Token Packs
    {
        id: 'tokens_5m',
        type: 'TOKENS',
        name: 'Token Pack 5M',
        description: '5 milioni di token AI',
        quantity: 5_000_000,
        price: 990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_5M!,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS']
    },
    {
        id: 'tokens_20m',
        type: 'TOKENS',
        name: 'Token Pack 20M',
        description: '20 milioni di token AI',
        quantity: 20_000_000,
        price: 2990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_20M!,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS']
    },
    {
        id: 'tokens_50m',
        type: 'TOKENS',
        name: 'Token Pack 50M',
        description: '50 milioni di token AI',
        quantity: 50_000_000,
        price: 5990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_50M!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'tokens_100m',
        type: 'TOKENS',
        name: 'Token Pack 100M',
        description: '100 milioni di token AI',
        quantity: 100_000_000,
        price: 9900,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_TOKENS_100M!,
        availableForTiers: ['BUSINESS']
    },

    // Interviste
    {
        id: 'interviews_50',
        type: 'INTERVIEWS',
        name: '+50 Interviste',
        description: '50 interviste aggiuntive',
        quantity: 50,
        price: 1990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_50!,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS']
    },
    {
        id: 'interviews_200',
        type: 'INTERVIEWS',
        name: '+200 Interviste',
        description: '200 interviste aggiuntive',
        quantity: 200,
        price: 5990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_200!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'interviews_500',
        type: 'INTERVIEWS',
        name: '+500 Interviste',
        description: '500 interviste aggiuntive',
        quantity: 500,
        price: 12900,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_INTERVIEWS_500!,
        availableForTiers: ['BUSINESS']
    },

    // Chatbot Sessions
    {
        id: 'chatbot_500',
        type: 'CHATBOT_SESSIONS',
        name: '+500 Sessioni Chatbot',
        description: '500 sessioni chatbot',
        quantity: 500,
        price: 1490,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_500!,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS']
    },
    {
        id: 'chatbot_2000',
        type: 'CHATBOT_SESSIONS',
        name: '+2.000 Sessioni Chatbot',
        description: '2.000 sessioni chatbot',
        quantity: 2000,
        price: 3990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_2000!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'chatbot_5000',
        type: 'CHATBOT_SESSIONS',
        name: '+5.000 Sessioni Chatbot',
        description: '5.000 sessioni chatbot',
        quantity: 5000,
        price: 7990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_CHATBOT_5000!,
        availableForTiers: ['BUSINESS']
    },

    // Visibility
    {
        id: 'visibility_200',
        type: 'VISIBILITY_QUERIES',
        name: '+200 Query Visibility',
        description: '200 query visibility',
        quantity: 200,
        price: 1490,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_200!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'visibility_500',
        type: 'VISIBILITY_QUERIES',
        name: '+500 Query Visibility',
        description: '500 query visibility',
        quantity: 500,
        price: 2990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_500!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'visibility_1500',
        type: 'VISIBILITY_QUERIES',
        name: '+1.500 Query Visibility',
        description: '1.500 query visibility',
        quantity: 1500,
        price: 6990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_VISIBILITY_1500!,
        availableForTiers: ['BUSINESS']
    },

    // AI Suggestions
    {
        id: 'suggestions_25',
        type: 'AI_SUGGESTIONS',
        name: '+25 AI Suggestions',
        description: '25 suggerimenti AI',
        quantity: 25,
        price: 1490,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_SUGGESTIONS_25!,
        availableForTiers: ['PRO', 'BUSINESS']
    },
    {
        id: 'suggestions_75',
        type: 'AI_SUGGESTIONS',
        name: '+75 AI Suggestions',
        description: '75 suggerimenti AI',
        quantity: 75,
        price: 3490,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_SUGGESTIONS_75!,
        availableForTiers: ['PRO', 'BUSINESS']
    },

    // Extra Users
    {
        id: 'users_5',
        type: 'EXTRA_USERS',
        name: '+5 Utenti',
        description: '5 utenti aggiuntivi',
        quantity: 5,
        price: 4990,
        stripePriceId: process.env.STRIPE_PRICE_ADDON_USERS_5!,
        availableForTiers: ['STARTER', 'PRO', 'BUSINESS'],
        recurring: true
    }
];

export function getAddOnById(id: string): AddOnConfig | undefined {
    return ADD_ONS.find(a => a.id === id);
}

export function getAddOnsForTier(tier: string): AddOnConfig[] {
    return ADD_ONS.filter(a => a.availableForTiers.includes(tier));
}

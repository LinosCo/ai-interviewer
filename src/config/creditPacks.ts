/**
 * Pack di crediti aggiuntivi acquistabili
 * I pack non scadono e si accumulano
 * Vengono usati DOPO i crediti mensili
 */

export interface CreditPack {
    id: string;
    name: string;
    credits: number;
    price: number;           // EUR
    pricePerThousand: number; // EUR per mille crediti
    stripePriceId?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
    {
        id: 'small',
        name: 'Pack Small',
        credits: 2_000,
        price: 15,
        pricePerThousand: 7.50,
        stripePriceId: process.env.STRIPE_PRICE_PACK_SMALL
    },
    {
        id: 'medium',
        name: 'Pack Medium',
        credits: 6_000,
        price: 39,
        pricePerThousand: 6.50,
        stripePriceId: process.env.STRIPE_PRICE_PACK_MEDIUM
    },
    {
        id: 'large',
        name: 'Pack Large',
        credits: 15_000,
        price: 89,
        pricePerThousand: 5.93,
        stripePriceId: process.env.STRIPE_PRICE_PACK_LARGE
    }
];

/**
 * Ottiene un pack per ID
 */
export function getCreditPack(packId: string): CreditPack | undefined {
    return CREDIT_PACKS.find(p => p.id === packId);
}

/**
 * Formatta i crediti per la visualizzazione
 */
export function formatCredits(credits: number): string {
    if (credits >= 1_000) {
        return `${(credits / 1_000).toFixed(0)}K`;
    }
    return credits.toString();
}

/**
 * Calcola la percentuale di utilizzo
 */
export function calculateUsagePercentage(used: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
}

/**
 * Soglie di warning per i crediti
 */
export const CREDIT_WARNING_THRESHOLDS = {
    warning: 70,    // Giallo - avviso soft
    danger: 85,     // Arancione - avviso + suggerimento acquisto
    critical: 95,   // Rosso - quasi esauriti
    exhausted: 100  // Esauriti - blocco
} as const;

/**
 * Determina il livello di warning basato sulla percentuale
 */
export function getWarningLevel(percentage: number): 'none' | 'warning' | 'danger' | 'critical' | 'exhausted' {
    if (percentage >= CREDIT_WARNING_THRESHOLDS.exhausted) return 'exhausted';
    if (percentage >= CREDIT_WARNING_THRESHOLDS.critical) return 'critical';
    if (percentage >= CREDIT_WARNING_THRESHOLDS.danger) return 'danger';
    if (percentage >= CREDIT_WARNING_THRESHOLDS.warning) return 'warning';
    return 'none';
}

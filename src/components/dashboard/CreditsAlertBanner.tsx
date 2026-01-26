'use client';

/**
 * CreditsAlertBanner
 *
 * Banner che appare in cima alla dashboard quando i crediti sono bassi.
 * Mostra avvisi a 70%, 85%, 95% con colori e messaggi diversi.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, XCircle, X } from 'lucide-react';

interface CreditsData {
    percentageUsed: number;
    alertLevel: 'warning' | 'danger' | 'critical' | 'exhausted' | null;
    isUnlimited: boolean;
    formatted: {
        totalAvailable: string;
    };
}

interface BannerConfig {
    bg: string;
    border: string;
    icon: typeof AlertTriangle | typeof XCircle;
    iconColor: string;
    title: string;
    message: string;
}

const bannerConfigs: Record<string, BannerConfig> = {
    warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: AlertTriangle,
        iconColor: 'text-yellow-600',
        title: 'Crediti in esaurimento',
        message: 'Hai usato più del 70% dei crediti mensili.'
    },
    danger: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        icon: AlertTriangle,
        iconColor: 'text-orange-600',
        title: 'Crediti quasi esauriti',
        message: 'Hai usato più dell\'85% dei crediti. Valuta un upgrade o acquista un pack.'
    },
    critical: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: XCircle,
        iconColor: 'text-red-600',
        title: 'Crediti in esaurimento critico',
        message: 'I tuoi crediti stanno per terminare. Le funzionalità AI si bloccheranno.'
    },
    exhausted: {
        bg: 'bg-red-100',
        border: 'border-red-300',
        icon: XCircle,
        iconColor: 'text-red-700',
        title: 'Crediti esauriti',
        message: 'Le funzionalità AI sono temporaneamente sospese.'
    }
};

export function CreditsAlertBanner() {
    const [credits, setCredits] = useState<CreditsData | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCredits();
    }, []);

    const fetchCredits = async () => {
        try {
            const res = await fetch('/api/credits');
            if (!res.ok) throw new Error('Error fetching credits');
            const data = await res.json();
            setCredits(data);
        } catch (err) {
            console.error('Error fetching credits for banner:', err);
        } finally {
            setLoading(false);
        }
    };

    // Don't show if loading, no data, dismissed, or no alert level
    if (loading || !credits || dismissed || !credits.alertLevel || credits.isUnlimited) {
        return null;
    }

    const config = bannerConfigs[credits.alertLevel];
    if (!config) return null;

    const Icon = config.icon;

    // Don't allow dismissing exhausted alert
    const canDismiss = credits.alertLevel !== 'exhausted';

    return (
        <div className={`${config.bg} ${config.border} border rounded-lg p-4 mb-6`}>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                    <h4 className="font-medium text-stone-900">{config.title}</h4>
                    <p className="text-sm text-stone-600 mt-1">
                        {config.message}
                        {credits.alertLevel !== 'exhausted' && (
                            <span className="ml-1">
                                ({credits.percentageUsed}% utilizzato)
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/billing?tab=packs"
                        className="text-sm font-medium py-2 px-4 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-all whitespace-nowrap"
                    >
                        Acquista pack
                    </Link>
                    <Link
                        href="/dashboard/billing/plans"
                        className="text-sm font-medium py-2 px-4 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all whitespace-nowrap"
                    >
                        Upgrade piano
                    </Link>
                    {canDismiss && (
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                            aria-label="Chiudi avviso"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CreditsAlertBanner;

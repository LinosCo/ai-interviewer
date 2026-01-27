'use client';

/**
 * UsageDashboard
 *
 * Dashboard per visualizzare l'utilizzo dei crediti AI.
 * Mostra crediti disponibili, consumo per tool, e storico recente.
 * OTTIMIZZATO: usa useMemo e useCallback per ridurre re-render
 */

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import {
    Info,
    AlertCircle,
    Zap,
    MessageSquare,
    Bot,
    Eye,
    Lightbulb,
    Compass,
    FileDown,
    RefreshCcw,
    TrendingUp
} from 'lucide-react';
import Link from 'next/link';

interface CreditsData {
    monthlyLimit: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    packAvailable: number;
    totalAvailable: number;
    percentageUsed: number;
    resetDate: string | null;
    alertLevel: 'warning' | 'danger' | 'critical' | 'exhausted' | null;
    isUnlimited: boolean;
    formatted: {
        monthlyLimit: string;
        monthlyUsed: string;
        monthlyRemaining: string;
        packAvailable: string;
        totalAvailable: string;
    };
}

interface ToolUsage {
    id: string;
    name: string;
    creditsUsed: number;
    transactionCount: number;
    percentage: number;
}

interface UsageByToolData {
    period: string;
    tools: ToolUsage[];
}

const toolIcons: Record<string, typeof Zap> = {
    interview: MessageSquare,
    chatbot: Bot,
    visibility: Eye,
    ai_tips: Lightbulb,
    copilot: Compass,
    export: FileDown
};

const toolColors: Record<string, string> = {
    interview: 'bg-blue-500',
    chatbot: 'bg-purple-500',
    visibility: 'bg-green-500',
    ai_tips: 'bg-amber-500',
    copilot: 'bg-rose-500',
    export: 'bg-slate-500'
};

// Memoized helper functions (fuori dal componente per evitare re-creazione)
const formatCredits = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return num.toString();
};

const formatResetDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long'
    });
};

const getProgressColor = (percentageUsed: number): string => {
    if (percentageUsed >= 95) return 'bg-red-500';
    if (percentageUsed >= 85) return 'bg-orange-500';
    if (percentageUsed >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
};

// Memoized Tool Item component
const ToolUsageItem = memo(function ToolUsageItem({ tool }: { tool: ToolUsage }) {
    const Icon = toolIcons[tool.id] || Zap;
    const color = toolColors[tool.id] || 'bg-slate-500';

    return (
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700">{tool.name}</span>
                    <span className="text-xs font-bold text-slate-900">
                        {formatCredits(tool.creditsUsed)}
                    </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${color} transition-all`}
                        style={{ width: `${tool.percentage}%` }}
                    />
                </div>
            </div>
            <span className="text-xs text-slate-400 w-10 text-right">
                {tool.percentage}%
            </span>
        </div>
    );
});

export function UsageDashboard() {
    const [credits, setCredits] = useState<CreditsData | null>(null);
    const [usageByTool, setUsageByTool] = useState<UsageByToolData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [creditsRes, usageRes] = await Promise.all([
                fetch('/api/credits'),
                fetch('/api/credits/usage-by-tool')
            ]);

            if (creditsRes.ok) {
                const creditsData = await creditsRes.json();
                setCredits(creditsData);
            }

            if (usageRes.ok) {
                const usageData = await usageRes.json();
                setUsageByTool(usageData);
            }
        } catch (error) {
            console.error('Failed to fetch usage data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Memoized computed values
    const progressColor = useMemo(
        () => credits ? getProgressColor(credits.percentageUsed) : 'bg-green-500',
        [credits?.percentageUsed]
    );

    const formattedResetDate = useMemo(
        () => formatResetDate(credits?.resetDate ?? null),
        [credits?.resetDate]
    );

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-20 bg-gray-200 rounded w-full"></div>
                </div>
            </Card>
        );
    }

    if (!credits) return null;

    return (
        <Card className="p-6 space-y-6 border-slate-100 shadow-sm">
            {/* Warning Banner for low credits */}
            {credits.alertLevel && credits.alertLevel !== 'warning' && (
                <div className={`rounded-xl p-4 flex items-start gap-3 border ${
                    credits.alertLevel === 'exhausted' ? 'bg-red-100 border-red-300' :
                    credits.alertLevel === 'critical' ? 'bg-red-50 border-red-200' :
                    'bg-orange-50 border-orange-200'
                }`}>
                    <AlertCircle className={`w-5 h-5 mt-0.5 ${
                        credits.alertLevel === 'exhausted' ? 'text-red-600' :
                        credits.alertLevel === 'critical' ? 'text-red-500' :
                        'text-orange-500'
                    }`} />
                    <div className="flex-1">
                        <p className={`text-sm font-bold ${
                            credits.alertLevel === 'exhausted' ? 'text-red-900' :
                            credits.alertLevel === 'critical' ? 'text-red-900' :
                            'text-orange-900'
                        }`}>
                            {credits.alertLevel === 'exhausted' ? 'Crediti esauriti' :
                             credits.alertLevel === 'critical' ? 'Crediti in esaurimento critico' :
                             'Crediti quasi esauriti'}
                        </p>
                        <p className={`text-xs mt-1 ${
                            credits.alertLevel === 'exhausted' ? 'text-red-700' :
                            credits.alertLevel === 'critical' ? 'text-red-700' :
                            'text-orange-700'
                        }`}>
                            {credits.alertLevel === 'exhausted'
                                ? 'Le funzionalità AI sono temporaneamente sospese. Acquista un pack o fai upgrade.'
                                : `Hai usato il ${credits.percentageUsed}% dei crediti mensili.`}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Link href="/dashboard/billing?tab=packs">
                                <Button size="sm" variant="outline" className="rounded-lg font-bold text-xs h-8">
                                    Acquista pack
                                </Button>
                            </Link>
                            <Link href="/dashboard/billing/plans">
                                <Button size="sm" className={`rounded-lg font-bold text-xs h-8 ${
                                    credits.alertLevel === 'exhausted' ? 'bg-red-600 hover:bg-red-700' :
                                    'bg-amber-600 hover:bg-amber-700'
                                }`}>
                                    Upgrade piano
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Crediti AI
                    </h2>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                        <RefreshCcw className="w-3 h-3" aria-hidden="true" />
                        Reset: {formattedResetDate}
                    </p>
                </div>
                <Link href="/dashboard/billing">
                    <Button variant="outline" size="sm" className="rounded-lg font-bold text-xs h-8">
                        Gestisci
                    </Button>
                </Link>
            </div>

            {/* Main Credits Display */}
            {credits.isUnlimited ? (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-100">
                    <div className="text-center">
                        <p className="text-sm text-amber-600 font-medium">Crediti</p>
                        <p className="text-3xl font-black text-amber-600">Illimitati</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Credits Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700">Crediti mensili</span>
                            <span className="text-sm font-bold text-slate-900">
                                {credits.formatted.monthlyUsed}
                                <span className="text-slate-400 font-medium"> / {credits.formatted.monthlyLimit}</span>
                            </span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${progressColor} transition-all duration-500`}
                                style={{ width: `${Math.min(credits.percentageUsed, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>{credits.percentageUsed}% utilizzato</span>
                            <span>{credits.formatted.monthlyRemaining} disponibili</span>
                        </div>
                    </div>

                    {/* Pack Credits */}
                    {credits.packAvailable > 0 && (
                        <div className="bg-amber-50 rounded-lg p-3 flex items-center justify-between border border-amber-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-700 font-medium">Pack crediti</p>
                                    <p className="text-sm font-bold text-amber-900">{credits.formatted.packAvailable}</p>
                                </div>
                            </div>
                            <span className="text-xs text-amber-600">Non scadono</span>
                        </div>
                    )}

                    {/* Total Available */}
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-xs text-slate-500 font-medium">Totale disponibile</p>
                        <p className="text-2xl font-black text-slate-900">{credits.formatted.totalAvailable}</p>
                    </div>
                </div>
            )}

            {/* Usage by Tool */}
            {usageByTool && usageByTool.tools.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        Consumo per strumento
                    </h3>
                    <div className="space-y-3">
                        {usageByTool.tools.map(tool => (
                            <ToolUsageItem key={tool.id} tool={tool} />
                        ))}
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="pt-4 border-t border-slate-100">
                <div className="bg-indigo-50/50 rounded-xl p-4 flex items-start gap-3 border border-indigo-100/50">
                    <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-indigo-900">Hai bisogno di più crediti?</p>
                        <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                            Acquista pack aggiuntivi a partire da €15 o passa a un piano superiore per più crediti mensili.
                        </p>
                        <div className="flex gap-2 mt-2">
                            <Link href="/dashboard/billing?tab=packs">
                                <Button size="sm" variant="outline" className="rounded-lg font-bold text-[10px] h-6 px-2">
                                    Vedi pack
                                </Button>
                            </Link>
                            <Link href="/dashboard/billing/plans">
                                <Button size="sm" className="rounded-lg font-bold text-[10px] h-6 px-2 bg-indigo-600 hover:bg-indigo-700">
                                    Confronta piani
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, RefreshCw, FileText, BarChart2, Layers } from 'lucide-react';
import { showToast } from '@/components/toast';

interface ConnectionStatus {
    enabled: boolean;
    projectId?: string;
    connection?: {
        name: string;
        status: string;
        lastSyncAt: string | null;
        hasGoogleAnalytics: boolean;
        hasSearchConsole: boolean;
        cmsPublicUrl: string | null;
        cmsDashboardUrl: string | null;
    };
}

interface AnalyticsData {
    period: { start: string; end: string };
    summary: {
        pageviews: number;
        uniqueVisitors: number;
        avgSessionDuration: number;
        bounceRate: number;
        searchImpressions: number;
        searchClicks: number;
        avgPosition: number;
    };
    trends: {
        pageviews: { date: string; value: number }[];
        visitors: { date: string; value: number }[];
    };
    topPages: any[];
    topSearchQueries: any[];
}

interface Suggestion {
    id: string;
    type: string;
    title: string;
    reasoning: string;
    priorityScore: number;
    status: string;
    createdAt: string;
}

export default function CMSPage() {
    const [connection, setConnection] = useState<ConnectionStatus | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);

    const handleOpenDashboard = async () => {
        if (!projectId) return;
        setIsLoadingDashboard(true);
        try {
            const res = await fetch('/api/cms/dashboard-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to generate URL');
            }

            const { url } = await res.json();
            window.open(url, '_blank');
        } catch (error: any) {
            showToast(error.message || 'Errore apertura dashboard', 'error');
        } finally {
            setIsLoadingDashboard(false);
        }
    };

    useEffect(() => {
        async function loadData() {
            try {
                const connRes = await fetch('/api/cms/connection');
                const connData = await connRes.json();
                setConnection(connData);
                if (connData.projectId) {
                    setProjectId(connData.projectId);
                }

                if (connData.enabled && connData.projectId) {
                    const analyticsRes = await fetch(`/api/cms/analytics?range=30d&projectId=${connData.projectId}`);
                    if (analyticsRes.ok) {
                        const analyticsData = await analyticsRes.json();
                        setAnalytics(analyticsData);
                    }

                    const suggestionsRes = await fetch(`/api/cms/suggestions?status=PENDING&projectId=${connData.projectId}`);
                    if (suggestionsRes.ok) {
                        const suggestionsData = await suggestionsRes.json();
                        setSuggestions(suggestionsData.suggestions || []);
                    }
                }
            } catch (err) {
                console.error('Error loading CMS data:', err);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="p-6 md:p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-stone-100 rounded-full w-1/4" />
                    <div className="h-4 bg-stone-100 rounded-full w-1/3" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-stone-100 rounded-2xl" />
                        ))}
                    </div>
                    <div className="h-48 bg-stone-100 rounded-2xl" />
                </div>
            </div>
        );
    }

    // Not enabled state
    if (!connection?.enabled) {
        return (
            <div className="p-6 md:p-8 max-w-2xl mx-auto">
                <div className="bg-white rounded-[2rem] border border-stone-100 shadow-sm p-10 text-center">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Globe className="w-7 h-7 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full mb-4 inline-block">
                        Contenuti AI
                    </span>
                    <h1 className="text-2xl font-black text-stone-900 mt-3 mb-3">Integrazione Sito Web</h1>
                    <p className="text-stone-500 text-sm mb-4 leading-relaxed">
                        Collega il tuo sito a Business Tuner per ricevere suggerimenti di contenuto
                        basati sui dati, monitorare SEO e visibilità, e pubblicare contenuti
                        direttamente dal pannello.
                    </p>
                    <p className="text-xs text-stone-400 mb-8">
                        Questa funzionalità è disponibile per i clienti che affidano lo sviluppo
                        del sito web a Voler.ai.
                    </p>
                    <a
                        href="https://voler.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-full font-bold transition-colors text-sm"
                    >
                        Scopri i nostri servizi
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        );
    }

    const conn = connection.connection!;

    return (
        <div className="p-6 md:p-8 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                        Contenuti AI
                    </span>
                    <h1 className="text-2xl font-black text-stone-900 mt-0.5">{conn.name}</h1>
                    <p className="text-sm text-stone-400 mt-0.5">
                        Ultimo sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString('it-IT') : 'Mai'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {conn.cmsPublicUrl && (
                        <a
                            href={conn.cmsPublicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-500 hover:text-stone-900 text-sm flex items-center gap-1.5 transition-colors"
                        >
                            Visita sito <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    {conn.cmsDashboardUrl && (
                        <button
                            onClick={handleOpenDashboard}
                            disabled={isLoadingDashboard || conn.status === 'DISABLED'}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {isLoadingDashboard ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Globe className="w-4 h-4" />
                                    Apri Editor CMS
                                    <ExternalLink className="w-3 h-3" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Metric Cards */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Visitatori unici', value: analytics.summary.uniqueVisitors.toLocaleString(), icon: <BarChart2 className="w-4 h-4" /> },
                        { label: 'Pageviews', value: analytics.summary.pageviews.toLocaleString(), icon: <Layers className="w-4 h-4" /> },
                        { label: 'Bounce Rate', value: `${(analytics.summary.bounceRate * 100).toFixed(1)}%`, icon: <RefreshCw className="w-4 h-4" /> },
                        { label: 'Posizione Media', value: analytics.summary.avgPosition?.toFixed(1) || '-', icon: <BarChart2 className="w-4 h-4" /> },
                    ].map((item) => (
                        <div key={item.label} className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-stone-400 mb-3">
                                {item.icon}
                                <p className="text-[10px] font-black uppercase tracking-widest">{item.label}</p>
                            </div>
                            <p className="text-2xl font-black text-stone-900">{item.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                                <FileText className="w-4 h-4 text-amber-600" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-stone-500">
                                Suggerimenti in Attesa
                            </h2>
                        </div>
                        <Link
                            href="/dashboard/cms/suggestions"
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1"
                        >
                            Vedi tutti →
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {suggestions.slice(0, 3).map(s => (
                            <div key={s.id} className="border border-stone-100 rounded-xl p-4 hover:bg-stone-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getPriorityColor(s.priorityScore)}`}>
                                            Priorità: {s.priorityScore}
                                        </span>
                                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                                            {formatType(s.type)}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/dashboard/cms/suggestions?id=${s.id}`}
                                        className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors shrink-0 ml-2"
                                    >
                                        Dettagli
                                    </Link>
                                </div>
                                <h3 className="font-semibold text-stone-900 mt-2 text-sm">{s.title}</h3>
                                <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">{s.reasoning}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Pages */}
            {analytics && analytics.topPages.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                        Pagine Più Visitate
                    </h2>
                    <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-stone-400">
                                <th className="pb-3 text-[10px] font-black uppercase tracking-wider">Pagina</th>
                                <th className="pb-3 text-right text-[10px] font-black uppercase tracking-wider">Visite</th>
                                <th className="pb-3 text-right text-[10px] font-black uppercase tracking-wider">Bounce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topPages.slice(0, 5).map((page, i) => (
                                <tr key={i} className="border-t border-stone-50">
                                    <td className="py-2.5 font-mono text-xs text-stone-600">{page.path}</td>
                                    <td className="py-2.5 text-right font-bold text-stone-900">{page.views}</td>
                                    <td className="py-2.5 text-right text-stone-500">{(page.bounceRate * 100).toFixed(0)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            {/* Top Search Queries */}
            {analytics && analytics.topSearchQueries.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                        Query di Ricerca Principali
                    </h2>
                    <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-stone-400">
                                <th className="pb-3 text-[10px] font-black uppercase tracking-wider">Query</th>
                                <th className="pb-3 text-right text-[10px] font-black uppercase tracking-wider">Impressioni</th>
                                <th className="pb-3 text-right text-[10px] font-black uppercase tracking-wider">Click</th>
                                <th className="pb-3 text-right text-[10px] font-black uppercase tracking-wider">Posizione</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topSearchQueries.slice(0, 5).map((q, i) => (
                                <tr key={i} className="border-t border-stone-50">
                                    <td className="py-2.5 text-stone-700 font-medium">{q.query}</td>
                                    <td className="py-2.5 text-right text-stone-500">{q.impressions}</td>
                                    <td className="py-2.5 text-right font-bold text-stone-900">{q.clicks}</td>
                                    <td className="py-2.5 text-right text-stone-500">{q.position.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function getPriorityColor(score: number): string {
    if (score >= 80) return 'bg-red-100 text-red-700';
    if (score >= 60) return 'bg-orange-100 text-orange-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-stone-100 text-stone-600';
}

function formatType(type: string): string {
    const types: Record<string, string> = {
        CREATE_PAGE: 'Nuova Pagina',
        CREATE_FAQ: 'FAQ',
        CREATE_BLOG_POST: 'Blog Post',
        MODIFY_CONTENT: 'Modifica',
        ADD_SECTION: 'Nuova Sezione'
    };
    return types[type] || type;
}

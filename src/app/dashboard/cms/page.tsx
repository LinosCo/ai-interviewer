'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { showToast } from '@/components/toast';

interface ConnectionStatus {
    enabled: boolean;
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
                // Load connection status
                const connRes = await fetch('/api/cms/connection');
                const connData = await connRes.json();
                setConnection(connData);
                if (connData.projectId) {
                    setProjectId(connData.projectId);
                }

                if (connData.enabled) {
                    // Load analytics
                    const analyticsRes = await fetch('/api/cms/analytics?range=30d');
                    if (analyticsRes.ok) {
                        const analyticsData = await analyticsRes.json();
                        setAnalytics(analyticsData);
                    }

                    // Load pending suggestions
                    const suggestionsRes = await fetch('/api/cms/suggestions?status=PENDING');
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
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Not enabled state
    if (!connection?.enabled) {
        return (
            <div className="p-8 max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white text-center">
                    <h1 className="text-2xl font-bold mb-4">Integrazione Sito Web</h1>
                    <p className="text-indigo-100 mb-6">
                        Collega il tuo sito a Business Tuner per ricevere suggerimenti di contenuto
                        basati sui dati, monitorare SEO e visibilita, e pubblicare contenuti
                        direttamente dal pannello.
                    </p>
                    <p className="text-sm text-indigo-200">
                        Questa funzionalita e disponibile per i clienti che affidano lo sviluppo
                        del sito web a Voler.ai.
                    </p>
                    <a
                        href="https://voler.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 inline-block bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50"
                    >
                        Scopri i nostri servizi
                    </a>
                </div>
            </div>
        );
    }

    const conn = connection.connection!;

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Sito</h1>
                    <p className="text-gray-500">{conn.name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Ultimo sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString('it-IT') : 'Mai'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {conn.cmsPublicUrl && (
                        <a
                            href={conn.cmsPublicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
                        >
                            Visita sito <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    {conn.cmsDashboardUrl && (
                        <button
                            onClick={handleOpenDashboard}
                            disabled={isLoadingDashboard || conn.status === 'DISABLED'}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {isLoadingDashboard ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Globe className="w-4 h-4" />
                                    Apri Editor CMS
                                    <ExternalLink className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Visitatori</p>
                        <p className="text-2xl font-bold">{analytics.summary.uniqueVisitors.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Pageviews</p>
                        <p className="text-2xl font-bold">{analytics.summary.pageviews.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Bounce Rate</p>
                        <p className="text-2xl font-bold">{(analytics.summary.bounceRate * 100).toFixed(1)}%</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-sm text-gray-500">Posizione Media</p>
                        <p className="text-2xl font-bold">{analytics.summary.avgPosition?.toFixed(1) || '-'}</p>
                    </div>
                </div>
            )}

            {/* Pending Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Suggerimenti in Attesa</h2>
                        <Link href="/dashboard/cms/suggestions" className="text-indigo-600 hover:underline text-sm">
                            Vedi tutti &rarr;
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {suggestions.slice(0, 3).map(s => (
                            <div key={s.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(s.priorityScore)}`}>
                                            Priorita: {s.priorityScore}
                                        </span>
                                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 ml-2">
                                            {formatType(s.type)}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/dashboard/cms/suggestions?id=${s.id}`}
                                        className="text-indigo-600 hover:underline text-sm"
                                    >
                                        Dettagli
                                    </Link>
                                </div>
                                <h3 className="font-medium mt-2">{s.title}</h3>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.reasoning}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Pages */}
            {analytics && analytics.topPages.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Pagine Piu Visitate</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500">
                                <th className="pb-2">Pagina</th>
                                <th className="pb-2 text-right">Visite</th>
                                <th className="pb-2 text-right">Bounce</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topPages.slice(0, 5).map((page, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="py-2 font-mono text-xs">{page.path}</td>
                                    <td className="py-2 text-right">{page.views}</td>
                                    <td className="py-2 text-right">{(page.bounceRate * 100).toFixed(0)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Top Search Queries */}
            {analytics && analytics.topSearchQueries.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Query di Ricerca Principali</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500">
                                <th className="pb-2">Query</th>
                                <th className="pb-2 text-right">Impressioni</th>
                                <th className="pb-2 text-right">Click</th>
                                <th className="pb-2 text-right">Posizione</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topSearchQueries.slice(0, 5).map((q, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                    <td className="py-2">{q.query}</td>
                                    <td className="py-2 text-right">{q.impressions}</td>
                                    <td className="py-2 text-right">{q.clicks}</td>
                                    <td className="py-2 text-right">{q.position.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function getPriorityColor(score: number): string {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
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

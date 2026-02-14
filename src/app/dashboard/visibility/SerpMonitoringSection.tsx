'use client';

import { useState, useEffect } from 'react';
import {
    Newspaper,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    ExternalLink,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Flag,
    CheckCircle,
    Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SerpResult {
    id: string;
    title: string;
    url: string;
    snippet: string;
    sourceDomain: string;
    sourceType: string;
    sourceReputation: number;
    sentiment: string;
    sentimentScore: number;
    relevanceScore: number;
    importanceScore: number;
    brandMentionType: string;
    topicCategory: string | null;
    contentSummary: string | null;
    relatedToLLMVisibility: boolean;
    suggestedActions: Array<{
        type: string;
        priority: string;
        description: string;
    }>;
    isReviewed: boolean;
    flagged: boolean;
    createdAt: string;
}

interface SerpScan {
    id: string;
    query: string;
    scanType?: string;
    dateRange: string;
    completedAt: string;
    totalResults: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    avgImportance: number;
}

interface SerpData {
    results: SerpResult[];
    scans: SerpScan[];
}

export function SerpMonitoringSection({ projectId, configId }: { projectId?: string | null; configId?: string | null }) {
    const [data, setData] = useState<SerpData | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<'last_day' | 'last_week' | 'last_month' | 'since_last_scan'>('last_week');
    const [resultType, setResultType] = useState<'news' | 'web'>('news');

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (projectId) params.set('projectId', projectId);
            if (configId) params.set('configId', configId);

            const response = await fetch(`/api/visibility/serp?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch');
            const json = await response.json();
            setData(json);
            setError(null);
        } catch (err) {
            setError('Impossibile caricare i dati SERP');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId, configId]);

    const runScan = async () => {
        try {
            setScanning(true);
            const response = await fetch('/api/visibility/serp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dateRange, resultType, projectId, configId })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Scan failed');
            }

            await fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore durante la scansione');
        } finally {
            setScanning(false);
        }
    };

    const toggleExpanded = (id: string) => {
        setExpandedResults(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'negative': return <TrendingDown className="w-4 h-4 text-red-500" />;
            case 'mixed': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            default: return <Minus className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return 'bg-green-100 text-green-800 border-green-200';
            case 'negative': return 'bg-red-100 text-red-800 border-red-200';
            case 'mixed': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getImportanceColor = (score: number) => {
        if (score >= 70) return 'text-red-600 font-bold';
        if (score >= 50) return 'text-amber-600 font-medium';
        return 'text-gray-500';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDateRangeLabel = (value: string) => {
        switch (value) {
            case 'last_day':
                return 'Ultime 24 ore';
            case 'last_week':
                return 'Ultimi 7 giorni';
            case 'last_month':
                return 'Ultimi 30 giorni';
            case 'since_last_scan':
                return "Dall'ultimo scan";
            default:
                return 'Ultimi 7 giorni';
        }
    };

    const getResultTypeLabel = (value: string) => {
        return value === 'web' ? 'Web (contenuti recenti)' : 'News';
    };

    const getScanTypeLabel = (scanType?: string) => {
        if (!scanType) return 'News';
        if (scanType.includes('web')) return 'Web (contenuti recenti)';
        return 'News';
    };

    if (loading) {
        return (
            <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
                    <p className="mt-4 text-gray-500">Caricamento monitoraggio Google...</p>
                </CardContent>
            </Card>
        );
    }

    const latestScan = data?.scans[0];
    const hasResults = data && data.results.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Newspaper className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Monitoraggio Google</CardTitle>
                                <CardDescription>
                                    Menzioni del brand nelle ricerche Google (news o contenuti web recenti)
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                            <select
                                value={resultType}
                                onChange={(e) => setResultType(e.target.value as 'news' | 'web')}
                                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="news">News</option>
                                <option value="web">Web (contenuti recenti)</option>
                            </select>
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="last_day">Ultime 24 ore</option>
                                <option value="last_week">Ultimi 7 giorni</option>
                                <option value="last_month">Ultimi 30 giorni</option>
                                <option value="since_last_scan">Dall'ultimo scan</option>
                            </select>
                            <Button
                                onClick={runScan}
                                disabled={scanning}
                                loading={scanning}
                                loadingText="Scansione..."
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Nuova Scansione
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                {latestScan && (
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500">Totale Menzioni</p>
                                <p className="text-2xl font-bold text-gray-900">{latestScan.totalResults}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-green-500" /> Positive
                                </p>
                                <p className="text-2xl font-bold text-green-600">{latestScan.positiveCount}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3 text-red-500" /> Negative
                                </p>
                                <p className="text-2xl font-bold text-red-600">{latestScan.negativeCount}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500">Importanza Media</p>
                                <p className={`text-2xl font-bold ${getImportanceColor(latestScan.avgImportance)}`}>
                                    {Math.round(latestScan.avgImportance)}%
                                </p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Ultimo Scan
                                </p>
                                <p className="text-sm font-medium text-gray-700">
                                    {formatDate(latestScan.completedAt)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {getScanTypeLabel(latestScan.scanType)} • {getDateRangeLabel(latestScan.dateRange)}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-blue-700 mt-3">
                            Scansione pronta: {getResultTypeLabel(resultType)} • {getDateRangeLabel(dateRange)}
                        </p>
                    </CardContent>
                )}
            </Card>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Results List */}
            {hasResults ? (
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Menzioni Recenti</h3>

                    {data.results.map((result) => (
                        <Card key={result.id} className={`border-0 shadow-md transition-all ${result.sentiment === 'negative' ? 'border-l-4 border-l-red-400' : ''}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            {getSentimentIcon(result.sentiment)}
                                            <Badge variant="outline" className={getSentimentColor(result.sentiment)}>
                                                {result.sentiment}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                {result.sourceType}
                                            </Badge>
                                            {result.relatedToLLMVisibility && (
                                                <Badge className="bg-purple-100 text-purple-700 text-xs">
                                                    Impatto LLM
                                                </Badge>
                                            )}
                                            {result.flagged && (
                                                <Flag className="w-4 h-4 text-red-500" />
                                            )}
                                        </div>

                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
                                        >
                                            {result.title}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>

                                        <p className="text-sm text-gray-500 mt-1">
                                            {result.sourceDomain} • Reputazione: {result.sourceReputation}/100
                                        </p>

                                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                            {result.snippet}
                                        </p>

                                        {expandedResults.has(result.id) && (
                                            <div className="mt-4 space-y-3 bg-gray-50 rounded-lg p-4">
                                                {result.contentSummary && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Riassunto AI</p>
                                                        <p className="text-sm text-gray-700">{result.contentSummary}</p>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-3 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Rilevanza</p>
                                                        <p className="font-medium">{result.relevanceScore}%</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Tipo Menzione</p>
                                                        <p className="font-medium">{result.brandMentionType}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Categoria</p>
                                                        <p className="font-medium">{result.topicCategory || 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {result.suggestedActions && result.suggestedActions.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Azioni Suggerite</p>
                                                        <div className="space-y-2">
                                                            {result.suggestedActions.map((action, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-sm">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={
                                                                            action.priority === 'high' ? 'bg-red-50 text-red-700' :
                                                                                action.priority === 'medium' ? 'bg-amber-50 text-amber-700' :
                                                                                    'bg-gray-50 text-gray-700'
                                                                        }
                                                                    >
                                                                        {action.type}
                                                                    </Badge>
                                                                    <span className="text-gray-600">{action.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <div className={`text-lg font-bold ${getImportanceColor(result.importanceScore)}`}>
                                            {result.importanceScore}%
                                        </div>
                                        <p className="text-xs text-gray-400">importanza</p>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleExpanded(result.id)}
                                            className="mt-2"
                                        >
                                            {expandedResults.has(result.id) ? (
                                                <>
                                                    <ChevronUp className="w-4 h-4 mr-1" />
                                                    Meno
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-4 h-4 mr-1" />
                                                    Dettagli
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : !loading && (
                <Card className="border-0 shadow-md">
                    <CardContent className="p-8 text-center">
                        <Newspaper className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="font-semibold text-gray-700 mb-2">Nessun risultato SERP</h3>
                        <p className="text-gray-500 mb-4">
                            Non sono ancora stati trovati risultati. Avvia una scansione per monitorare le menzioni del tuo brand su Google.
                        </p>
                        <Button onClick={runScan} disabled={scanning}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                            {scanning ? 'Scansione in corso...' : 'Avvia Prima Scansione'}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

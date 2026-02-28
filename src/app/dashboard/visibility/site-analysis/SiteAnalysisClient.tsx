'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
    Globe, RefreshCw, AlertTriangle, CheckCircle2, Info,
    TrendingUp, Search, Bot, Zap, FileText, Link2, BarChart2,
    ChevronDown, ChevronUp, Download,
} from 'lucide-react';

// ─── Types (mirrored from engine interfaces) ──────────────────────────────────

interface PageAuditRow {
    url: string;
    overallScore: number;
    llmoScore: number;
    title: { score: number; issues: string[] };
    metaDescription: { score: number };
    h1: { count: number; score: number };
    schema: { types: string[] };
    llmo: {
        score: number;
        signals: {
            hasFAQSchema: boolean;
            hasArticleSchema: boolean;
            questionHeadingsCount: number;
            wordCount: number;
        };
        issues: string[];
        strengths: string[];
    };
    gscData?: {
        impressions: number;
        clicks: number;
        position: number;
        ctr: number;
    };
    fetchError?: string;
}

interface AITip {
    category: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
    implementation: string;
    estimatedEffort: string;
    affectedPages?: string[];
    strategyAlignment?: string;
}

interface BrandReport {
    id: string;
    status: string;
    overallScore: number;
    seoScore: number;
    llmoScore: number;
    geoScore: number;
    serpScore: number;
    pagesAudited: number;
    seoAuditData: {
        sitemapUrl: string | null;
        pagesDiscovered: number;
        pagesAudited: number;
        pages: PageAuditRow[];
        aggregated: {
            avgSeoScore: number;
            avgLlmoScore: number;
            topSeoIssues: { issue: string; count: number }[];
            topLlmoIssues: { issue: string; count: number }[];
            schemaTypeDistribution: Record<string, number>;
            pagesWithFAQSchema: number;
            pagesWithArticleSchema: number;
            pagesWithGoodTitle: number;
            pagesWithMeta: number;
            pagesWithoutLLMO: number;
        };
    } | null;
    gscInsights: {
        topSearchQueries?: Array<{ query: string; impressions: number; clicks: number; position: number }>;
        topSearchPages?: Array<{ page: string; impressions: number; clicks: number; position: number }>;
        avgBounceRate?: number;
    } | null;
    aiTips: { tips: AITip[]; summaryInsight: string } | null;
    generatedAt: string | null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
    const pct = Math.min(100, Math.max(0, score));
    const bg = pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500';
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={pct >= 75 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'}
                        strokeWidth="3"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeLinecap="round"
                    />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${bg}`}>
                    {score}
                </span>
            </div>
            <span className="text-xs text-stone-500 text-center">{label}</span>
        </div>
    );
}

function ScoreBadge({ score }: { score: number }) {
    if (score >= 75) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{score}</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200">{score}</Badge>;
}

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_LABELS: Record<string, string> = {
    seo_onpage: 'SEO On-page',
    seo_technical: 'SEO Tecnico',
    llmo_schema: 'LLMO Schema',
    llmo_content: 'LLMO Contenuto',
    content_strategy: 'Strategia Contenuti',
    gsc_performance: 'GSC Performance',
    geo_visibility: 'GEO Visibilità',
};
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    seo_onpage: <FileText className="h-3.5 w-3.5" />,
    seo_technical: <Link2 className="h-3.5 w-3.5" />,
    llmo_schema: <Bot className="h-3.5 w-3.5" />,
    llmo_content: <Bot className="h-3.5 w-3.5" />,
    content_strategy: <TrendingUp className="h-3.5 w-3.5" />,
    gsc_performance: <BarChart2 className="h-3.5 w-3.5" />,
    geo_visibility: <Globe className="h-3.5 w-3.5" />,
};
const EFFORT_LABELS: Record<string, string> = {
    quick_win: '⚡ Quick win',
    medium: '🔧 Medio',
    complex: '🏗️ Complesso',
};

function TipCard({ tip }: { tip: AITip }) {
    const [expanded, setExpanded] = useState(false);
    const priorityColors: Record<string, string> = {
        critical: 'bg-red-100 text-red-700 border-red-200',
        high: 'bg-amber-100 text-amber-700 border-amber-200',
        medium: 'bg-blue-100 text-blue-700 border-blue-200',
        low: 'bg-stone-100 text-stone-600 border-stone-200',
    };

    return (
        <Card className="border-stone-200 bg-white hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-stone-400">
                        {CATEGORY_ICONS[tip.category] ?? <Zap className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-xs ${priorityColors[tip.priority] ?? ''}`}>
                                {tip.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-stone-50 text-stone-500 border-stone-200">
                                {CATEGORY_LABELS[tip.category] ?? tip.category}
                            </Badge>
                            <span className="text-xs text-stone-400">{EFFORT_LABELS[tip.estimatedEffort] ?? tip.estimatedEffort}</span>
                        </div>
                        <p className="font-medium text-stone-800 text-sm">{tip.title}</p>
                        <p className="text-stone-500 text-xs mt-1">{tip.description}</p>

                        {expanded && (
                            <div className="mt-3 space-y-2 text-xs">
                                <div className="rounded bg-emerald-50 border border-emerald-100 p-2">
                                    <span className="font-medium text-emerald-700">Impatto atteso: </span>
                                    <span className="text-emerald-800">{tip.impact}</span>
                                </div>
                                <div className="rounded bg-stone-50 border border-stone-100 p-2">
                                    <span className="font-medium text-stone-600">Implementazione: </span>
                                    <span className="text-stone-700">{tip.implementation}</span>
                                </div>
                                {tip.strategyAlignment && (
                                    <div className="rounded bg-amber-50 border border-amber-100 p-2">
                                        <span className="font-medium text-amber-700">Allineamento strategico: </span>
                                        <span className="text-amber-800">{tip.strategyAlignment}</span>
                                    </div>
                                )}
                                {tip.affectedPages && tip.affectedPages.length > 0 && (
                                    <div>
                                        <span className="font-medium text-stone-600">Pagine coinvolte:</span>
                                        <ul className="mt-1 space-y-0.5">
                                            {tip.affectedPages.map(p => (
                                                <li key={p} className="text-stone-500 truncate">• {p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="mt-2 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                        >
                            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {expanded ? 'Meno dettagli' : 'Vedi dettagli'}
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

interface Props {
    configId: string;
    brandName: string;
    websiteUrl: string;
    initialReport: BrandReport | null;
    initialIsRunning: boolean;
}

export function SiteAnalysisClient({
    configId,
    brandName,
    websiteUrl,
    initialReport,
    initialIsRunning,
}: Props) {
    const [report, setReport] = useState<BrandReport | null>(initialReport);
    const [isRunning, setIsRunning] = useState(initialIsRunning);
    const [isPending, startTransition] = useTransition();
    const [isExporting, setIsExporting] = useState(false);
    const [tipCategoryFilter, setTipCategoryFilter] = useState<string>('all');
    const [pageSearch, setPageSearch] = useState('');

    async function exportPdf() {
        if (!report?.id) return;
        setIsExporting(true);
        try {
            const link = document.createElement('a');
            link.href = `/api/export/brand-report?reportId=${report.id}`;
            link.download = `${brandName.replace(/[^a-z0-9]/gi, '_')}_report.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            // Small delay so the browser picks up the download before re-enabling
            setTimeout(() => setIsExporting(false), 2000);
        }
    }

    async function triggerReport() {
        setIsRunning(true);
        try {
            const res = await fetch('/api/visibility/brand-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            // Fetch the completed report
            const getRes = await fetch(`/api/visibility/brand-report?configId=${configId}`);
            if (getRes.ok) {
                const { report: r } = await getRes.json();
                setReport(r);
            }
        } catch (err) {
            console.error('Brand report generation failed:', err);
        } finally {
            setIsRunning(false);
        }
    }

    const crawl = report?.seoAuditData;
    const tips = report?.aiTips?.tips ?? [];
    const filteredTips = tipCategoryFilter === 'all'
        ? tips
        : tips.filter(t => t.category === tipCategoryFilter);
    const sortedTips = [...filteredTips].sort(
        (a, b) => (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 4) -
                  (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 4)
    );

    const pages = crawl?.pages ?? [];
    const filteredPages = pageSearch
        ? pages.filter(p => p.url.toLowerCase().includes(pageSearch.toLowerCase()))
        : pages;

    const gscQueries = report?.gscInsights?.topSearchQueries ?? [];

    const tipCategories = [...new Set(tips.map(t => t.category))];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
                        <Globe className="h-5 w-5 text-amber-500" />
                        Analisi Sito — {brandName}
                    </h1>
                    <p className="text-sm text-stone-500 mt-0.5">
                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {websiteUrl}
                        </a>
                        {report?.generatedAt && (
                            <span className="ml-2">
                                · Aggiornato {new Date(report.generatedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {report?.status === 'completed' && (
                        <Button
                            onClick={exportPdf}
                            disabled={isExporting}
                            variant="outline"
                            size="sm"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                            <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
                            {isExporting ? 'Download…' : 'Esporta PDF'}
                        </Button>
                    )}
                    <Button
                        onClick={() => startTransition(triggerReport)}
                        disabled={isRunning || isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        size="sm"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRunning || isPending ? 'animate-spin' : ''}`} />
                        {isRunning || isPending ? 'Analisi in corso…' : (report ? 'Rigenera Report' : 'Avvia Analisi')}
                    </Button>
                </div>
            </div>

            {/* Running state */}
            {(isRunning || isPending) && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="py-4 flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 text-amber-500 animate-spin flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-700">Analisi in corso…</p>
                            <p className="text-xs text-amber-600">Crawling sitemap, audit SEO+LLMO, generazione AI tips. Attendere 20-40 secondi.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!report && !isRunning && !isPending && (
                <Card className="border-stone-200">
                    <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                        <Globe className="h-10 w-10 text-stone-300" />
                        <p className="font-medium text-stone-600">Nessuna analisi disponibile</p>
                        <p className="text-sm text-stone-400 max-w-md">
                            Avvia la prima analisi per ottenere audit SEO, score LLMO, e AI tips personalizzati
                            basati sugli obiettivi strategici del brand.
                        </p>
                    </CardContent>
                </Card>
            )}

            {report && (
                <>
                    {/* Score cards */}
                    <Card className="border-stone-200">
                        <CardContent className="py-5">
                            <div className="flex flex-wrap items-center justify-around gap-6">
                                <ScoreRing score={report.overallScore} label="Score Globale" color="amber" />
                                <ScoreRing score={report.seoScore} label="SEO Tecnico" color="blue" />
                                <ScoreRing score={report.llmoScore} label="LLMO (AI)" color="purple" />
                                <ScoreRing score={report.geoScore} label="GEO (Menzioni)" color="green" />
                                <ScoreRing score={report.serpScore} label="SERP Presence" color="orange" />
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-2xl font-bold text-stone-700">{report.pagesAudited}</span>
                                    <span className="text-xs text-stone-500">Pagine auditate</span>
                                </div>
                                {crawl?.sitemapUrl && (
                                    <div className="flex flex-col items-center gap-1">
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                        <span className="text-xs text-stone-500 text-center">Sitemap trovata</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Summary */}
                    {report.aiTips?.summaryInsight && (
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="py-4 flex gap-3">
                                <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800">{report.aiTips.summaryInsight}</p>
                            </CardContent>
                        </Card>
                    )}

                    <Tabs defaultValue="tips">
                        <TabsList className="bg-stone-100">
                            <TabsTrigger value="tips">
                                <Bot className="h-4 w-4 mr-1.5" />
                                AI Tips {tips.length > 0 && <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 rounded">{tips.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="pages">
                                <FileText className="h-4 w-4 mr-1.5" />
                                Pagine {pages.length > 0 && <span className="ml-1 text-xs bg-stone-200 text-stone-600 px-1.5 rounded">{pages.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="issues">
                                <AlertTriangle className="h-4 w-4 mr-1.5" />
                                Problemi
                            </TabsTrigger>
                            <TabsTrigger value="gsc">
                                <Search className="h-4 w-4 mr-1.5" />
                                GSC
                            </TabsTrigger>
                        </TabsList>

                        {/* ── AI Tips tab ── */}
                        <TabsContent value="tips" className="mt-4 space-y-4">
                            {tips.length === 0 ? (
                                <p className="text-sm text-stone-400 py-4 text-center">Nessun AI tip disponibile. Rigenera il report.</p>
                            ) : (
                                <>
                                    {/* Category filter */}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setTipCategoryFilter('all')}
                                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${tipCategoryFilter === 'all' ? 'bg-amber-500 text-white border-amber-500' : 'border-stone-200 text-stone-500 hover:border-amber-300'}`}
                                        >
                                            Tutti ({tips.length})
                                        </button>
                                        {tipCategories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setTipCategoryFilter(cat)}
                                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${tipCategoryFilter === cat ? 'bg-amber-500 text-white border-amber-500' : 'border-stone-200 text-stone-500 hover:border-amber-300'}`}
                                            >
                                                {CATEGORY_LABELS[cat] ?? cat} ({tips.filter(t => t.category === cat).length})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-3">
                                        {sortedTips.map((tip, i) => <TipCard key={i} tip={tip} />)}
                                    </div>
                                </>
                            )}
                        </TabsContent>

                        {/* ── Pages tab ── */}
                        <TabsContent value="pages" className="mt-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Filtra per URL…"
                                value={pageSearch}
                                onChange={e => setPageSearch(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                            />
                            <div className="overflow-x-auto rounded-lg border border-stone-200">
                                <table className="w-full text-xs">
                                    <thead className="bg-stone-50 text-stone-500">
                                        <tr>
                                            <th className="text-left py-2.5 px-3 font-medium w-1/2">URL</th>
                                            <th className="text-center py-2.5 px-2 font-medium">SEO</th>
                                            <th className="text-center py-2.5 px-2 font-medium">LLMO</th>
                                            <th className="text-center py-2.5 px-2 font-medium">FAQ</th>
                                            <th className="text-center py-2.5 px-2 font-medium">Article</th>
                                            <th className="text-right py-2.5 px-3 font-medium">GSC Imp.</th>
                                            <th className="text-right py-2.5 px-3 font-medium">Pos.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPages.map((page, i) => (
                                            <tr key={i} className="border-t border-stone-100 hover:bg-stone-50/50">
                                                <td className="py-2 px-3">
                                                    <a href={page.url} target="_blank" rel="noopener noreferrer"
                                                        className="text-stone-600 hover:text-amber-600 truncate block max-w-xs">
                                                        {page.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                                    </a>
                                                    {page.fetchError && (
                                                        <span className="text-red-400 text-[10px]">Errore fetch</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-2 text-center"><ScoreBadge score={page.overallScore} /></td>
                                                <td className="py-2 px-2 text-center"><ScoreBadge score={page.llmo?.score ?? 0} /></td>
                                                <td className="py-2 px-2 text-center">
                                                    {page.llmo?.signals?.hasFAQSchema
                                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                                                        : <span className="text-stone-300">–</span>}
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    {page.llmo?.signals?.hasArticleSchema
                                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                                                        : <span className="text-stone-300">–</span>}
                                                </td>
                                                <td className="py-2 px-3 text-right text-stone-500">
                                                    {page.gscData ? page.gscData.impressions.toLocaleString() : '–'}
                                                </td>
                                                <td className="py-2 px-3 text-right text-stone-500">
                                                    {page.gscData ? page.gscData.position.toFixed(1) : '–'}
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredPages.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="py-6 text-center text-stone-400">
                                                    Nessuna pagina trovata
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* ── Issues tab ── */}
                        <TabsContent value="issues" className="mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="border-stone-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Search className="h-4 w-4 text-blue-500" />
                                            Top Problemi SEO
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {(crawl?.aggregated.topSeoIssues ?? []).map((issue, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-stone-600 flex-1">{issue.issue}</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Progress value={(issue.count / (report.pagesAudited || 1)) * 100} className="w-16 h-1.5" />
                                                    <span className="text-xs text-stone-400 w-6 text-right">{issue.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(crawl?.aggregated.topSeoIssues ?? []).length === 0 && (
                                            <p className="text-xs text-stone-400">Nessun problema rilevato</p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-stone-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Bot className="h-4 w-4 text-amber-500" />
                                            Top Problemi LLMO
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {(crawl?.aggregated.topLlmoIssues ?? []).map((issue, i) => (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-stone-600 flex-1">{issue.issue}</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Progress value={(issue.count / (report.pagesAudited || 1)) * 100} className="w-16 h-1.5" />
                                                    <span className="text-xs text-stone-400 w-6 text-right">{issue.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(crawl?.aggregated.topLlmoIssues ?? []).length === 0 && (
                                            <p className="text-xs text-stone-400">Nessun problema rilevato</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Schema distribution */}
                                {Object.keys(crawl?.aggregated.schemaTypeDistribution ?? {}).length > 0 && (
                                    <Card className="border-stone-200 md:col-span-2">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Schema.org rilevati</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(crawl?.aggregated.schemaTypeDistribution ?? {})
                                                    .sort((a, b) => b[1] - a[1])
                                                    .map(([type, count]) => (
                                                        <Badge key={type} variant="outline" className="bg-stone-50 border-stone-200 text-stone-600">
                                                            {type} <span className="ml-1 text-stone-400">×{count}</span>
                                                        </Badge>
                                                    ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── GSC tab ── */}
                        <TabsContent value="gsc" className="mt-4 space-y-4">
                            {gscQueries.length === 0 ? (
                                <Card className="border-stone-200">
                                    <CardContent className="py-8 text-center">
                                        <Search className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                                        <p className="text-sm text-stone-400">Dati GSC non disponibili.</p>
                                        <p className="text-xs text-stone-400 mt-1">
                                            Connetti Google Search Console tramite l&apos;integrazione CMS per visualizzare i dati.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-stone-200">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Search className="h-4 w-4 text-blue-500" />
                                            Query principali (Google Search Console)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="text-stone-500">
                                                    <tr>
                                                        <th className="text-left py-1.5 font-medium">Query</th>
                                                        <th className="text-right py-1.5 font-medium px-3">Impressioni</th>
                                                        <th className="text-right py-1.5 font-medium px-3">Click</th>
                                                        <th className="text-right py-1.5 font-medium px-3">CTR</th>
                                                        <th className="text-right py-1.5 font-medium">Pos.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gscQueries.slice(0, 20).map((q, i) => (
                                                        <tr key={i} className="border-t border-stone-100">
                                                            <td className="py-1.5 text-stone-700">{q.query}</td>
                                                            <td className="py-1.5 text-right px-3 text-stone-500">{q.impressions.toLocaleString()}</td>
                                                            <td className="py-1.5 text-right px-3 text-stone-500">{q.clicks.toLocaleString()}</td>
                                                            <td className="py-1.5 text-right px-3">
                                                                <span className={q.impressions > 0 && (q.clicks / q.impressions) < 0.02 ? 'text-red-500' : 'text-stone-500'}>
                                                                    {q.impressions > 0 ? ((q.clicks / q.impressions) * 100).toFixed(1) + '%' : '–'}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 text-right text-stone-500">{q.position.toFixed(1)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}

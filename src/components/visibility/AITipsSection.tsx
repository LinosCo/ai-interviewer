'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Lightbulb,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    Target,
    FileText,
    Code,
    Sparkles,
    Globe,
    Check,
    X,
    Archive,
    RotateCcw
} from "lucide-react";

interface Recommendation {
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    relatedPrompts?: string[];
    dataSource?: string;
    strategyAlignment?: string;
    evidencePoints?: string[];
    explainability?: {
        logic?: string;
        strategicGoal?: string;
        evidence?: string[];
        confidence?: number;
        channelsEvaluated?: string[];
    };
    implementation?: {
        publishChannel?: 'CMS_API' | 'WORDPRESS_MCP' | 'WOOCOMMERCE_MCP' | 'MANUAL';
        contentKind?: string;
        contentMode?: 'STATIC' | 'DYNAMIC';
    };
    contentDraft?: {
        title: string;
        slug: string;
        body: string;
        metaDescription?: string;
        targetSection?: string;
        mediaBrief?: string;
    };
}

interface TipAction {
    id: string;
    tipKey: string;
    tipTitle: string;
    tipType: string;
    status: 'active' | 'completed' | 'dismissed';
    completedAt?: string;
    dismissedAt?: string;
}

interface WebsiteAnalysis {
    id: string;
    overallScore: number;
    structuredDataScore: number;
    valuePropositionScore: number;
    keywordCoverageScore: number;
    contentClarityScore: number;
    recommendations: Recommendation[];
    promptsAddressed: {
        addressed: string[];
        gaps: string[];
    };
    completedAt: string;
    pageTitle?: string;
}

interface AITipsSectionProps {
    configId: string;
    websiteUrl?: string | null;
}

function generateTipKey(title: string, type: string): string {
    // Simple hash for client-side matching
    let hash = 0;
    const str = `${title}-${type}`;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 16);
}

export function AITipsSection({ configId, websiteUrl }: AITipsSectionProps) {
    const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
    const [tipActions, setTipActions] = useState<TipAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [expandedRec, setExpandedRec] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState('active');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [draftOpen, setDraftOpen] = useState(false);
    const [draftRec, setDraftRec] = useState<Recommendation | null>(null);
    const [draftForm, setDraftForm] = useState({
        title: '',
        slug: '',
        body: '',
        metaDescription: '',
        targetSection: 'pages'
    });
    const [draftSaving, setDraftSaving] = useState(false);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [draftSuccessId, setDraftSuccessId] = useState<string | null>(null);

    const fetchTipActions = useCallback(async () => {
        try {
            const res = await fetch(`/api/visibility/tip-actions?configId=${configId}`);
            if (res.ok) {
                const data = await res.json();
                setTipActions(data.tipActions || []);
            }
        } catch (error) {
            console.error('Error fetching tip actions:', error);
        }
    }, [configId]);

    const fetchAnalysis = useCallback(async () => {
        try {
            const res = await fetch(`/api/visibility/website-analysis?configId=${configId}`);
            if (res.ok) {
                const data = await res.json();
                setAnalysis(data.analysis);
                setRunning(data.isRunning);
            }
        } catch (error) {
            console.error('Error fetching analysis:', error);
        } finally {
            setLoading(false);
        }
    }, [configId]);

    useEffect(() => {
        if (websiteUrl) {
            fetchAnalysis();
            fetchTipActions();
        } else {
            setLoading(false);
        }
    }, [configId, websiteUrl, fetchAnalysis, fetchTipActions]);

    const runAnalysis = async () => {
        if (!websiteUrl) return;
        setRunning(true);
        try {
            const res = await fetch('/api/visibility/website-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId })
            });
            if (res.ok) {
                const pollInterval = setInterval(async () => {
                    const pollRes = await fetch(`/api/visibility/website-analysis?configId=${configId}`);
                    if (pollRes.ok) {
                        const data = await pollRes.json();
                        if (!data.isRunning) {
                            clearInterval(pollInterval);
                            setAnalysis(data.analysis);
                            setRunning(false);
                        }
                    }
                }, 3000);

                setTimeout(() => {
                    clearInterval(pollInterval);
                    setRunning(false);
                    fetchAnalysis();
                }, 120000);
            }
        } catch (error) {
            console.error('Error running analysis:', error);
            setRunning(false);
        }
    };

    const handleTipAction = async (rec: Recommendation, action: 'complete' | 'dismiss' | 'restore') => {
        const tipKey = generateTipKey(rec.title, rec.type);
        setActionLoading(tipKey);

        try {
            const res = await fetch('/api/visibility/tip-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    configId,
                    tipTitle: rec.title,
                    tipType: rec.type,
                    action
                })
            });

            if (res.ok) {
                await fetchTipActions();
            }
        } catch (error) {
            console.error('Error updating tip action:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const getTipStatus = (rec: Recommendation): 'active' | 'completed' | 'dismissed' => {
        const tipKey = generateTipKey(rec.title, rec.type);
        const action = tipActions.find(a => a.tipKey === tipKey);
        return action?.status || 'active';
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getPriorityBadge = (priority: string) => {
        const colors = {
            high: 'bg-red-100 text-red-700 border-red-200',
            medium: 'bg-amber-100 text-amber-700 border-amber-200',
            low: 'bg-blue-100 text-blue-700 border-blue-200'
        };
        return colors[priority as keyof typeof colors] || colors.medium;
    };

    const getTypeIcon = (type: string) => {
        const icons: Record<string, React.ElementType> = {
            'add_structured_data': Code,
            'improve_value_proposition': Target,
            'add_keyword_content': FileText,
            'improve_clarity': Sparkles,
            'add_page': FileText,
            'modify_content': FileText,
            'add_faq': FileText,
            'improve_meta': Globe,
            'social_post': Sparkles,
            'product_content_optimization': Target
        };
        const Icon = icons[type] || Lightbulb;
        return <Icon className="w-4 h-4" />;
    };

    const slugify = (value: string) =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9àèéìòùäöüßçñ\s-]/gi, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 80);

    const openDraftDialog = (rec: Recommendation) => {
        const draft = rec.contentDraft;
        setDraftRec(rec);
        setDraftSuccessId(null);
        setDraftError(null);
        setDraftForm({
            title: draft?.title || rec.title || '',
            slug: draft?.slug || (draft?.title ? slugify(draft.title) : rec.title ? slugify(rec.title) : ''),
            body: draft?.body || rec.description || '',
            metaDescription: draft?.metaDescription || '',
            targetSection: draft?.targetSection || 'pages'
        });
        setDraftOpen(true);
    };

    const handleCreateDraft = async () => {
        if (!draftRec) return;
        setDraftSaving(true);
        setDraftError(null);

        try {
            const res = await fetch('/api/visibility/website-analysis/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    configId,
                    recommendation: draftRec,
                    draft: {
                        ...draftForm,
                        slug: draftForm.slug || slugify(draftForm.title)
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setDraftError(data.error || 'Errore durante la creazione della bozza');
                return;
            }

            setDraftSuccessId(data.suggestionId);
        } catch {
            setDraftError('Errore di rete durante la creazione della bozza');
        } finally {
            setDraftSaving(false);
        }
    };

    // Filter recommendations by status
    const activeRecs = analysis?.recommendations?.filter(rec => getTipStatus(rec) === 'active') || [];
    const completedRecs = analysis?.recommendations?.filter(rec => getTipStatus(rec) === 'completed') || [];
    const dismissedRecs = analysis?.recommendations?.filter(rec => getTipStatus(rec) === 'dismissed') || [];
    const archivedRecs = [...completedRecs, ...dismissedRecs];

    if (!websiteUrl) {
        return (
            <Card className="border-dashed border-2">
                <CardContent className="p-6 text-center">
                    <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <h4 className="font-medium text-gray-700">AI Tips Non Disponibili</h4>
                    <p className="text-sm text-gray-500 mt-1">
                        Aggiungi l&apos;URL del sito nelle impostazioni per ricevere suggerimenti di ottimizzazione AI.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">Caricamento analisi...</p>
                </CardContent>
            </Card>
        );
    }

    const renderRecommendation = (rec: Recommendation, idx: number, showActions: boolean = true) => {
        const tipKey = generateTipKey(rec.title, rec.type);
        const status = getTipStatus(rec);
        const isLoading = actionLoading === tipKey;

        return (
            <div
                key={`${rec.title}-${idx}`}
                className={`bg-white rounded-lg border overflow-hidden ${
                    status === 'completed' ? 'border-green-200 bg-green-50/30' :
                    status === 'dismissed' ? 'border-slate-200 opacity-60' :
                    'border-slate-200'
                }`}
            >
                <div
                    className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedRec(expandedRec === idx ? null : idx)}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`p-1 rounded shrink-0 ${
                            status === 'completed' ? 'bg-green-100' :
                            status === 'dismissed' ? 'bg-slate-100' :
                            'bg-slate-100'
                        }`}>
                            {status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                getTypeIcon(rec.type)
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className={`font-medium text-xs truncate ${
                                status === 'completed' ? 'text-green-700 line-through' :
                                status === 'dismissed' ? 'text-slate-500 line-through' :
                                'text-slate-800'
                            }`}>
                                {rec.title}
                            </div>
                            <Badge variant="outline" className={`text-[9px] h-4 px-1 ${getPriorityBadge(rec.priority)}`}>
                                {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {showActions && status === 'active' && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTipAction(rec, 'complete');
                                    }}
                                    disabled={isLoading}
                                    className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                    title="Segna come completato"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTipAction(rec, 'dismiss');
                                    }}
                                    disabled={isLoading}
                                    className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                                    title="Scarta"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                        {showActions && status !== 'active' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTipAction(rec, 'restore');
                                }}
                                disabled={isLoading}
                                className="p-1 rounded hover:bg-blue-100 text-blue-500 transition-colors"
                                title="Ripristina"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {expandedRec === idx ?
                            <ChevronUp className="w-4 h-4 text-slate-400" /> :
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        }
                    </div>
                </div>
                {expandedRec === idx && (
                    <div className="px-2 pb-2 pt-0 border-t bg-slate-50/50">
                        <p className="text-[11px] text-slate-600 mt-2">{rec.description}</p>
                        <div className="mt-2 p-1.5 bg-green-50 rounded text-[10px] text-green-700">
                            <strong>Impatto:</strong> {rec.impact}
                        </div>
                        {rec.relatedPrompts && rec.relatedPrompts.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {rec.relatedPrompts.slice(0, 2).map((p, i) => (
                                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded truncate max-w-[120px]">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        )}
                        {rec.dataSource && (
                            <div className="mt-1.5 text-[9px] text-slate-500">
                                Fonte: {rec.dataSource}
                            </div>
                        )}
                        {(rec.strategyAlignment || rec.evidencePoints?.length || rec.explainability?.logic) && (
                            <div className="mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded text-[10px] text-indigo-900 space-y-1">
                                {rec.strategyAlignment && (
                                    <div><strong>Allineamento:</strong> {rec.strategyAlignment}</div>
                                )}
                                {rec.explainability?.logic && (
                                    <div><strong>Logica:</strong> {rec.explainability.logic}</div>
                                )}
                                {(rec.evidencePoints?.length || rec.explainability?.evidence?.length) && (
                                    <div>
                                        <strong>Evidenze:</strong>{' '}
                                        {(rec.evidencePoints || rec.explainability?.evidence || []).slice(0, 3).join(' | ')}
                                    </div>
                                )}
                            </div>
                        )}
                        {rec.implementation && (
                            <div className="mt-1.5 text-[9px] text-slate-500">
                                Routing: {rec.implementation.publishChannel || 'N/D'} · {rec.implementation.contentKind || 'N/D'}
                            </div>
                        )}
                        {rec.contentDraft && (
                            <div className="mt-2 p-2 bg-white border border-slate-200 rounded">
                                <div className="text-[10px] font-semibold text-slate-700 mb-1">Bozza contenuto</div>
                                <div className="text-[10px] text-slate-600 line-clamp-3 whitespace-pre-wrap">
                                    {rec.contentDraft.body?.slice(0, 220)}
                                    {rec.contentDraft.body && rec.contentDraft.body.length > 220 ? '…' : ''}
                                </div>
                                {rec.contentDraft.mediaBrief && (
                                    <div className="mt-1 text-[9px] text-slate-500">
                                        Media brief: {rec.contentDraft.mediaBrief.slice(0, 140)}{rec.contentDraft.mediaBrief.length > 140 ? '…' : ''}
                                    </div>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 h-7 text-[10px]"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openDraftDialog(rec);
                                    }}
                                >
                                    Modifica & crea bozza CMS
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Lightbulb className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">AI Tips</CardTitle>
                            <CardDescription className="text-xs">
                                Ottimizzazione per LLM e motori di ricerca
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={runAnalysis}
                        disabled={running}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
                        {running ? 'Analisi...' : 'Analizza'}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {analysis ? (
                    <>
                        {/* Score Overview */}
                        <div className="grid grid-cols-5 gap-2">
                            <div className={`p-2 rounded-lg text-center border ${getScoreColor(analysis.overallScore)}`}>
                                <div className="text-xl font-bold">{analysis.overallScore}</div>
                                <div className="text-[9px] font-medium opacity-80">TOTALE</div>
                            </div>
                            <div className="p-2 rounded-lg text-center bg-slate-50 border border-slate-100">
                                <div className="text-sm font-semibold text-slate-700">{analysis.structuredDataScore}</div>
                                <div className="text-[8px] text-slate-500">Schema</div>
                            </div>
                            <div className="p-2 rounded-lg text-center bg-slate-50 border border-slate-100">
                                <div className="text-sm font-semibold text-slate-700">{analysis.valuePropositionScore}</div>
                                <div className="text-[8px] text-slate-500">Value</div>
                            </div>
                            <div className="p-2 rounded-lg text-center bg-slate-50 border border-slate-100">
                                <div className="text-sm font-semibold text-slate-700">{analysis.keywordCoverageScore}</div>
                                <div className="text-[8px] text-slate-500">Keywords</div>
                            </div>
                            <div className="p-2 rounded-lg text-center bg-slate-50 border border-slate-100">
                                <div className="text-sm font-semibold text-slate-700">{analysis.contentClarityScore}</div>
                                <div className="text-[8px] text-slate-500">Clarity</div>
                            </div>
                        </div>

                        {/* Prompt Coverage */}
                        <div className="bg-white rounded-lg border p-3">
                            <h4 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-amber-600" />
                                Copertura Prompt
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="flex items-center gap-1 text-green-700 text-[10px] font-medium mb-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Coperti ({analysis.promptsAddressed.addressed.length})
                                    </div>
                                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                        {analysis.promptsAddressed.addressed.slice(0, 3).map((prompt, i) => (
                                            <div key={i} className="text-[10px] text-slate-600 truncate bg-green-50 px-1.5 py-0.5 rounded">
                                                {prompt}
                                            </div>
                                        ))}
                                        {analysis.promptsAddressed.addressed.length > 3 && (
                                            <div className="text-[9px] text-green-600">+{analysis.promptsAddressed.addressed.length - 3} altri</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-amber-700 text-[10px] font-medium mb-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Gap ({analysis.promptsAddressed.gaps.length})
                                    </div>
                                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                        {analysis.promptsAddressed.gaps.slice(0, 3).map((prompt, i) => (
                                            <div key={i} className="text-[10px] text-slate-600 truncate bg-amber-50 px-1.5 py-0.5 rounded">
                                                {prompt}
                                            </div>
                                        ))}
                                        {analysis.promptsAddressed.gaps.length > 3 && (
                                            <div className="text-[9px] text-amber-600">+{analysis.promptsAddressed.gaps.length - 3} altri</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recommendations with Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-8">
                                <TabsTrigger value="active" className="text-xs gap-1.5">
                                    <Lightbulb className="w-3 h-3" />
                                    Attivi ({activeRecs.length})
                                </TabsTrigger>
                                <TabsTrigger value="archived" className="text-xs gap-1.5">
                                    <Archive className="w-3 h-3" />
                                    Archivio ({archivedRecs.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="active" className="mt-2">
                                {activeRecs.length > 0 ? (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                        {activeRecs.map((rec, idx) => renderRecommendation(rec, idx))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-500">
                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                                        <p className="text-xs">Tutti i suggerimenti sono stati completati o archiviati!</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={runAnalysis}
                                            disabled={running}
                                            className="mt-3 gap-2"
                                        >
                                            <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
                                            Genera nuovi suggerimenti
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="archived" className="mt-2">
                                {archivedRecs.length > 0 ? (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                        {completedRecs.length > 0 && (
                                            <>
                                                <div className="text-[10px] font-medium text-green-600 flex items-center gap-1 mb-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Completati ({completedRecs.length})
                                                </div>
                                                {completedRecs.map((rec, idx) => renderRecommendation(rec, idx + 1000))}
                                            </>
                                        )}
                                        {dismissedRecs.length > 0 && (
                                            <>
                                                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 mb-1 mt-2">
                                                    <X className="w-3 h-3" />
                                                    Scartati ({dismissedRecs.length})
                                                </div>
                                                {dismissedRecs.map((rec, idx) => renderRecommendation(rec, idx + 2000))}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-400">
                                        <Archive className="w-8 h-8 mx-auto mb-2" />
                                        <p className="text-xs">Nessun suggerimento archiviato</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <div className="text-[10px] text-slate-400 text-center pt-2 border-t">
                            Ultima analisi: {new Date(analysis.completedAt).toLocaleString('it-IT')}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4">
                        <Lightbulb className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-700 text-sm">Nessuna Analisi</h4>
                        <p className="text-xs text-gray-500 mt-1 mb-3">
                            Analizza il sito per ricevere suggerimenti di ottimizzazione.
                        </p>
                        <Button onClick={runAnalysis} disabled={running} size="sm" className="gap-2">
                            <Sparkles className="w-4 h-4" />
                            {running ? 'Analisi in corso...' : 'Avvia Analisi'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
        <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bozza contenuto per il sito</DialogTitle>
                    <DialogDescription>
                        Personalizza il testo prima di inviarlo al CMS come bozza.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Titolo</label>
                        <Input
                            value={draftForm.title}
                            onChange={(e) => setDraftForm(prev => ({ ...prev, title: e.target.value, slug: prev.slug || slugify(e.target.value) }))}
                            placeholder="Titolo della pagina"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Slug</label>
                            <Input
                                value={draftForm.slug}
                                onChange={(e) => setDraftForm(prev => ({ ...prev, slug: e.target.value }))}
                                placeholder="titolo-pagina"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Sezione</label>
                            <select
                                value={draftForm.targetSection}
                                onChange={(e) => setDraftForm(prev => ({ ...prev, targetSection: e.target.value }))}
                                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                            >
                                <option value="pages">Pagine</option>
                                <option value="faq">FAQ</option>
                                <option value="news">News</option>
                                <option value="blog">Blog</option>
                                <option value="support">Supporto</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Meta Description</label>
                        <Input
                            value={draftForm.metaDescription}
                            onChange={(e) => setDraftForm(prev => ({ ...prev, metaDescription: e.target.value }))}
                            placeholder="Meta description (max 160 caratteri)"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Contenuto (Markdown)</label>
                        <textarea
                            value={draftForm.body}
                            onChange={(e) => setDraftForm(prev => ({ ...prev, body: e.target.value }))}
                            className="w-full min-h-[220px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                            placeholder="Contenuto della pagina in Markdown"
                        />
                    </div>
                    {draftError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                            {draftError}
                        </div>
                    )}
                    {draftSuccessId && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                            Bozza creata. Puoi modificarla o inviarla dal CMS.
                            <a href={`/dashboard/cms/suggestions?id=${draftSuccessId}`} className="ml-2 underline">
                                Apri suggerimento
                            </a>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setDraftOpen(false)}
                        disabled={draftSaving}
                    >
                        Chiudi
                    </Button>
                    <Button
                        onClick={handleCreateDraft}
                        disabled={draftSaving || !draftForm.title || !draftForm.body}
                    >
                        {draftSaving ? 'Creazione...' : 'Crea bozza CMS'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

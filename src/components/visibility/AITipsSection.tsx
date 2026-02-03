'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    Globe
} from "lucide-react";

interface Recommendation {
    type: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    relatedPrompts?: string[];
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

export function AITipsSection({ configId, websiteUrl }: AITipsSectionProps) {
    const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [expandedRec, setExpandedRec] = useState<number | null>(null);

    useEffect(() => {
        if (websiteUrl) {
            fetchAnalysis();
        } else {
            setLoading(false);
        }
    }, [configId, websiteUrl]);

    const fetchAnalysis = async () => {
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
    };

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
                // Poll for completion
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

                // Timeout after 2 minutes
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
            'improve_meta': Globe
        };
        const Icon = icons[type] || Lightbulb;
        return <Icon className="w-4 h-4" />;
    };

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

    return (
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

                        {/* Recommendations */}
                        <div>
                            <h4 className="text-xs font-semibold text-slate-800 mb-2">
                                Raccomandazioni ({analysis.recommendations?.length || 0})
                            </h4>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {analysis.recommendations?.map((rec, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                                    >
                                        <div
                                            className="p-2 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                                            onClick={() => setExpandedRec(expandedRec === idx ? null : idx)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="p-1 bg-slate-100 rounded shrink-0">
                                                    {getTypeIcon(rec.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-xs text-slate-800 truncate">{rec.title}</div>
                                                    <Badge variant="outline" className={`text-[9px] h-4 px-1 ${getPriorityBadge(rec.priority)}`}>
                                                        {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Bassa'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {expandedRec === idx ?
                                                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> :
                                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                            }
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
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

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
    );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Target, AlertTriangle, Lightbulb, TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface GapItem {
    source: string;
    displayName: string;
    count: number;
    withBrand: number;
    withoutBrand: number;
    competitorCount: number;
    totalCompetitorMentions: number;
    competitors: { name: string; mentions: number }[];
    platforms: string[];
    gapScore: number;
    opportunity: 'high' | 'medium' | 'low';
    suggestion: string;
}

interface Props {
    configId: string;
}

export function GapAnalysisSection({ configId }: Props) {
    const [gapData, setGapData] = useState<GapItem[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/visibility/analytics?configId=${configId}`);
                if (res.ok) {
                    const data = await res.json();
                    setGapData(data.gapAnalysis || []);
                    setStats(data.stats || null);
                }
            } catch (err) {
                console.error('Error fetching GAP analysis:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [configId]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        GAP Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Caricamento...</div>
                </CardContent>
            </Card>
        );
    }

    if (gapData.length === 0) {
        return (
            <Card className="border-green-200 bg-green-50/30">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-green-600" />
                        GAP Analysis
                    </CardTitle>
                    <CardDescription>Opportunità dove i competitor sono citati ma tu no</CardDescription>
                </CardHeader>
                <CardContent className="py-8 text-center">
                    <TrendingUp className="w-12 h-12 text-green-300 mx-auto mb-3" />
                    <h4 className="font-semibold text-green-800">Nessun GAP Rilevato</h4>
                    <p className="text-sm text-green-600 mt-1">
                        Il tuo brand è presente in tutte le fonti dove compaiono i competitor.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const highPriorityCount = gapData.filter(g => g.opportunity === 'high').length;
    const mediumPriorityCount = gapData.filter(g => g.opportunity === 'medium').length;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-600" />
                            GAP Analysis - Opportunità
                        </CardTitle>
                        <CardDescription>
                            Fonti dove i competitor compaiono ma il tuo brand no
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {highPriorityCount > 0 && (
                            <Badge className="bg-red-100 text-red-700 gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {highPriorityCount} Alta priorità
                            </Badge>
                        )}
                        {mediumPriorityCount > 0 && (
                            <Badge className="bg-amber-100 text-amber-700">
                                {mediumPriorityCount} Media
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {gapData.map((item, idx) => {
                    const isExpanded = expandedItem === item.source;

                    return (
                        <div
                            key={item.source}
                            className={`rounded-xl border overflow-hidden transition-all ${
                                item.opportunity === 'high'
                                    ? 'border-red-200 bg-red-50/50'
                                    : item.opportunity === 'medium'
                                    ? 'border-amber-200 bg-amber-50/50'
                                    : 'border-slate-200 bg-slate-50/50'
                            }`}
                        >
                            <div
                                className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                                onClick={() => setExpandedItem(isExpanded ? null : item.source)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] ${
                                                    item.opportunity === 'high'
                                                        ? 'border-red-300 bg-red-100 text-red-700'
                                                        : item.opportunity === 'medium'
                                                        ? 'border-amber-300 bg-amber-100 text-amber-700'
                                                        : 'border-slate-300 bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                #{idx + 1} • GAP {item.gapScore}%
                                            </Badge>
                                            {item.source.startsWith('http') && (
                                                <a
                                                    href={item.source}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-400 hover:text-purple-600 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        <h4 className="font-semibold text-slate-900 truncate">
                                            {item.displayName}
                                        </h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span>Citato {item.count}x</span>
                                            <span className="text-red-600">Brand assente {item.withoutBrand}x</span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {item.competitorCount} competitor
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.opportunity === 'high' && (
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                        )}
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 bg-white/50">
                                    {/* Competitors on this source */}
                                    <div className="pt-3">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Competitor presenti su questa fonte
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                            {item.competitors.map(comp => (
                                                <Badge
                                                    key={comp.name}
                                                    variant="outline"
                                                    className="bg-purple-50 border-purple-200 text-purple-700"
                                                >
                                                    {comp.name}
                                                    <span className="ml-1 text-purple-400">
                                                        ({comp.mentions}x)
                                                    </span>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Platforms */}
                                    <div>
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Piattaforme LLM
                                        </h5>
                                        <div className="flex flex-wrap gap-1">
                                            {item.platforms.map(p => (
                                                <span
                                                    key={p}
                                                    className="text-[10px] px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500 uppercase"
                                                >
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Suggestion */}
                                    <div className="p-3 bg-purple-50 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <Lightbulb className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                                            <div>
                                                <h5 className="text-xs font-bold text-purple-800 mb-1">
                                                    Azione Suggerita
                                                </h5>
                                                <p className="text-sm text-purple-700">
                                                    {item.suggestion}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                <p className="text-xs text-slate-400 text-center pt-2">
                    Le fonti con GAP alto indicano opportunità dove i competitor dominano ma il tuo brand è assente
                </p>
            </CardContent>
        </Card>
    );
}

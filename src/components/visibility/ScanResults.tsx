'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface ScanData {
    id: string;
    completedAt: Date;
    score: number;
    platformScores: { platform: string; score: number; total: number; mentions: number }[];
    responses: {
        id: string;
        platform: string;
        model: string;
        promptText: string;
        brandMentioned: boolean;
        brandPosition: number | null;
        sentiment: string | null;
        responseText: string;
        competitorPositions: Record<string, number | null>;
    }[];
    partial: boolean;
}

export function ScanResults({ scan, totalScans }: { scan: ScanData | null, totalScans: number }) {
    const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

    if (!scan) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <h4 className="text-sm font-semibold text-blue-800">Nessun dato disponibile</h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Non hai ancora effettuato scansioni. Avvia una nuova scansione per vedere i risultati.
                    </p>
                </div>
            </div>
        );
    }

    const { score, platformScores, responses, partial } = scan;

    // Prepare chart data for platforms
    const chartData = platformScores.map(p => ({
        name: p.platform,
        score: p.score,
        mentions: p.mentions,
        total: p.total
    }));

    // Calculate competitor mentions
    const competitorStatsMap: Record<string, { mentions: number, total: number, avgPosition: number | null }> = {};

    responses.forEach(r => {
        Object.entries(r.competitorPositions).forEach(([name, pos]) => {
            if (!competitorStatsMap[name]) {
                competitorStatsMap[name] = { mentions: 0, total: 0, avgPosition: 0 };
            }
            competitorStatsMap[name].total++;
            if (pos !== null) {
                competitorStatsMap[name].mentions++;
                // We'll calculate avg position later
                competitorStatsMap[name].avgPosition = (competitorStatsMap[name].avgPosition || 0) + pos;
            }
        });
    });

    const competitorData = Object.entries(competitorStatsMap).map(([name, stats]) => ({
        name,
        score: Math.round((stats.mentions / stats.total) * 100),
        mentions: stats.mentions,
        avgPosition: stats.mentions > 0 ? Math.round((stats.avgPosition || 0) / stats.mentions * 10) / 10 : null
    })).sort((a, b) => b.score - a.score);

    const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

    return (
        <div className="space-y-6">
            {partial && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-yellow-800">Risultati Parziali</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                            Alcuni provider LLM non sono configurati o hanno restituito errori. I risultati mostrati si basano solo sui dati disponibili.
                        </p>
                    </div>
                </div>
            )}

            {/* Score Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-90">Visibility Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{score}%</div>
                        <p className="text-xs opacity-80 mt-1">Menzioni totali del brand</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Copertura Piattaforme</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{platformScores.length} / 3</div>
                        <p className="text-xs text-muted-foreground">Motori AI attivi</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Analisi Prompt</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{responses.length}</div>
                        <p className="text-xs text-muted-foreground">Risposte analizzate</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Scansioni Totali</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalScans}</div>
                        <p className="text-xs text-muted-foreground">Eseguite finora</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Platform Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Visibility per Platform</CardTitle>
                        <CardDescription>Percentuale di menzioni per ogni motore AI</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="score" name="Visibility %" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Competitor Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Competitor Mentions</CardTitle>
                        <CardDescription>Confronto visibilità tra il tuo brand e i competitor</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {competitorData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: 'Il tuo Brand', score: score, color: '#f59e0b' },
                                    ...competitorData.map((c, i) => ({ ...c, color: COLORS[(i + 1) % COLORS.length] }))
                                ]} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" domain={[0, 100]} hide />
                                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Bar dataKey="score" name="Visibility %" radius={[0, 6, 6, 0]}>
                                        {[
                                            { color: '#f59e0b' },
                                            ...competitorData.map((c, i) => ({ color: COLORS[(i + 1) % COLORS.length] }))
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                                <Info className="w-8 h-8 opacity-20" />
                                <p className="text-sm">Nessun competitor configurato</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Responses List */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg">Monitor Dettagliato Risposte</CardTitle>
                            <CardDescription>Visualizza le risposte complete generate dagli LLM</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {responses.map((res) => {
                            const isExpanded = expandedResponse === res.id;

                            // Find competitors mentioned in this response
                            const mentionedCompetitors = Object.entries(res.competitorPositions)
                                .filter(([_, pos]) => pos !== null)
                                .map(([name, pos]) => ({ name, pos }));

                            return (
                                <div key={res.id} className="border rounded-xl overflow-hidden bg-white hover:border-amber-200 transition-colors">
                                    <div
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                                        onClick={() => setExpandedResponse(isExpanded ? null : res.id)}
                                    >
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="capitalize bg-slate-50 border-slate-200">
                                                    {res.platform} <span className="text-slate-400 ml-1 text-[10px]">({res.model})</span>
                                                </Badge>
                                                {res.sentiment && (
                                                    <Badge variant={
                                                        res.sentiment === 'positive' ? 'default' :
                                                            res.sentiment === 'negative' ? 'destructive' : 'secondary'
                                                    } className="text-[10px] px-2 h-5 flex items-center bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100">
                                                        {res.sentiment}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="font-semibold text-slate-900 leading-tight">
                                                "{res.promptText}"
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-end">
                                                <Badge variant={res.brandMentioned ? 'default' : 'secondary'} className={
                                                    res.brandMentioned ? "bg-green-600 hover:bg-green-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                }>
                                                    {res.brandPosition ? `Brand: Pos. ${res.brandPosition}` : (res.brandMentioned ? 'Brand Menzionato' : 'Brand Non Trovato')}
                                                </Badge>
                                                {mentionedCompetitors.length > 0 && (
                                                    <span className="text-[10px] text-muted-foreground mt-1">
                                                        {mentionedCompetitors.length} competitor menzionati
                                                    </span>
                                                )}
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 pt-0 border-t border-slate-50 bg-slate-50/50">
                                            <div className="mt-4 space-y-4">
                                                {/* Competitor Positioning in this response */}
                                                {mentionedCompetitors.length > 0 && (
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Posizionamento Competitor</h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {mentionedCompetitors.map(c => (
                                                                <Badge key={c.name} variant="outline" className="bg-amber-50 border-amber-100 text-amber-800">
                                                                    {c.name}: Pos. {c.pos}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Trascrizione Risposta LLM</h5>
                                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                                                        {res.responseText}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

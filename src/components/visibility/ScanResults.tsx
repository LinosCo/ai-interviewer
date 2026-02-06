'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, Info, Link2, Globe } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ScanData {
    id: string;
    brandName: string;
    completedAt: Date;
    score: number;
    language?: string;
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
        sourcesCited: string[];
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

    const { score, platformScores, responses, partial, brandName, language } = scan;

    const languageLabel = (() => {
        const value = (language || 'it').toLowerCase();
        if (value === 'it') return 'Italiano';
        if (value === 'en') return 'English';
        if (value === 'es') return 'Español';
        if (value === 'fr') return 'Français';
        if (value === 'de') return 'Deutsch';
        return value.toUpperCase();
    })();

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

    // LLM Platform styling with proper contrast
    const getLLMBadgeStyle = (platform: string): { bg: string, text: string, border: string, label: string } => {
        const platformLower = platform.toLowerCase();
        if (platformLower.includes('openai') || platformLower.includes('gpt')) {
            return { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700', label: 'OpenAI' };
        }
        if (platformLower.includes('anthropic') || platformLower.includes('claude')) {
            return { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600', label: 'Anthropic' };
        }
        if (platformLower.includes('google') || platformLower.includes('gemini')) {
            return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700', label: 'Google' };
        }
        if (platformLower.includes('perplexity')) {
            return { bg: 'bg-cyan-600', text: 'text-white', border: 'border-cyan-700', label: 'Perplexity' };
        }
        return { bg: 'bg-slate-600', text: 'text-white', border: 'border-slate-700', label: platform };
    };

    // Helper to extract domain from URL
    const extractDomain = (url: string): { domain: string, isUrl: boolean, fullUrl: string } => {
        try {
            if (url.startsWith('http')) {
                const urlObj = new URL(url);
                return {
                    domain: urlObj.hostname.replace('www.', ''),
                    isUrl: true,
                    fullUrl: url
                };
            }
            // Try to detect if it's a domain without protocol
            if (url.includes('.') && !url.includes(' ')) {
                return {
                    domain: url.replace('www.', ''),
                    isUrl: true,
                    fullUrl: `https://${url}`
                };
            }
            return { domain: url, isUrl: false, fullUrl: '' };
        } catch {
            return { domain: url, isUrl: false, fullUrl: '' };
        }
    };

    // Aggregate sources by frequency and brand mention association
    const sourceStats: Record<string, { count: number, withBrand: number, platforms: Set<string>, display: string }> = {};
    responses.forEach(r => {
        const sources = r.sourcesCited || [];
        sources.forEach(source => {
            if (!source) return;
            const trimmedSource = source.trim();
            const normalizedSource = trimmedSource.toLowerCase();
            if (!sourceStats[normalizedSource]) {
                sourceStats[normalizedSource] = { count: 0, withBrand: 0, platforms: new Set(), display: trimmedSource };
            }
            sourceStats[normalizedSource].count++;
            sourceStats[normalizedSource].platforms.add(r.platform);
            if (r.brandMentioned) {
                sourceStats[normalizedSource].withBrand++;
            }
        });
    });

    const sourcesData = Object.entries(sourceStats)
        .map(([source, stats]) => ({
            source: stats.display,
            count: stats.count,
            withBrand: stats.withBrand,
            platforms: Array.from(stats.platforms),
            // Importance score: frequency + brand association bonus
            importance: stats.count + (stats.withBrand * 0.5)
        }))
        .filter((entry) => {
            if (entry.withBrand > 0) {
                return extractDomain(entry.source).isUrl;
            }
            return true;
        })
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 15); // Top 15 sources

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const highlightBrand = (text: string) => {
        if (!brandName) return text;
        const safe = escapeRegExp(brandName);
        if (!safe) return text;
        const regex = new RegExp(`(${safe})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, idx) => {
            if (part.toLowerCase() === brandName.toLowerCase()) {
                return (
                    <mark key={idx} className="bg-amber-200 text-amber-900 rounded px-1">
                        {part}
                    </mark>
                );
            }
            return <span key={idx}>{part}</span>;
        });
    };

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
                        <p className="text-[11px] opacity-90 mt-2">Lingua: {languageLabel}</p>
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

            {/* Sources Cited Section */}
            {sourcesData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-amber-600" />
                            Fonti Citate dagli LLM
                        </CardTitle>
                        <CardDescription>
                            Le fonti più rilevanti citate nelle risposte, ordinate per importanza
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {sourcesData.map((source, idx) => {
                                const sourceInfo = extractDomain(source.source);
                                return (
                                    <div
                                        key={source.source}
                                        className={`p-3 rounded-lg border transition-colors ${
                                            source.withBrand > 0
                                                ? 'bg-green-50 border-green-200 hover:border-green-300'
                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                    {sourceInfo.isUrl ? (
                                                        <a
                                                            href={sourceInfo.fullUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-semibold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                                                            title={source.source}
                                                        >
                                                            {sourceInfo.domain}
                                                        </a>
                                                    ) : (
                                                        <span className="font-medium text-sm text-slate-900 truncate" title={source.source}>
                                                            {sourceInfo.domain}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        Citato {source.count}x
                                                    </span>
                                                    {source.withBrand > 0 && (
                                                        <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-green-600">
                                                            {source.withBrand}x con brand
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge variant="outline" className="text-[10px] h-5 bg-white">
                                                    #{idx + 1}
                                                </Badge>
                                                {sourceInfo.isUrl && (
                                                    <a
                                                        href={sourceInfo.fullUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50"
                                                        title="Apri articolo"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {source.platforms.map(p => {
                                                const pStyle = getLLMBadgeStyle(p);
                                                return (
                                                    <span key={p} className={`text-[9px] px-1.5 py-0.5 rounded ${pStyle.bg} ${pStyle.text} font-medium`}>
                                                        {pStyle.label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-400 mt-4 text-center">
                            Le fonti evidenziate in verde sono citate quando il brand viene menzionato
                        </p>
                    </CardContent>
                </Card>
            )}

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
                                .filter((entry) => entry[1] !== null)
                                .map(([name, pos]) => ({ name, pos }));

                            return (
                                <div key={res.id} className="border rounded-xl overflow-hidden bg-white hover:border-amber-200 transition-colors">
                                    <div
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                                        onClick={() => setExpandedResponse(isExpanded ? null : res.id)}
                                    >
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {(() => {
                                                    const llmStyle = getLLMBadgeStyle(res.platform);
                                                    return (
                                                        <Badge className={`${llmStyle.bg} ${llmStyle.text} ${llmStyle.border} border font-semibold px-3 py-1`}>
                                                            {llmStyle.label}
                                                            <span className="ml-1.5 opacity-80 text-[10px] font-normal">({res.model})</span>
                                                        </Badge>
                                                    );
                                                })()}
                                                {res.sentiment && (
                                                    <Badge className={`text-[10px] px-2 h-5 flex items-center font-medium ${
                                                        res.sentiment === 'positive'
                                                            ? 'bg-green-100 text-green-800 border-green-200'
                                                            : res.sentiment === 'negative'
                                                                ? 'bg-red-100 text-red-800 border-red-200'
                                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    } border`}>
                                                        {res.sentiment}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="font-medium text-slate-800 leading-snug text-sm">
                                                &quot;{res.promptText}&quot;
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

                                                {/* Sources Cited in this response */}
                                                {res.sourcesCited && res.sourcesCited.length > 0 && (
                                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                                            <Link2 className="w-3.5 h-3.5" />
                                                            Fonti Citate
                                                        </h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {res.sourcesCited
                                                                .filter((source) => {
                                                                    if (!source) return false;
                                                                    if (!res.brandMentioned) return true;
                                                                    return extractDomain(source).isUrl;
                                                                })
                                                                .map((source, idx) => {
                                                                const sInfo = extractDomain(source);
                                                                return sInfo.isUrl ? (
                                                                    <a
                                                                        key={idx}
                                                                        href={sInfo.fullUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors font-medium"
                                                                        title={source}
                                                                    >
                                                                        <Globe className="w-3 h-3" />
                                                                        {sInfo.domain}
                                                                        <ExternalLink className="w-3 h-3 opacity-60" />
                                                                    </a>
                                                                ) : (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border bg-slate-50 border-slate-200 text-slate-600"
                                                                    >
                                                                        {sInfo.domain}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Trascrizione Risposta LLM</h5>
                                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                                                        {highlightBrand(res.responseText)}
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

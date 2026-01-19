'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ScanData {
    id: string;
    completedAt: Date;
    score: number;
    platformScores: { platform: string; score: number; total: number; mentions: number }[];
    responses: {
        id: string;
        platform: string;
        promptText: string;
        brandMentioned: boolean;
        brandPosition: number | null;
        sentiment: string | null;
    }[];
    partial: boolean;
}

export function ScanResults({ scan, totalScans }: { scan: ScanData | null, totalScans: number }) {
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

    // Prepare chart data
    const chartData = platformScores.map(p => ({
        name: p.platform,
        score: p.score,
        mentions: p.mentions,
        total: p.total
    }));

    const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

    return (
        <div className="space-y-6">
            {partial && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-yellow-800">Risultati Parziali</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                            Alcuni provider LLM non sono configurati o hanno restituito errori. I risultati mostrati si basano solo sui dati disponibili.
                            Controlla le impostazioni API se ti aspetti più dati.
                        </p>
                    </div>
                </div>
            )}

            {/* Score Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Visibility Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{score}%</div>
                        <p className="text-xs text-muted-foreground">Overall brand mentions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Platform Coverage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{platformScores.length} / 3</div>
                        <p className="text-xs text-muted-foreground">Active LLM Providers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{responses.length}</div>
                        <p className="text-xs text-muted-foreground">Queries analyzed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalScans}</div>
                        <p className="text-xs text-muted-foreground">Lifetime scans run</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Performance per Platform</CardTitle>
                        <CardDescription>Visibility score breakdown by LLM provider</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="score" name="Visibility %" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Recent Responses List */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Scan Details</CardTitle>
                        <CardDescription>
                            Latest responses from {scan.completedAt.toLocaleDateString()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {responses.map((res) => (
                                <div key={res.id} className="p-3 border rounded-lg bg-slate-50 text-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <Badge variant="outline" className="capitalize">
                                            {res.platform}
                                        </Badge>
                                        <div className="flex gap-2">
                                            {res.sentiment && (
                                                <Badge variant={
                                                    res.sentiment === 'positive' ? 'default' :
                                                        res.sentiment === 'negative' ? 'destructive' : 'secondary'
                                                } className="text-[10px] px-1 h-5">
                                                    {res.sentiment}
                                                </Badge>
                                            )}
                                            <Badge variant={res.brandMentioned ? 'default' : 'secondary'} className={
                                                res.brandMentioned ? "bg-green-600 hover:bg-green-700" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                            }>
                                                {res.brandPosition ? `#${res.brandPosition}` : (res.brandMentioned ? 'Mentioned' : 'Not found')}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-slate-600 line-clamp-2" title={res.promptText}>
                                        "{res.promptText}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

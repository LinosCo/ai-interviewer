'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TrendData {
    date: string;
    dateLabel: string;
    score: number;
    scanId: string;
}

interface Props {
    configId: string;
}

export function VisibilityTrendChart({ configId }: Props) {
    const [trendData, setTrendData] = useState<TrendData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrend = async () => {
            try {
                const res = await fetch(`/api/visibility/analytics?configId=${configId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTrendData(data.trendData || []);
                }
            } catch (err) {
                console.error('Error fetching trend data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrend();
    }, [configId]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-amber-600" />
                        Trend Visibilità
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Caricamento...</div>
                </CardContent>
            </Card>
        );
    }

    if (trendData.length < 2) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-amber-600" />
                        Trend Visibilità
                    </CardTitle>
                    <CardDescription>Andamento della visibilità nel tempo</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                    <Calendar className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Servono almeno 2 scansioni per mostrare il trend</p>
                    <p className="text-xs text-slate-400 mt-1">Esegui altre scansioni per vedere l'andamento</p>
                </CardContent>
            </Card>
        );
    }

    // Calculate trend
    const firstScore = trendData[0]?.score || 0;
    const lastScore = trendData[trendData.length - 1]?.score || 0;
    const trendDirection = lastScore > firstScore ? 'up' : lastScore < firstScore ? 'down' : 'stable';
    const trendValue = Math.abs(lastScore - firstScore);
    const avgScore = Math.round(trendData.reduce((acc, d) => acc + d.score, 0) / trendData.length);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-amber-600" />
                            Trend Visibilità
                        </CardTitle>
                        <CardDescription>Ultimi 30 giorni • {trendData.length} scansioni</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-2xl font-bold">{lastScore}%</div>
                            <div className="flex items-center gap-1 text-xs">
                                {trendDirection === 'up' && (
                                    <Badge className="bg-green-100 text-green-700 gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        +{trendValue}%
                                    </Badge>
                                )}
                                {trendDirection === 'down' && (
                                    <Badge className="bg-red-100 text-red-700 gap-1">
                                        <TrendingDown className="w-3 h-3" />
                                        -{trendValue}%
                                    </Badge>
                                )}
                                {trendDirection === 'stable' && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Minus className="w-3 h-3" />
                                        Stabile
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[220px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="dateLabel"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            width={30}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                            }}
                            formatter={(value: number) => [`${value}%`, 'Visibility Score']}
                            labelFormatter={(label) => `Data: ${label}`}
                        />
                        <ReferenceLine y={avgScore} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: `Media: ${avgScore}%`, position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                        <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fill="url(#colorScore)"
                            dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#f59e0b' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

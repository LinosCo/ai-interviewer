'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/business-tuner/Card';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    ArrowRight, Sparkles, MessageSquare, Users, Zap,
    Lightbulb, TrendingUp, AlertTriangle, Megaphone, FileText, Bot, Check
} from 'lucide-react';
import { UnifiedInsight, UnifiedStats } from '@/lib/analytics/AnalyticsEngine';

interface ProjectAnalyticsProps {
    projectId: string;
    availableBots: { id: string; name: string; botType: string | null }[];
}

export default function ProjectAnalytics({ projectId, availableBots }: ProjectAnalyticsProps) {
    const [insights, setInsights] = useState<UnifiedInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams();
                if (selectedBotIds.length > 0) {
                    queryParams.append('botIds', selectedBotIds.join(','));
                }

                const res = await fetch(`/api/projects/${projectId}/analytics?${queryParams.toString()}`);
                if (!res.ok) throw new Error('Failed to fetch analytics');
                const data = await res.json();
                setInsights(data.insights);
                // If we want to use real trends: setTrendData(data.trends);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [projectId, selectedBotIds]);

    const toggleBotFilter = (botId: string) => {
        setSelectedBotIds(prev =>
            prev.includes(botId)
                ? prev.filter(id => id !== botId)
                : [...prev, botId]
        );
    };

    const clearFilters = () => setSelectedBotIds([]);

    const mockTrendData = [
        { date: 'Lun', sentiment: 65, volume: 120 },
        { date: 'Mar', sentiment: 58, volume: 145 },
        { date: 'Mer', sentiment: 72, volume: 132 },
        { date: 'Gio', sentiment: 68, volume: 150 },
        { date: 'Ven', sentiment: 75, volume: 180 },
        { date: 'Sab', sentiment: 82, volume: 90 },
        { date: 'Dom', sentiment: 80, volume: 85 },
    ];

    if (loading && insights.length === 0) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>;
    }

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Virtuous Cycle Analytics</h2>
                    <p className="text-gray-500 mt-1">
                        Come le conversazioni (Chatbot) e le interviste (AI Interviewer) si influenzano a vicenda.
                    </p>
                </div>

                {/* Filter Controls */}
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
                    >
                        <Bot className="w-4 h-4" />
                        Filtra Fonti ({selectedBotIds.length > 0 ? selectedBotIds.length : 'Tutte'})
                        <ArrowRight className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-semibold text-sm">Seleziona Fonti</span>
                                {selectedBotIds.length > 0 && (
                                    <button onClick={clearFilters} className="text-xs text-red-600 hover:underline">Reset</button>
                                )}
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {availableBots.map(bot => (
                                    <label key={bot.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedBotIds.includes(bot.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {selectedBotIds.includes(bot.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedBotIds.includes(bot.id)}
                                            onChange={() => toggleBotFilter(bot.id)}
                                        />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-sm truncate">{bot.name}</div>
                                            <div className="text-xs text-gray-500 capitalize">{bot.botType || 'Interview'}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg" padding="1.5rem">
                    <div className="flex flex-col gap-2">
                        <div className="text-lg font-medium opacity-90 flex items-center gap-2">
                            <Sparkles className="w-5 h-5" /> Brand Reputation
                        </div>
                        <div className="text-4xl font-bold">72/100</div>
                        <div className="text-sm opacity-80">+5% vs settimana scorsa</div>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title={(
                            <span className="flex items-center gap-2 text-lg">
                                <MessageSquare className="w-5 h-5 text-blue-500" /> Domande Chatbot
                            </span>
                        )}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <div>
                        <div className="text-3xl font-bold text-gray-900">1,240</div>
                        <div className="text-sm text-gray-500 mt-1">Topic top: "Spedizioni", "Pricing"</div>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title={(
                            <span className="flex items-center gap-2 text-lg">
                                <Users className="w-5 h-5 text-green-500" /> Interviste Completate
                            </span>
                        )}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <div>
                        <div className="text-3xl font-bold text-gray-900">85</div>
                        <div className="text-sm text-gray-500 mt-1">Insight top: "UX sito confusa"</div>
                    </div>
                </Card>
            </div>

            {/* Main Actionable Insights Section */}
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-6 h-6 text-yellow-500" /> Suggerimenti Strategici (AI)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {insights.map((insight, index) => {
                        let Icon = Sparkles;
                        let colorClass = "bg-purple-100 text-purple-700";

                        if (insight.type === 'INTERVIEW_QUESTION') {
                            Icon = MessageSquare;
                            colorClass = "bg-blue-100 text-blue-700";
                        } else if (insight.type === 'KB_UPDATE') {
                            Icon = AlertTriangle;
                            colorClass = "bg-orange-100 text-orange-700";
                        } else if (insight.type === 'AD_CAMPAIGN') {
                            Icon = Megaphone;
                            colorClass = "bg-green-100 text-green-700";
                        } else if (insight.type === 'CONTENT_SUGGESTION') {
                            Icon = FileText;
                            colorClass = "bg-pink-100 text-pink-700";
                        }

                        return (
                            <Card key={index} className="hover:shadow-lg transition-all border-l-4 border-l-purple-500" padding="1.5rem">
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-2 rounded-lg ${colorClass}`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                            {insight.source === 'CHATBOT' ? 'Da Chatbot' : 'Da Interviste'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-lg mb-2">{insight.title}</h4>
                                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                                        {insight.description}
                                    </p>
                                    <div className="mt-auto pt-4 border-t border-gray-100">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            {insight.reasoning}
                                        </div>
                                        <button className="mt-3 w-full py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                                            Applica Suggerimento <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="1.5rem">
                    <CardHeader
                        title="Trend Sentiment Unificato"
                        subtitle="Andamento della reputazione combinando chat e interviste"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="sentiment"
                                    name="Sentiment Score"
                                    stroke="#7C3AED"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#7C3AED" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title="Volume Interazioni"
                        subtitle="Traffico gestito giornalmente"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockTrendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="volume" name="Conversazioni" fill="#9333ea" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}

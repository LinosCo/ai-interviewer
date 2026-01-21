'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { Download, MessageSquare, Users, Clock, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ChatbotAnalyticsView({ bot, sessions, gaps }: any) {
    const [timeRange, setTimeRange] = useState('7d');

    // Calculate metrics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s: any) => s.status === 'COMPLETED').length;
    const avgDuration = sessions.length > 0
        ? Math.round(sessions.reduce((acc: number, s: any) => acc + (s.durationSeconds || 0), 0) / sessions.length / 60)
        : 0;
    const leadsCollected = sessions.filter((s: any) => s.candidateProfile).length;
    const conversionRate = totalSessions > 0 ? Math.round((leadsCollected / totalSessions) * 100) : 0;

    // Chart data - last 14 days
    const chartData = Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        const dateStr = date.toISOString().split('T')[0];
        const daySessions = sessions.filter((s: any) => new Date(s.startedAt).toISOString().split('T')[0] === dateStr);
        return {
            date: date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
            sessions: daySessions.length,
            leads: daySessions.filter((s: any) => s.candidateProfile).length
        };
    });

    const handleExportCSV = () => {
        const headers = ["ID", "Date", "Status", "Duration (min)", "Lead Captured", "Messages"];
        const rows = sessions.map((s: any) => [
            s.id,
            new Date(s.startedAt).toISOString(),
            s.status,
            s.durationSeconds ? (s.durationSeconds / 60).toFixed(1) : '0',
            s.candidateProfile ? 'Yes' : 'No',
            s.messages?.length || 0
        ].join(","));

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${bot.name.replace(/\s+/g, '_')}_analytics.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
                    <p className="text-slate-500">Performance del chatbot negli ultimi 14 giorni</p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500">Sessioni Totali</span>
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{totalSessions}</div>
                    <p className="text-xs text-slate-400 mt-1">Ultimi 14 giorni</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500">Lead Raccolti</span>
                        <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{leadsCollected}</div>
                    <p className="text-xs text-green-600 mt-1">+{conversionRate}% conversion rate</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500">Durata Media</span>
                        <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{avgDuration}m</div>
                    <p className="text-xs text-slate-400 mt-1">Per sessione</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500">Knowledge Gaps</span>
                        <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{gaps.length}</div>
                    <Link href={`/dashboard/bots/${bot.id}/knowledge-gaps`} className="text-xs text-blue-600 hover:underline mt-1 block">
                        Rivedi →
                    </Link>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sessions Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Sessioni nel Tempo
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Leads Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        Lead Conversion
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="leads" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Leads Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        Lead Raccolti
                    </h3>
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full font-bold uppercase tracking-wider">
                        {leadsCollected} Lead
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                <th className="px-6 py-3 border-b border-slate-100">Nome / ID</th>
                                <th className="px-6 py-3 border-b border-slate-100">Contatto / Dettagli</th>
                                <th className="px-6 py-3 border-b border-slate-100">Data</th>
                                <th className="px-6 py-3 border-b border-slate-100 text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sessions.filter((s: any) => s.candidateProfile).length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">
                                        Nessun lead raccolto ancora in questo periodo.
                                    </td>
                                </tr>
                            ) : (
                                sessions.filter((s: any) => s.candidateProfile).map((lead: any) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">
                                                {lead.candidateProfile.name || lead.candidateProfile.fullName || `User #${lead.id.slice(-4)}`}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono">{lead.id.slice(-8)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {lead.candidateProfile.email || lead.candidateProfile.contact || 'Nessuna email'}
                                            </div>
                                            {lead.candidateProfile.phone && (
                                                <div className="text-xs text-slate-400 mt-1">{lead.candidateProfile.phone}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">
                                                {new Date(lead.startedAt).toLocaleDateString('it-IT')}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(lead.startedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/dashboard/bots/${bot.id}/conversations/${lead.id}`}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Vedi Chat →
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Sessions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Sessioni Recenti</h3>
                    <Link
                        href={`/dashboard/bots/${bot.id}/conversations`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Vedi tutte →
                    </Link>
                </div>
                <div className="divide-y divide-slate-100">
                    {sessions.slice(0, 10).map((session: any) => (
                        <Link
                            key={session.id}
                            href={`/dashboard/bots/${bot.id}/conversations/${session.id}`}
                            className="p-4 hover:bg-slate-50 transition-colors block"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-700">
                                            #{session.id.slice(-6)}
                                        </span>
                                        {session.candidateProfile && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                                Lead
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                            session.status === 'COMPLETED'
                                                ? 'bg-blue-100 text-blue-700'
                                                : session.status === 'ABANDONED'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {session.status === 'COMPLETED' ? 'Completata' : session.status === 'ABANDONED' ? 'Abbandonata' : 'In corso'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {new Date(session.startedAt).toLocaleString('it-IT')}
                                    </p>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="text-sm text-slate-600">
                                            {session.durationSeconds ? `${Math.round(session.durationSeconds / 60)}m` : '-'}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {session.messages?.length || 0} messaggi
                                        </p>
                                    </div>
                                    <span className="text-blue-600 text-sm font-medium">
                                        Leggi →
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

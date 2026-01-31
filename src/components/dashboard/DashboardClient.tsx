'use client';

import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutGrid,
    Plus,
    Bot,
    ArrowRight,
    Calendar,
    ChevronRight,
    Eye,
    Settings2,
    MessageSquare,
    TrendingUp,
    Users,
    Clock,
    Sparkles,
    Bell,
    BarChart3,
    Lock,
    Shield,
    Activity,
    Settings,
    Globe,
    ExternalLink
} from "lucide-react";
import { useState } from 'react';
import Link from 'next/link';
import CMSConnectionCard from '@/components/dashboard/CMSConnectionCard';
import { useRouter } from 'next/navigation';

interface DashboardClientProps {
    user: any;
    usage: any;
    subscription: any;
    status: string;
    trialDaysLeft: number;
    isAdmin: boolean;
    canCreateInterview: { allowed: boolean };
    canCreateChatbotCheck: { allowed: boolean };
    allBots: any[];
    initialRecentResponses: any[];
    projectsWithCms: any[];
}

export default function DashboardClient({
    user,
    usage,
    subscription,
    status,
    trialDaysLeft,
    isAdmin,
    canCreateInterview,
    canCreateChatbotCheck,
    allBots,
    initialRecentResponses,
    projectsWithCms
}: DashboardClientProps) {
    const { selectedProject } = useProject();
    const router = useRouter();
    const [isOpeningCms, setIsOpeningCms] = useState(false);

    // Filter content based on selected project
    const isAllProjects = !selectedProject || selectedProject.id === ALL_PROJECTS_OPTION.id;

    const filteredBots = isAllProjects
        ? allBots
        : allBots.filter(bot => bot.projectId === selectedProject.id);

    const filteredResponses = isAllProjects
        ? initialRecentResponses
        : initialRecentResponses.filter(r =>
            // If response has projectId (ideal) or find via bot
            allBots.find(b => b.id === r.botId)?.projectId === selectedProject.id
        );

    // Find CMS connection for selected project
    const currentCmsConnection = !isAllProjects
        ? projectsWithCms.find(p => p.id === selectedProject.id)?.cmsConnection
        : null;

    // Handle CMS transfer navigation
    const handleTransfer = (connectionId: string) => {
        router.push(`/dashboard/cms/${connectionId}/settings`);
    };

    const handleDeleteConnection = async (connectionId: string) => {
        try {
            const res = await fetch(`/api/cms/${connectionId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to delete connection');

            // Refresh the page or update state
            router.refresh();
        } catch (error) {
            console.error('Error deleting CMS connection:', error);
            alert('Failed to delete connection. Please try again.');
        }
    };

    const handleOpenCmsDashboard = async () => {
        if (!selectedProject?.id || isOpeningCms) return;
        setIsOpeningCms(true);
        try {
            const res = await fetch('/api/cms/dashboard-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProject.id }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    window.open(data.url, '_blank');
                }
            } else {
                const error = await res.json();
                console.error('Failed to get CMS dashboard URL:', error);
                alert(error.error || 'Impossibile aprire il CMS');
            }
        } catch (error) {
            console.error('Error opening CMS dashboard:', error);
            alert('Errore durante l\'apertura del CMS');
        } finally {
            setIsOpeningCms(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Subscription & Trial Warnings */}
            {status === 'TRIALING' && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 rounded-full text-white animate-pulse">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900">Sei in prova gratuita PRO</p>
                            <p className="text-sm text-amber-700">Ti rimangono <span className="font-bold">{trialDaysLeft} giorni</span> per testare tutte le funzionalità avanzate.</p>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/settings/billing"
                        className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-all shadow-md active:scale-95"
                    >
                        Attiva Piano Pro
                    </Link>
                </div>
            )}

            {status === 'PAST_DUE' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500 rounded-full text-white">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-red-900">Pagamento Fallito</p>
                            <p className="text-sm text-red-700">Il tuo abbonamento è sospeso. Aggiorna il metodo di pagamento per riattivare i tuoi bot.</p>
                        </div>
                    </div>
                    <Link href="/dashboard/settings/billing" className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">
                        Risolvi Ora
                    </Link>
                </div>
            )}

            {/* Admin Panel */}
            {isAdmin && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 rounded-full text-white">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-white">Pannello Admin</p>
                            <p className="text-sm text-slate-300">Accesso alle funzionalità di amministrazione.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/admin/usage"
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-all flex items-center gap-2 text-sm"
                        >
                            <Activity className="w-4 h-4" />
                            Monitoraggio Risorse
                        </Link>
                        <Link
                            href="/dashboard/admin/users"
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-600 transition-all flex items-center gap-2 text-sm"
                        >
                            <Users className="w-4 h-4" />
                            Utenti
                        </Link>
                        <Link
                            href="/dashboard/admin/projects"
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg font-bold hover:bg-slate-600 transition-all flex items-center gap-2 text-sm"
                        >
                            <Settings className="w-4 h-4" />
                            Progetti
                        </Link>
                    </div>
                </div>
            )}

            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Ciao{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isAllProjects
                            ? "Ecco una panoramica di tutti i tuoi progetti."
                            : `Stai visualizzando il progetto: ${selectedProject?.name}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isAllProjects && selectedProject && (
                        <Link
                            href={`/dashboard/projects/${selectedProject.id}/analytics`}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Insight
                        </Link>
                    )}
                    <Link
                        href="/dashboard/settings/billing"
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-2"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Upgrade
                    </Link>
                </div>
            </div>

            {/* CMS Connection Card (Project Specific) */}
            {currentCmsConnection && (
                <div className="grid grid-cols-1">
                    <CMSConnectionCard
                        connection={{
                            ...currentCmsConnection,
                            projectName: selectedProject?.name || '',
                            projectId: selectedProject?.id || '',
                            status: currentCmsConnection.status || 'ACTIVE' // Fallback status
                        }}
                        canManage={true}
                        onTransfer={handleTransfer}
                        onDelete={handleDeleteConnection}
                    />
                </div>
            )}

            {/* Stats Cards Row */}
            <div className="grid md:grid-cols-4 gap-4">
                {/* Interviews Stats */}
                <div className="platform-card rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-xs font-bold text-gray-400">Interviste Mensili</span>
                    </div>
                    <div>
                        <div className="flex items-end justify-between mb-2">
                            <p className="text-2xl font-bold text-gray-900">{usage?.interviews.used || 0}</p>
                            <p className="text-xs text-gray-500">di {usage?.interviews.limit === -1 ? '∞' : usage?.interviews.limit || 0}</p>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${usage && usage.interviews.percentage > 90 ? 'bg-red-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(usage?.interviews.percentage || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Chatbots Stats */}
                <div className="platform-card rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-gray-400">Bot Attivi</span>
                    </div>
                    <div>
                        <div className="flex items-end justify-between mb-2">
                            <p className="text-2xl font-bold text-gray-900">{usage?.activeBots.used || 0}</p>
                            <p className="text-xs text-gray-500">di {usage?.activeBots.limit === -1 ? '∞' : usage?.activeBots.limit || 0}</p>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(usage?.activeBots.percentage || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Tokens Stats */}
                <div className="platform-card rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-xs font-bold text-gray-400">Token AI (Budget)</span>
                    </div>
                    <div>
                        <div className="flex items-end justify-between mb-2">
                            <p className="text-2xl font-bold text-gray-900">{(usage?.tokens.used || 0) > 1000 ? `${Math.round(usage!.tokens.used / 1000)}k` : usage?.tokens.used || 0}</p>
                            <p className="text-xs text-gray-500">di {(usage?.tokens.limit || 0) >= 1000000 ? `${(usage!.tokens.limit / 1000000).toFixed(1)}M` : `${Math.round((usage?.tokens.limit || 0) / 1000)}k`}</p>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 transition-all duration-500"
                                style={{ width: `${Math.min(usage?.tokens.percentage || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Buy More Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white flex flex-col justify-between">
                    <div>
                        <p className="font-bold text-sm mb-1 text-indigo-100">Hai bisogno di più?</p>
                        <p className="text-xs text-indigo-100/80">Acquista pacchetti extra senza abbonamento.</p>
                    </div>
                    <Link
                        href="/dashboard/settings/billing#packages"
                        className="mt-3 flex items-center justify-center gap-2 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all"
                    >
                        Compra Pacchetti <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Quick Actions & Create */}
                <div className="space-y-4">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-gray-400" />
                        Azioni rapide
                    </h2>

                    {/* CMS Dashboard Quick Access */}
                    {currentCmsConnection && currentCmsConnection.status === 'ACTIVE' && (
                        <button
                            onClick={handleOpenCmsDashboard}
                            disabled={isOpeningCms}
                            className="w-full text-left block bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-wait"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">
                                        {isOpeningCms ? 'Apertura...' : currentCmsConnection.name || 'Gestisci Sito Web'}
                                    </h3>
                                    <p className="text-emerald-100 text-sm">
                                        Accedi alla dashboard CMS per gestire contenuti e pagine.
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    {isOpeningCms ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Globe className="w-6 h-6 text-white" />
                                    )}
                                </div>
                            </div>
                        </button>
                    )}

                    {/* Create Interview */}
                    {canCreateInterview.allowed ? (
                        <Link
                            href="/onboarding"
                            className="block bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Crea nuova intervista</h3>
                                    <p className="text-orange-100 text-sm">
                                        Genera un'intervista strutturata per HR, Product o Feedback.
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Plus className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </Link>
                    ) : (
                        <div className="block bg-gray-50 rounded-xl p-6 border border-gray-200 relative overflow-hidden">
                            <div className="flex items-start justify-between opacity-50">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Crea Intervista</h3>
                                    <p className="text-gray-500 text-sm">Limite raggiunto per il tuo piano.</p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Lock className="w-6 h-6 text-gray-400" />
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-3 border-t border-gray-100 flex items-center justify-between px-6">
                                <span className="text-xs font-semibold text-gray-600">Sblocca altre interviste</span>
                                <Link href="/dashboard/settings/billing" className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full hover:bg-gray-800">
                                    Upgrade Piano
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Create Chatbot */}
                    {canCreateChatbotCheck.allowed ? (
                        <Link
                            href="/dashboard/bots/create-chatbot"
                            className="block bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl p-6 text-white hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Crea chatbot AI</h3>
                                    <p className="text-blue-100 text-sm">
                                        Assistente virtuale addestrato sulla tua Knowledge Base.
                                    </p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </Link>
                    ) : (
                        <div className="block bg-gray-50 rounded-xl p-6 border border-gray-200 relative overflow-hidden">
                            <div className="flex items-start justify-between opacity-50">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Crea Chatbot AI</h3>
                                    <p className="text-gray-500 text-sm">Hai raggiunto il limite di Chatbot del tuo piano.</p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Lock className="w-6 h-6 text-gray-400" />
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-3 border-t border-gray-100 flex items-center justify-between px-6">
                                <span className="text-xs font-semibold text-gray-600">Sblocca più chatbot</span>
                                <Link href="/dashboard/billing/plans" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700">
                                    Upgrade Piano
                                </Link>
                            </div>
                        </div>
                    )}

                    <Link
                        href="/dashboard/templates"
                        className="block platform-card rounded-xl p-4 hover:border-gray-300 transition-colors group"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100">
                                    <Sparkles className="w-4 h-4 text-gray-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">Esplora template</h3>
                                    <p className="text-gray-500 text-xs">Modelli pronti all'uso per ogni settore</p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </div>

                {/* Recent Activity List */}
                <div className="platform-card rounded-xl overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-gray-400" />
                            Attività recente
                        </h2>
                        {isAllProjects ? (
                            <Link href="/dashboard/interviews" className="text-sm text-indigo-600 hover:text-indigo-700">
                                Vedi tutto →
                            </Link>
                        ) : (
                            <span className="text-xs text-gray-400">Filtrata per progetto</span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[400px]">
                        {filteredResponses.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 h-full flex flex-col items-center justify-center">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>Nessuna attività recente</p>
                                <p className="text-sm">Le conversazioni appariranno qui</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredResponses.map((response: any) => (
                                    <Link
                                        key={response.id}
                                        href={`/dashboard/bots/${response.botId}`}
                                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${response.type === 'chatbot' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {response.type === 'chatbot' ? <Bot className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">{response.botName}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(response.completedAt!).toLocaleDateString('it-IT', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-full border border-green-100">
                                            Completata
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

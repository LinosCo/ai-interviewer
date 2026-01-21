import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, TrendingUp, Users, Clock, ArrowRight, Sparkles, Bell, Bot, BarChart3, Lock } from 'lucide-react';
import { canCreateChatbot, canPublishBot, getUsageStats } from '@/lib/usage';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    organization: {
                        include: {
                            subscription: true
                        }
                    }, // Needed for usage checks
                    bots: {
                        include: {
                            conversations: {
                                select: { id: true, status: true, completedAt: true },
                                orderBy: { completedAt: 'desc' },
                                take: 10
                            }
                        },
                        orderBy: { updatedAt: 'desc' }
                    }
                }
            }
        }
    });

    if (!user) return <div>Utente non trovato.</div>;

    // Get organization from memberships first (more reliable)
    const userWithMembership = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            memberships: {
                take: 1,
                include: {
                    organization: {
                        include: {
                            subscription: true
                        }
                    }
                }
            }
        }
    });

    // Fallback chain for organizationId
    const project = user.ownedProjects[0];
    const organizationId = userWithMembership?.memberships[0]?.organizationId || project?.organization?.id;
    const projectId = project?.id;

    const isAdmin = user.role === 'ADMIN';

    // Check limits
    const canCreateInterview = organizationId && !isAdmin ? await canPublishBot(organizationId) : { allowed: true };
    const canCreateChatbotCheck = organizationId && !isAdmin ? await canCreateChatbot(organizationId) : { allowed: true };

    // Get bots and split by type
    const allBots = user.ownedProjects.flatMap(p => p.bots);
    const interviews = allBots.filter((b: any) => b.botType === 'interview' || !b.botType); // Default to interview
    const chatbots = allBots.filter((b: any) => b.botType === 'chatbot');

    // Calculate stats
    const totalInterviews = interviews.length;
    const totalResponses = interviews.reduce((sum, bot) => sum + bot.conversations.length, 0);

    const totalChatbots = chatbots.length;
    const totalChatSessions = chatbots.reduce((sum, bot) => sum + bot.conversations.length, 0);

    // Get recent responses (mixed)
    const recentResponses = allBots
        .flatMap(bot => bot.conversations.map(c => ({
            ...c,
            botName: bot.name,
            botId: bot.id,
            type: (bot as any).botType || 'interview'
        })))
        .filter(c => c.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);

    // Get active interviews (with responses in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeInterviews = interviews.filter(bot =>
        bot.conversations.some(c => c.completedAt && new Date(c.completedAt) > weekAgo)
    );

    // Fetch usage and subscription data - always try to get it if organizationId exists
    const usage = organizationId ? await getUsageStats(organizationId) : null;
    const subscription = userWithMembership?.memberships[0]?.organization?.subscription || project?.organization?.subscription;
    const status = subscription?.status || 'ACTIVE';
    const trialDaysLeft = usage?.currentPeriodEnd ? Math.ceil((new Date(usage.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

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

            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Ciao{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">Ecco una panoramica dei tuoi progetti e assistenti AI.</p>
                </div>
                <div className="flex items-center gap-2">
                    {projectId && (
                        <Link
                            href={`/dashboard/projects/${projectId}/analytics`}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
                        >
                            <BarChart3 className="w-4 h-4" />
                            Insight unificati
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

            {/* Stats Cards Row */}
            <div className="grid md:grid-cols-4 gap-4">
                {/* Interviews Stats */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm relative overflow-hidden group">
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
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm relative overflow-hidden group">
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
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
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
                                <Lock className="w-6 h-6 text-gray-400" />
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
                                    <p className="text-gray-500 text-sm">Hai raggiunto il limite di Chatbot.</p>
                                </div>
                                <Lock className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-3 border-t border-gray-100 flex items-center justify-between px-6">
                                <span className="text-xs font-semibold text-gray-600">Disponibile nel piano PRO</span>
                                <Link href="/dashboard/settings/billing" className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700">
                                    Passa a PRO
                                </Link>
                            </div>
                        </div>
                    )}

                    <Link
                        href="/templates"
                        className="block bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors group"
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
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-gray-400" />
                            Attività recente
                        </h2>
                        <Link href="/dashboard/interviews" className="text-sm text-indigo-600 hover:text-indigo-700">
                            Vedi tutto →
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[400px]">
                        {recentResponses.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 h-full flex flex-col items-center justify-center">
                                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>Nessuna attività recente</p>
                                <p className="text-sm">Le conversazioni appariranno qui</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {recentResponses.map((response: any) => (
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


import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, TrendingUp, Users, Clock, ArrowRight, Sparkles, Bell, Bot, BarChart3, Lock } from 'lucide-react';
import { canCreateChatbot, canPublishBot } from '@/lib/usage';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    organization: true, // Needed for usage checks
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

    // Assuming single organization context for simplicity in dashboard
    const project = user.ownedProjects[0];
    const organizationId = project?.organization?.id;
    const projectId = project?.id;

    // Check limits
    const canCreateInterview = organizationId ? await canPublishBot(organizationId) : { allowed: true };
    const canCreateChatbotCheck = organizationId ? await canCreateChatbot(organizationId) : { allowed: true };

    // Get bots and split by type
    const allBots = user.ownedProjects.flatMap(p => p.bots);
    const interviews = allBots.filter(b => b.botType === 'interview' || !b.botType); // Default to interview
    const chatbots = allBots.filter(b => b.botType === 'chatbot');

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
            type: bot.botType || 'interview'
        })))
        .filter(c => c.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(5);

    // Get active interviews (with responses in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeInterviews = interviews.filter(bot =>
        bot.conversations.some(c => c.completedAt && new Date(c.completedAt) > weekAgo)
    );

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Ciao{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">Ecco una panoramica dei tuoi progetti e assistenti AI.</p>
                </div>
                {projectId && (
                    <Link
                        href={`/dashboard/projects/${projectId}/analytics`}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
                    >
                        <BarChart3 className="w-4 h-4" />
                        Unified Analytics
                    </Link>
                )}
            </div>

            {/* Stats Cards Row */}
            <div className="grid md:grid-cols-4 gap-4">
                {/* Interviews Stats */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MessageSquare className="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalInterviews}</p>
                            <p className="text-sm text-gray-500">Interviste</p>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                        {totalResponses} risposte totali
                    </div>
                </div>

                {/* Chatbots Stats */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Bot className="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalChatbots}</p>
                            <p className="text-sm text-gray-500">Chatbot Attivi</p>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                        {totalChatSessions} sessioni totali
                    </div>
                </div>

                {/* Active Weekly */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{activeInterviews.length}</p>
                            <p className="text-sm text-gray-500">Bot Attivi (7gg)</p>
                        </div>
                    </div>
                </div>

                {/* Unified Score (Mini) */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 border border-none shadow-sm text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">Good</p>
                            <p className="text-sm text-indigo-100">Reputation Score</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid lg:grid-cols-2 gap-6">

                {/* Quick Actions & Create */}
                <div className="space-y-4">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-gray-400" />
                        Azioni Rapide
                    </h2>

                    {/* Create Interview */}
                    {canCreateInterview.allowed ? (
                        <Link
                            href="/onboarding"
                            className="block bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Crea Nuova Intervista</h3>
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
                                    <h3 className="text-xl font-semibold mb-2">Crea Chatbot AI</h3>
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
                                    <h3 className="font-semibold text-gray-900 text-sm">Esplora Template</h3>
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
                            Attività Recente
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

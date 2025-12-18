import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, TrendingUp, Users, Clock, ArrowRight, Sparkles, Bell } from 'lucide-react';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
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

    // Get bots
    const allBots = user.ownedProjects.flatMap(p => p.bots);

    // Calculate stats
    const totalInterviews = allBots.length;
    const totalResponses = allBots.reduce((sum, bot) => sum + bot.conversations.length, 0);

    // Get recent responses
    const recentResponses = allBots
        .flatMap(bot => bot.conversations.map(c => ({ ...c, botName: bot.name, botId: bot.id })))
        .filter(c => c.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);

    // Get active interviews (with responses in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeInterviews = allBots.filter(bot =>
        bot.conversations.some(c => c.completedAt && new Date(c.completedAt) > weekAgo)
    );

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Ciao{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                </h1>
                <p className="text-gray-500 mt-1">Ecco cosa sta succedendo con le tue interviste</p>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalInterviews}</p>
                            <p className="text-sm text-gray-500">Interviste create</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalResponses}</p>
                            <p className="text-sm text-gray-500">Risposte raccolte</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{activeInterviews.length}</p>
                            <p className="text-sm text-gray-500">Attive questa settimana</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Responses */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-gray-400" />
                            Risposte recenti
                        </h2>
                        <Link href="/dashboard/interviews" className="text-sm text-amber-600 hover:text-amber-700">
                            Vedi tutte →
                        </Link>
                    </div>
                    {recentResponses.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p>Nessuna risposta ancora</p>
                            <p className="text-sm">Le risposte appariranno qui</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {recentResponses.map((response: any) => (
                                <Link
                                    key={response.id}
                                    href={`/dashboard/bots/${response.botId}`}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{response.botName}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(response.completedAt!).toLocaleDateString('it-IT', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                        Completata
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <Link
                        href="/onboarding"
                        className="block bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Crea nuova intervista</h3>
                                <p className="text-purple-100 text-sm">
                                    Descrivi il tuo obiettivo e l'AI genererà l'intervista perfetta in pochi secondi
                                </p>
                            </div>
                            <Sparkles className="w-8 h-8 text-amber-200" />
                        </div>
                    </Link>

                    <Link
                        href="/templates"
                        className="block bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">Esplora i template</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    Template pronti per HR, Product, Sales e altro
                                </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>
                    </Link>

                    {allBots.length > 0 && (
                        <Link
                            href="/dashboard/interviews"
                            className="block bg-white rounded-xl p-6 border border-gray-200 hover:border-amber-300 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Vedi tutte le interviste</h3>
                                    <p className="text-gray-500 text-sm mt-1">
                                        Gestisci e analizza le tue {allBots.length} interviste
                                    </p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bot, Plus, ArrowRight, Code } from 'lucide-react';

export default async function ChatbotsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    bots: {
                        where: { botType: 'chatbot' },
                        include: {
                            conversations: {
                                select: { id: true, status: true, completedAt: true }
                            }
                        },
                        orderBy: { updatedAt: 'desc' }
                    }
                }
            },
            projectAccess: {
                include: {
                    project: {
                        include: {
                            bots: {
                                where: { botType: 'chatbot' },
                                include: {
                                    conversations: {
                                        select: { id: true, status: true, completedAt: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) return <div>Utente non trovato.</div>;

    // Collect all bots from owned and assigned projects
    let allBots: any[] = [];

    if (user.role === 'ADMIN') {
        const allBotsFromDB = await prisma.bot.findMany({
            where: { botType: 'chatbot' },
            include: {
                conversations: {
                    select: { id: true, status: true, completedAt: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        allBots = allBotsFromDB;
    } else {
        const ownedBots = user.ownedProjects.flatMap(p => p.bots);
        const assignedBots = user.projectAccess.flatMap(pa => pa.project.bots);

        const uniqueIds = new Set();
        allBots = [...ownedBots, ...assignedBots].filter(bot => {
            if (uniqueIds.has(bot.id)) return false;
            uniqueIds.add(bot.id);
            return true;
        });
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Chatbot AI</h1>
                    <p className="text-gray-500 mt-1">Crea e gestisci i chatbot per il tuo sito web</p>
                </div>
                <Link
                    href="/dashboard/bots/create-chatbot"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuovo Chatbot
                </Link>
            </div>

            {/* Bots List */}
            {allBots.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun chatbot ancora</h3>
                    <p className="text-gray-500 mb-6">Crea il tuo primo assistente AI da integrare nel tuo sito</p>
                    <Link
                        href="/dashboard/bots/create-chatbot"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Crea Chatbot
                    </Link>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {allBots.map((bot: any) => {
                        const totalConversations = bot.conversations.length;

                        return (
                            <div
                                key={bot.id}
                                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow relative"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                                            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)' }}
                                        >
                                            <Bot className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                                            <p className="text-xs text-gray-500">Creato il {new Date(bot.createdAt).toLocaleDateString('it-IT')}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${bot.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {bot.status === 'PUBLISHED' ? 'Attivo' : 'Bozza'}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 mb-6 line-clamp-2 min-h-[40px]">
                                    {bot.description || "Assistente AI configurato per rispondere alle domande sul tuo sito."}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex gap-4 text-sm text-gray-500">
                                        <span><strong>{totalConversations}</strong> conversazioni</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link
                                            href={`/dashboard/bots/${bot.id}/embed`}
                                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                            title="Codice Embed"
                                        >
                                            <Code className="w-4 h-4" />
                                        </Link>
                                        <Link
                                            href={`/dashboard/bots/${bot.id}`}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            Gestisci
                                            <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

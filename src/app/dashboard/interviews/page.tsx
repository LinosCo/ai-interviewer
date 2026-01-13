import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus, TrendingUp, Users, Clock, ArrowRight } from 'lucide-react';
import { BotListItem } from '@/components/dashboard/BotListItem';

export default async function InterviewsPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    bots: {
                        where: {
                            botType: 'interview'
                        } as any,
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
            where: {
                botType: 'interview'
            } as any,
            include: {
                conversations: {
                    select: { id: true, status: true, completedAt: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        allBots = allBotsFromDB;
    } else {
        // Explicitly type the user with relations to satisfy TS
        const userWithRelations = user as any;
        const ownedBots = userWithRelations.ownedProjects.flatMap((p: any) => p.bots);
        const assignedBots = userWithRelations.projectAccess.flatMap((pa: any) => pa.project.bots);

        const uniqueIds = new Set();
        allBots = [...ownedBots, ...assignedBots].filter((bot: any) => {
            if (uniqueIds.has(bot.id)) return false;
            uniqueIds.add(bot.id);
            return true;
        });
    }

    // Calculate stats
    const totalInterviews = allBots.length;
    const totalResponses = allBots.reduce((sum, bot) => sum + bot.conversations.length, 0);
    const completedResponses = allBots.reduce((sum, bot) =>
        sum + bot.conversations.filter((c: any) => c.status === 'COMPLETED').length, 0
    );

    const recentResponses = allBots
        .flatMap(bot => bot.conversations.filter((c: any) => c.completedAt))
        .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 5);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Le mie interviste</h1>
                    <p className="text-gray-500 mt-1">Gestisci le tue interviste e visualizza le risposte</p>
                </div>
                <Link
                    href="/onboarding"
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Nuova intervista
                </Link>
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
                            <p className="text-sm text-gray-500">Interviste attive</p>
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
                            <p className="text-sm text-gray-500">Risposte totali</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{completedResponses}</p>
                            <p className="text-sm text-gray-500">Completate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interviews List */}
            {allBots.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna intervista ancora</h3>
                    <p className="text-gray-500 mb-6">Crea la tua prima intervista in meno di 5 minuti</p>
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Crea la tua prima intervista
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-900">Tutte le interviste</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {allBots.map((bot: any) => (
                            <BotListItem
                                key={bot.id}
                                bot={{
                                    ...bot,
                                    updatedAt: bot.updatedAt.toISOString(),
                                    conversations: bot.conversations.map((c: any) => ({
                                        ...c,
                                        completedAt: c.completedAt ? c.completedAt.toISOString() : null
                                    }))
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

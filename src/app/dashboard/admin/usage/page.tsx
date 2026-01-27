import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AdminUserCard } from './AdminUserCard';
import { Sparkles, MessageSquare, Bot, Eye, Users, Building2 } from 'lucide-react';

export interface UserData {
    id: string;
    email: string;
    name: string | null;
    role: string;
    plan: string;
    monthlyCreditsLimit: bigint;
    monthlyCreditsUsed: bigint;
    packCreditsAvailable: bigint;
    creditsResetDate: Date | null;
    createdAt: Date;
    organizations: {
        id: string;
        name: string;
        role: string;
        subscription: {
            tier: string;
            status: string;
            tokensUsedThisMonth: number;
            interviewsUsedThisMonth: number;
            chatbotSessionsUsedThisMonth: number;
            visibilityQueriesUsedThisMonth: number;
        } | null;
    }[];
    _count: {
        ownedProjects: number;
    };
    projectsWithBots: {
        id: string;
        name: string;
        _count: { bots: number };
    }[];
}

export default async function AdminUsagePage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    const currentUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (currentUser?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    // Fetch USERS (not organizations) - correct approach for user-centric credits
    const users = await prisma.user.findMany({
        include: {
            memberships: {
                include: {
                    organization: {
                        include: {
                            subscription: {
                                select: {
                                    tier: true,
                                    status: true,
                                    tokensUsedThisMonth: true,
                                    interviewsUsedThisMonth: true,
                                    chatbotSessionsUsedThisMonth: true,
                                    visibilityQueriesUsedThisMonth: true
                                }
                            }
                        }
                    }
                }
            },
            ownedProjects: {
                select: {
                    id: true,
                    name: true,
                    _count: { select: { bots: true } }
                }
            },
            _count: {
                select: { ownedProjects: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Transform to user-centric view
    const userData: UserData[] = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        monthlyCreditsLimit: user.monthlyCreditsLimit,
        monthlyCreditsUsed: user.monthlyCreditsUsed,
        packCreditsAvailable: user.packCreditsAvailable,
        creditsResetDate: user.creditsResetDate,
        createdAt: user.createdAt,
        organizations: user.memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            role: m.role,
            subscription: m.organization.subscription
        })),
        _count: user._count,
        projectsWithBots: user.ownedProjects
    }));

    // Global stats - based on USER credits (new system)
    const totalUsers = userData.length;
    const totalCreditsUsed = userData.reduce((sum, u) => sum + Number(u.monthlyCreditsUsed), 0);

    // Stats from organization subscriptions (legacy)
    const totalInterviews = userData.reduce((sum, u) =>
        sum + u.organizations.reduce((orgSum, org) =>
            orgSum + (org.subscription?.interviewsUsedThisMonth || 0), 0), 0);
    const totalChatbotSessions = userData.reduce((sum, u) =>
        sum + u.organizations.reduce((orgSum, org) =>
            orgSum + (org.subscription?.chatbotSessionsUsedThisMonth || 0), 0), 0);
    const totalVisibilityQueries = userData.reduce((sum, u) =>
        sum + u.organizations.reduce((orgSum, org) =>
            orgSum + (org.subscription?.visibilityQueriesUsedThisMonth || 0), 0), 0);

    // Plan distribution (user-level)
    const planCounts = userData.reduce((acc, u) => {
        acc[u.plan] = (acc[u.plan] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Organization count
    const uniqueOrgs = new Set(userData.flatMap(u => u.organizations.map(o => o.id)));
    const totalOrganizations = uniqueOrgs.size;

    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Monitoraggio Risorse (Admin)</h1>
                <p className="text-gray-500 mt-1">
                    Vista per <strong>Utenti</strong> con crediti e organizzazioni associate
                </p>
            </div>

            {/* Global Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-violet-200" />
                        <span className="text-violet-100 text-sm">Crediti Usati</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalCreditsUsed)}</p>
                    <p className="text-xs text-violet-200 mt-1">questo mese</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-5 h-5 text-amber-200" />
                        <span className="text-amber-100 text-sm">Interviste</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalInterviews)}</p>
                    <p className="text-xs text-amber-200 mt-1">completate</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-5 h-5 text-blue-200" />
                        <span className="text-blue-100 text-sm">Sessioni Chatbot</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalChatbotSessions)}</p>
                    <p className="text-xs text-blue-200 mt-1">attive</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-emerald-200" />
                        <span className="text-emerald-100 text-sm">Query Visibilità</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalVisibilityQueries)}</p>
                    <p className="text-xs text-emerald-200 mt-1">eseguite</p>
                </div>
                <div className="bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-slate-300" />
                        <span className="text-slate-300 text-sm">Utenti</span>
                    </div>
                    <p className="text-3xl font-bold">{totalUsers}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(planCounts).slice(0, 4).map(([plan, count]) => (
                            <span key={plan} className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                                {plan}: {count}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-pink-200" />
                        <span className="text-pink-100 text-sm">Organizzazioni</span>
                    </div>
                    <p className="text-3xl font-bold">{totalOrganizations}</p>
                    <p className="text-xs text-pink-200 mt-1">totali</p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <strong>Nota:</strong> Questa vista mostra gli <strong>utenti unici</strong> con i loro crediti personali.
                Ogni utente puo essere membro di piu organizzazioni (mostrate nel dettaglio).
            </div>

            {/* User List */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Utilizzo per Utente</h2>
                <div className="grid gap-6">
                    {userData.map((user) => (
                        <AdminUserCard key={user.id} user={user} />
                    ))}
                </div>
            </div>
        </div>
    );
}

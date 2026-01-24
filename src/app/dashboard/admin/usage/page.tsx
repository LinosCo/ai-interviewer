import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AdminAccountCard } from './AdminAccountCard';
import { Sparkles, MessageSquare, Bot, Eye, Users } from 'lucide-react';

interface SubscriptionData {
    id: string;
    tier: string;
    status: string;
    tokensUsedThisMonth: number;
    interviewsUsedThisMonth: number;
    chatbotSessionsUsedThisMonth: number;
    visibilityQueriesUsedThisMonth: number;
    interviewTokensUsed: number;
    chatbotTokensUsed: number;
    visibilityTokensUsed: number;
    suggestionTokensUsed: number;
    systemTokensUsed: number;
    extraTokens: number;
    extraInterviews: number;
    extraChatbotSessions: number;
    currentPeriodEnd: Date | null;
    customLimits?: any;
}

interface ProjectData {
    id: string;
    name: string;
    isPersonal: boolean;
    owner: { id: string; name: string | null; email: string } | null;
    _count: { bots: number };
    hasCMS: boolean;
}

interface AccountData {
    id: string;
    name: string;
    plan: string;
    owner: { id: string; name: string | null; email: string } | null;
    subscription: SubscriptionData | null;
    projects: ProjectData[];
    _count: {
        members: number;
        projects: number;
    };
    botCount: number;
    visibilityCount: number;
    hasCMS: boolean;
}

export default async function AdminUsagePage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    const orgs = await prisma.organization.findMany({
        include: {
            subscription: true,
            members: {
                where: { role: 'OWNER' },
                include: { user: { select: { id: true, name: true, email: true } } },
                take: 1
            },
            projects: {
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    _count: { select: { bots: true } },
                    cmsConnection: {
                        select: { id: true, status: true }
                    }
                }
            },
            visibilityConfigs: {
                select: { id: true, projectId: true }
            },
            _count: {
                select: {
                    members: true,
                    projects: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Transform to account-centric view
    const accounts: AccountData[] = orgs.map((org: any) => {
        const ownerMembership = org.members[0];
        const projectsWithCMS = org.projects.filter((p: any) => p.cmsConnection?.status === 'ACTIVE');
        return {
            id: org.id,
            name: org.name,
            plan: org.plan,
            owner: ownerMembership?.user || null,
            subscription: org.subscription as SubscriptionData | null,
            projects: org.projects.map((p: any) => ({
                id: p.id,
                name: p.name,
                isPersonal: p.isPersonal,
                owner: p.owner,
                _count: p._count,
                hasCMS: p.cmsConnection?.status === 'ACTIVE'
            })),
            _count: org._count,
            botCount: org.projects.reduce((sum: number, p: any) => sum + p._count.bots, 0),
            visibilityCount: org.visibilityConfigs.length,
            hasCMS: projectsWithCMS.length > 0
        };
    });

    // Global summary stats
    const totalAccounts = accounts.length;
    const totalTokens = accounts.reduce((sum, a) => sum + (a.subscription?.tokensUsedThisMonth || 0), 0);
    const totalInterviews = accounts.reduce((sum, a) => sum + (a.subscription?.interviewsUsedThisMonth || 0), 0);
    const totalChatbotSessions = accounts.reduce((sum, a) => sum + (a.subscription?.chatbotSessionsUsedThisMonth || 0), 0);
    const totalVisibilityQueries = accounts.reduce((sum, a) => sum + (a.subscription?.visibilityQueriesUsedThisMonth || 0), 0);

    // Token breakdown
    const tokenBreakdown = {
        interview: accounts.reduce((sum, a) => sum + (a.subscription?.interviewTokensUsed || 0), 0),
        chatbot: accounts.reduce((sum, a) => sum + (a.subscription?.chatbotTokensUsed || 0), 0),
        visibility: accounts.reduce((sum, a) => sum + (a.subscription?.visibilityTokensUsed || 0), 0),
        suggestion: accounts.reduce((sum, a) => sum + (a.subscription?.suggestionTokensUsed || 0), 0),
        system: accounts.reduce((sum, a) => sum + (a.subscription?.systemTokensUsed || 0), 0),
    };

    // Plan distribution
    const planCounts = accounts.reduce((acc, a) => {
        acc[a.plan] = (acc[a.plan] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Format large numbers
    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Monitoraggio Risorse (Admin)</h1>
                <p className="text-gray-500 mt-1">Utilizzo complessivo e per utente con limiti piano</p>
            </div>

            {/* Global Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-violet-200" />
                        <span className="text-violet-100 text-sm">Token AI Totali</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalTokens)}</p>
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
                        <span className="text-slate-300 text-sm">Account Utenti</span>
                    </div>
                    <p className="text-3xl font-bold">{totalAccounts}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(planCounts).map(([plan, count]) => (
                            <span key={plan} className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                                {plan}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Token Breakdown */}
            <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Breakdown Token per Categoria</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Interviste', value: tokenBreakdown.interview, color: 'bg-amber-500' },
                        { label: 'Chatbot', value: tokenBreakdown.chatbot, color: 'bg-blue-500' },
                        { label: 'Visibilità', value: tokenBreakdown.visibility, color: 'bg-emerald-500' },
                        { label: 'Suggerimenti AI', value: tokenBreakdown.suggestion, color: 'bg-purple-500' },
                        { label: 'Sistema', value: tokenBreakdown.system, color: 'bg-slate-500' },
                    ].map(item => (
                        <div key={item.label} className="text-center">
                            <div className={`${item.color} text-white rounded-lg p-3 mb-2`}>
                                <p className="text-2xl font-bold">{formatNumber(item.value)}</p>
                            </div>
                            <p className="text-sm text-gray-600">{item.label}</p>
                        </div>
                    ))}
                </div>
                {totalTokens > 0 && (
                    <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-gray-100">
                        {tokenBreakdown.interview > 0 && (
                            <div
                                className="bg-amber-500"
                                style={{ width: `${(tokenBreakdown.interview / totalTokens) * 100}%` }}
                                title={`Interviste: ${formatNumber(tokenBreakdown.interview)}`}
                            />
                        )}
                        {tokenBreakdown.chatbot > 0 && (
                            <div
                                className="bg-blue-500"
                                style={{ width: `${(tokenBreakdown.chatbot / totalTokens) * 100}%` }}
                                title={`Chatbot: ${formatNumber(tokenBreakdown.chatbot)}`}
                            />
                        )}
                        {tokenBreakdown.visibility > 0 && (
                            <div
                                className="bg-emerald-500"
                                style={{ width: `${(tokenBreakdown.visibility / totalTokens) * 100}%` }}
                                title={`Visibility: ${formatNumber(tokenBreakdown.visibility)}`}
                            />
                        )}
                        {tokenBreakdown.suggestion > 0 && (
                            <div
                                className="bg-purple-500"
                                style={{ width: `${(tokenBreakdown.suggestion / totalTokens) * 100}%` }}
                                title={`Suggestions: ${formatNumber(tokenBreakdown.suggestion)}`}
                            />
                        )}
                        {tokenBreakdown.system > 0 && (
                            <div
                                className="bg-slate-500"
                                style={{ width: `${(tokenBreakdown.system / totalTokens) * 100}%` }}
                                title={`Sistema: ${formatNumber(tokenBreakdown.system)}`}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Account List */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Utilizzo per Account Utente</h2>
                <div className="grid gap-6">
                    {accounts.map((account) => (
                        <AdminAccountCard key={account.id} account={account} />
                    ))}
                </div>
            </div>
        </div>
    );
}

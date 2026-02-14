import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AdminAccountCard } from './AdminAccountCard';
import { Sparkles, MessageSquare, Bot, Eye, Users, Building2 } from 'lucide-react';

export interface AccountData {
    id: string;
    name: string;
    plan: string;
    monthlyCreditsLimit: number;
    monthlyCreditsUsed: number;
    packCreditsAvailable: number;
    creditsResetDate: Date | null;
    owner: { id: string; name: string | null; email: string } | null;
    subscription: {
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
    } | null;
    projects: {
        id: string;
        name: string;
        isPersonal: boolean;
        owner: { id: string; name: string | null; email: string } | null;
        _count: { bots: number };
        hasCMS: boolean;
    }[];
    _count: {
        members: number;
        projects: number;
    };
    botCount: number;
    visibilityCount: number;
    hasCMS: boolean;
    creditUsageByTool: CreditUsageByTool;
}

interface CreditUsageByTool {
    interview: number;
    chatbot: number;
    visibility: number;
    ai_tips: number;
    copilot: number;
    export: number;
    other: number;
    total: number;
}

function toSafeNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value == null) return 0;
    const parsed = Number(value as any);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default async function AdminUsagePage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    const currentUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (currentUser?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    // Fetch ORGANIZATIONS
    const organizations = await prisma.organization.findMany({
        include: {
            members: {
                where: { role: 'OWNER' },
                include: { user: true }
            },
            subscription: true,
            projects: {
                include: {
                    owner: true,
                    _count: { select: { bots: true } }
                }
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageRows = await prisma.orgCreditTransaction.groupBy({
        by: ['organizationId', 'tool'],
        where: {
            type: 'usage',
            createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
    });

    const defaultUsage: CreditUsageByTool = {
        interview: 0,
        chatbot: 0,
        visibility: 0,
        ai_tips: 0,
        copilot: 0,
        export: 0,
        other: 0,
        total: 0
    };

    const usageByOrg: Record<string, CreditUsageByTool> = {};
    usageRows.forEach(row => {
        const orgUsage = usageByOrg[row.organizationId] || { ...defaultUsage };
        const tool = row.tool || 'other';
        const amount = Number(row._sum.amount || 0);
        const knownTools: Array<keyof CreditUsageByTool> = [
            'interview',
            'chatbot',
            'visibility',
            'ai_tips',
            'copilot',
            'export',
            'other'
        ];

        if (knownTools.includes(tool as keyof CreditUsageByTool)) {
            const key = tool as keyof CreditUsageByTool;
            orgUsage[key] += amount;
        } else {
            orgUsage.other += amount;
        }
        orgUsage.total += amount;
        usageByOrg[row.organizationId] = orgUsage;
    });

    const accountData: AccountData[] = organizations.map((org) => {
        const ownerMembership = org.members.find(m => m.role === 'OWNER');
        const owner = ownerMembership ? {
            id: ownerMembership.user.id,
            name: ownerMembership.user.name,
            email: ownerMembership.user.email
        } : null;

        // Sum bots across projects
        const botCount = org.projects.reduce((sum, p) => sum + p._count.bots, 0);

        // Hypothetical visibility count (e.g. from VisibilityConfig if joined, but let's count projects for now or leave as is)
        const visibilityCount = org.projects.length;

        return {
            id: org.id,
            name: org.name,
            plan: org.plan || 'FREE',
            monthlyCreditsLimit: Number(org.monthlyCreditsLimit),
            monthlyCreditsUsed: Number(org.monthlyCreditsUsed),
            packCreditsAvailable: Number(org.packCreditsAvailable),
            creditsResetDate: org.creditsResetDate,
            owner,
            subscription: org.subscription ? {
                id: org.subscription.id,
                tier: org.subscription.tier,
                status: org.subscription.status,
                tokensUsedThisMonth: toSafeNumber((org.subscription as any).tokensUsedThisMonth),
                interviewsUsedThisMonth: toSafeNumber((org.subscription as any).interviewsUsedThisMonth),
                chatbotSessionsUsedThisMonth: toSafeNumber((org.subscription as any).chatbotSessionsUsedThisMonth),
                visibilityQueriesUsedThisMonth: toSafeNumber((org.subscription as any).visibilityQueriesUsedThisMonth),
                interviewTokensUsed: toSafeNumber((org.subscription as any).interviewTokensUsed),
                chatbotTokensUsed: toSafeNumber((org.subscription as any).chatbotTokensUsed),
                visibilityTokensUsed: toSafeNumber((org.subscription as any).visibilityTokensUsed),
                suggestionTokensUsed: toSafeNumber((org.subscription as any).suggestionTokensUsed),
                systemTokensUsed: toSafeNumber((org.subscription as any).systemTokensUsed),
                extraTokens: toSafeNumber((org.subscription as any).extraTokens),
                extraInterviews: toSafeNumber((org.subscription as any).extraInterviews),
                extraChatbotSessions: toSafeNumber((org.subscription as any).extraChatbotSessions),
                currentPeriodEnd: org.subscription.currentPeriodEnd
            } : null,
            projects: org.projects.map(p => ({
                id: p.id,
                name: p.name,
                isPersonal: false, // Placeholder
                owner: p.owner ? { id: p.owner.id, name: p.owner.name, email: p.owner.email } : null,
                _count: p._count,
                hasCMS: false // Placeholder
            })),
            _count: org._count,
            botCount,
            visibilityCount,
            hasCMS: false,
            creditUsageByTool: usageByOrg[org.id] || { ...defaultUsage }
        };
    });

    // Global stats
    const totalOrganizations = accountData.length;
    const totalCreditsUsed = organizations.reduce((sum, org) => sum + Number(org.monthlyCreditsUsed), 0);
    const totalInterviewCredits = accountData.reduce((sum, acc) => sum + acc.creditUsageByTool.interview, 0);
    const totalChatbotCredits = accountData.reduce((sum, acc) => sum + acc.creditUsageByTool.chatbot, 0);
    const totalVisibilityCredits = accountData.reduce((sum, acc) => sum + acc.creditUsageByTool.visibility, 0);

    // Plan distribution
    const planCounts = accountData.reduce((acc, a) => {
        const tier = a.subscription?.tier || 'FREE';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const totalUsers = await prisma.user.count();

    const formatNumber = (n: number) => {
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Monitoraggio Risorse (Admin)</h1>
                <p className="text-gray-500 mt-1">
                    Vista per <strong>Organizzazioni</strong> (Account) con risorse e proprietari associati
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
                        <span className="text-amber-100 text-sm">Crediti Interviste</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalInterviewCredits)}</p>
                    <p className="text-xs text-amber-200 mt-1">mese corrente</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-5 h-5 text-blue-200" />
                        <span className="text-blue-100 text-sm">Crediti Chatbot</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalChatbotCredits)}</p>
                    <p className="text-xs text-blue-200 mt-1">mese corrente</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-emerald-200" />
                        <span className="text-emerald-100 text-sm">Crediti Visibility</span>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(totalVisibilityCredits)}</p>
                    <p className="text-xs text-emerald-200 mt-1">mese corrente</p>
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
                <strong>Nota:</strong> Questa vista mostra le <strong>Organizzazioni</strong> registrate.
                Puoi monitorare l&apos;utilizzo delle risorse e gestire i limiti per ogni account.
            </div>

            {/* Account List */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Utilizzo per Organizzazione (Account)</h2>
                <div className="grid gap-6">
                    {accountData.map((account) => (
                        <AdminAccountCard key={account.id} account={account} />
                    ))}
                </div>
            </div>
        </div>
    );
}

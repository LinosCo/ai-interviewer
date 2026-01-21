import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AdminOrgCard } from './AdminOrgCard';

interface OrganizationWithUsage {
    id: string;
    name: string;
    plan: string;
    subscription: {
        status: string;
        interviewsUsedThisMonth: number;
        customLimits?: any;
    } | null;
    _count: {
        members: number;
        projects: number;
    };
    botCount: number;
    visibilityCount: number;
    customLimits?: {
        maxInterviews?: number;
        maxChatbots?: number;
        maxProjects?: number;
    };
}

export default async function AdminUsagePage() {
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) redirect('/login');

    // Simple check for admin - in production use proper role check middleware/util
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (user?.role !== 'ADMIN') {
        return <div className="p-8">Access Denied</div>;
    }

    const orgs = await prisma.organization.findMany({
        include: {
            subscription: true,
            projects: {
                include: {
                    _count: {
                        select: { bots: true }
                    }
                }
            },
            visibilityConfigs: {
                select: { id: true }
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

    // Transform to include counts
    const organizations: OrganizationWithUsage[] = orgs.map(org => ({
        id: org.id,
        name: org.name,
        plan: org.plan,
        subscription: org.subscription,
        _count: org._count,
        botCount: org.projects.reduce((sum, p) => sum + p._count.bots, 0),
        visibilityCount: org.visibilityConfigs.length,
        customLimits: (org.subscription?.customLimits as any) || undefined
    }));

    // Summary stats
    const totalOrgs = organizations.length;
    const totalBots = organizations.reduce((sum, o) => sum + o.botCount, 0);
    const totalInterviews = organizations.reduce((sum, o) => sum + (o.subscription?.interviewsUsedThisMonth || 0), 0);
    const planCounts = organizations.reduce((acc, o) => {
        acc[o.plan] = (acc[o.plan] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Monitoraggio Consumi (Admin)</h1>
                <p className="text-gray-500 mt-1">Visualizza e modifica i limiti delle organizzazioni</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <p className="text-blue-100 text-sm">Organizzazioni</p>
                    <p className="text-3xl font-bold">{totalOrgs}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <p className="text-green-100 text-sm">Bot Totali</p>
                    <p className="text-3xl font-bold">{totalBots}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <p className="text-purple-100 text-sm">Interviste Mese</p>
                    <p className="text-3xl font-bold">{totalInterviews}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                    <p className="text-amber-100 text-sm">Piani Attivi</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                        {Object.entries(planCounts).map(([plan, count]) => (
                            <span key={plan} className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                {plan}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Organization List */}
            <div className="grid gap-6">
                {organizations.map((org) => (
                    <AdminOrgCard key={org.id} org={org} />
                ))}
            </div>
        </div>
    );
}

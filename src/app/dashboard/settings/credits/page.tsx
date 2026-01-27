import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PLANS, PlanType } from '@/config/plans';
import { CREDIT_PACKS, formatCredits } from '@/config/creditPacks';
import { Zap, Package, History, TrendingUp, RefreshCcw, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default async function CreditsSettingsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            plan: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
            packCreditsAvailable: true,
            creditsResetDate: true
        }
    });

    if (!user) {
        redirect('/login');
    }

    // Get credit packs for this user
    const creditPacks = await prisma.creditPack.findMany({
        where: { userId: session.user.id },
        orderBy: { purchasedAt: 'desc' }
    });

    // Get recent transactions
    const transactions = await prisma.creditTransaction.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            project: { select: { name: true } }
        }
    });

    // Get usage by tool (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageByTool = await prisma.creditTransaction.groupBy({
        by: ['tool'],
        where: {
            userId: session.user.id,
            type: 'usage',
            createdAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true }
    });

    const planConfig = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];
    const monthlyLimit = Number(user.monthlyCreditsLimit);
    const monthlyUsed = Number(user.monthlyCreditsUsed);
    const packAvailable = Number(user.packCreditsAvailable);
    const totalAvailable = monthlyLimit - monthlyUsed + packAvailable;
    const percentageUsed = monthlyLimit > 0 ? Math.round((monthlyUsed / monthlyLimit) * 100) : 0;

    const getBarColor = (pct: number) => {
        if (pct >= 95) return 'bg-red-500';
        if (pct >= 85) return 'bg-orange-500';
        if (pct >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const formatResetDate = () => {
        if (!user.creditsResetDate) return 'N/A';
        return new Date(user.creditsResetDate).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long'
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Gestione Crediti</h1>
                    <p className="text-gray-600 mt-2">
                        Monitora i tuoi crediti AI, storico consumi e pack acquistati.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {/* Current Credits Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Crediti Disponibili</h3>
                                <p className="text-sm text-stone-500">Piano {planConfig.name}</p>
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-stone-900 mb-4">
                            {formatCredits(totalAvailable)}
                        </p>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm text-stone-600 mb-1">
                                    <span>Mensili: {formatCredits(monthlyUsed)} / {formatCredits(monthlyLimit)}</span>
                                    <span>{percentageUsed}%</span>
                                </div>
                                <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${getBarColor(percentageUsed)} transition-all`}
                                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                                    />
                                </div>
                            </div>
                            {packAvailable > 0 && (
                                <div className="flex items-center gap-2 text-sm text-amber-600">
                                    <Package className="w-4 h-4" />
                                    <span>+ {formatCredits(packAvailable)} da pack</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                                <RefreshCcw className="w-4 h-4" />
                                <span>Reset: {formatResetDate()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Plan Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Piano Attuale</h3>
                                <p className="text-sm text-stone-500">{formatCredits(monthlyLimit)}/mese</p>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-stone-900 mb-2">{planConfig.name}</p>
                        <p className="text-sm text-stone-600 mb-4">{planConfig.description}</p>
                        <Link
                            href="/dashboard/billing/plans"
                            className="block w-full text-center py-2 px-4 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
                        >
                            Cambia Piano
                        </Link>
                    </div>

                    {/* Buy Pack Card */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-sm border border-amber-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-stone-900">Acquista Pack</h3>
                                <p className="text-sm text-stone-600">Crediti extra senza scadenza</p>
                            </div>
                        </div>
                        <div className="space-y-2 mb-4">
                            {CREDIT_PACKS.map(pack => (
                                <div key={pack.id} className="flex justify-between text-sm">
                                    <span className="text-stone-600">{formatCredits(pack.credits)}</span>
                                    <span className="font-medium text-stone-900">€{pack.price}</span>
                                </div>
                            ))}
                        </div>
                        <Link
                            href="/dashboard/billing?tab=packs"
                            className="block w-full text-center py-2 px-4 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
                        >
                            Acquista Ora
                        </Link>
                    </div>
                </div>

                {/* Usage by Tool */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <History className="w-5 h-5 text-stone-600" />
                        <h3 className="font-semibold text-stone-900">Consumo per Strumento (30 giorni)</h3>
                    </div>
                    {usageByTool.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {usageByTool.map(usage => (
                                <div key={usage.tool} className="bg-stone-50 rounded-lg p-4">
                                    <p className="text-sm text-stone-600 capitalize">{usage.tool || 'Altro'}</p>
                                    <p className="text-xl font-bold text-stone-900">
                                        {formatCredits(Number(usage._sum.amount || 0))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-stone-500 text-center py-8">
                            Nessun consumo negli ultimi 30 giorni
                        </p>
                    )}
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <History className="w-5 h-5 text-stone-600" />
                            <h3 className="font-semibold text-stone-900">Ultime Transazioni</h3>
                        </div>
                        <Link
                            href="/dashboard/settings/credits/history"
                            className="text-sm text-amber-600 hover:text-amber-700"
                        >
                            Vedi tutte
                        </Link>
                    </div>
                    {transactions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-stone-200">
                                        <th className="text-left py-3 px-2 font-medium text-stone-600">Data</th>
                                        <th className="text-left py-3 px-2 font-medium text-stone-600">Strumento</th>
                                        <th className="text-left py-3 px-2 font-medium text-stone-600">Progetto</th>
                                        <th className="text-right py-3 px-2 font-medium text-stone-600">Crediti</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(tx => (
                                        <tr key={tx.id} className="border-b border-stone-100">
                                            <td className="py-3 px-2 text-stone-600">
                                                {new Date(tx.createdAt).toLocaleDateString('it-IT', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="py-3 px-2 text-stone-900 capitalize">
                                                {tx.tool || tx.type}
                                            </td>
                                            <td className="py-3 px-2 text-stone-600">
                                                {tx.project?.name || '-'}
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                <span className={tx.type === 'usage' ? 'text-red-600' : 'text-green-600'}>
                                                    {tx.type === 'usage' ? '-' : '+'}{formatCredits(Math.abs(Number(tx.amount)))}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-stone-500 text-center py-8">
                            Nessuna transazione registrata
                        </p>
                    )}
                </div>

                {/* Purchased Packs */}
                {creditPacks.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Package className="w-5 h-5 text-stone-600" />
                            <h3 className="font-semibold text-stone-900">Pack Acquistati</h3>
                        </div>
                        <div className="space-y-3">
                            {creditPacks.map(pack => (
                                <div key={pack.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-stone-900 capitalize">Pack {pack.packType}</p>
                                        <p className="text-sm text-stone-500">
                                            Acquistato il {new Date(pack.purchasedAt).toLocaleDateString('it-IT')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-stone-900">
                                            {formatCredits(Number(pack.creditsRemaining))} / {formatCredits(Number(pack.creditsPurchased))}
                                        </p>
                                        <p className="text-sm text-stone-500">rimanenti</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

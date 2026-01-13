import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getUsageStats } from '@/lib/usage';
import { getPricingPlans } from '@/lib/stripe';

import Link from 'next/link';
import { CreditCard, ArrowUpRight, FileText, AlertCircle } from 'lucide-react';

import { TokenUsageCard } from '@/components/billing/TokenUsageCard';

export default async function BillingPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: {
                        include: {
                            subscription: {
                                include: {
                                    invoices: {
                                        orderBy: { createdAt: 'desc' },
                                        take: 5
                                    }
                                }
                            }
                        }
                    }
                },
                take: 1
            }
        }
    });

    const organization = user?.memberships[0]?.organization;
    const subscription = organization?.subscription;

    // If no org/subscription, show upgrade prompt
    if (!organization || !subscription) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Piano e fatturazione</h1>
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Nessun piano attivo</h2>
                    <p className="text-gray-500 mb-6">Scegli un piano per sbloccare tutte le funzionalità</p>
                    <Link
                        href="/pricing"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                        Vedi i piani
                        <ArrowUpRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }



    // ... imports ...

    const usage = await getUsageStats(organization.id);
    const plans = await getPricingPlans(); // Fetch plans
    const currentPlan = plans[subscription.tier as keyof typeof plans]; // Access plan

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-900">Piano e fatturazione</h1>

            {/* Token Usage Card - Prominent */}
            <TokenUsageCard
                usage={usage.tokens}
            />

            {/* Current Plan */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Piano attuale</h2>
                            <p className="text-gray-500 text-sm">Gestisci il tuo abbonamento</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold text-gray-900">{currentPlan.name}</span>
                            {currentPlan.price && (
                                <p className="text-gray-500 text-sm">€{currentPlan.price}/mese</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Usage Bars */}
                    <div className="space-y-4">
                        <UsageBar
                            label="Interviste attive"
                            used={usage.activeBots.used}
                            limit={usage.activeBots.limit}
                            percentage={usage.activeBots.percentage}
                        />
                        <UsageBar
                            label="Risposte questo mese"
                            used={usage.interviews.used}
                            limit={usage.interviews.limit}
                            percentage={usage.interviews.percentage}
                        />
                        <UsageBar
                            label="Utenti"
                            used={usage.users.used}
                            limit={usage.users.limit}
                            percentage={usage.users.percentage}
                        />
                    </div>

                    {/* Period Info */}
                    <p className="text-sm text-gray-500">
                        Il periodo attuale scade il {new Date(usage.currentPeriodEnd).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
                    {subscription.tier === 'FREE' ? (
                        <Link
                            href="/pricing"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            Effettua l'upgrade
                        </Link>
                    ) : (
                        <form action="/api/stripe/portal" method="POST">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
                            >
                                Gestisci abbonamento
                            </button>
                        </form>
                    )}
                    <Link
                        href="/pricing"
                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                    >
                        Vedi tutti i piani
                    </Link>
                </div>
            </div>

            {/* Invoices */}
            {subscription.invoices.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">Fatture recenti</h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {subscription.invoices.map((invoice) => (
                            <div key={invoice.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            €{(invoice.amountPaid / 100).toFixed(2)}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {new Date(invoice.createdAt).toLocaleDateString('it-IT')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${invoice.status === 'paid'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {invoice.status === 'paid' ? 'Pagata' : invoice.status}
                                    </span>
                                    {invoice.pdfUrl && (
                                        <a
                                            href={invoice.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-600 hover:text-purple-700 text-sm"
                                        >
                                            Scarica PDF
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning for past due */}
            {subscription.status === 'PAST_DUE' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-red-800">Pagamento in sospeso</h3>
                        <p className="text-red-600 text-sm mt-1">
                            Il pagamento del tuo abbonamento non è andato a buon fine.
                            Aggiorna il metodo di pagamento per evitare interruzioni del servizio.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function UsageBar({ label, used, limit, percentage }: {
    label: string;
    used: number;
    limit: number;
    percentage: number;
}) {
    const isUnlimited = limit === -1;
    const isWarning = percentage >= 80 && !isUnlimited;

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className={isWarning ? 'text-orange-600 font-medium' : 'text-gray-900'}>
                    {used} / {isUnlimited ? '∞' : limit}
                </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isWarning ? 'bg-orange-500' : 'bg-purple-500'
                        }`}
                    style={{ width: isUnlimited ? '10%' : `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );
}

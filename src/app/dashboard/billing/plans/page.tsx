import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, PURCHASABLE_PLANS, formatMonthlyCredits } from '@/config/plans';
import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';
import { cookies } from 'next/headers';
import CheckoutButton from './checkout-button';
import StripePortalButton from './stripe-portal-button';

const SALES_EMAIL = 'businesstuner@voler.ai';

export default async function PlansPage({
    searchParams
}: {
    searchParams?: Promise<{ billing?: string }>
}) {
    const session = await auth();
    if (!session?.user?.email) return null;
    const resolvedSearchParams = await searchParams;
    const billingPeriod = resolvedSearchParams?.billing === 'yearly' ? 'yearly' : 'monthly';

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            memberships: {
                select: {
                    organizationId: true,
                    organization: {
                        select: {
                            plan: true,
                            subscription: {
                                select: {
                                    status: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const activeMembership = activeOrgId
        ? user?.memberships.find(m => m.organizationId === activeOrgId) || user?.memberships[0]
        : user?.memberships[0];
    const currentPlan = activeMembership?.organization.subscription?.status === 'TRIALING'
        ? PlanType.TRIAL
        : ((activeMembership?.organization.plan as PlanType) || PlanType.FREE);

    // Build plans array with current plan info
    const visiblePlanTypes = PURCHASABLE_PLANS.filter(
        planType => planType !== PlanType.PARTNER && planType !== PlanType.ENTERPRISE
    );

    const plans = visiblePlanTypes.map(planType => ({
        ...PLANS[planType],
        requiresSalesContact: planType === PlanType.BUSINESS,
        isCurrent: currentPlan === planType
    }));

    // Feature comparison data
    const featureComparison = [
        { name: 'Crediti mensili', key: 'credits' },
        { name: 'Interview AI', key: 'interviewAI' },
        { name: 'Chatbot', key: 'chatbot' },
        { name: 'Brand Monitor', key: 'visibilityTracker' },
        { name: 'AI Tips', key: 'aiTips' },
        { name: 'Copilot Strategico', key: 'copilotStrategico' },
        { name: 'CMS Integrations', key: 'cmsIntegrations' },
        { name: 'Export CSV', key: 'exportCsv' },
        { name: 'Analytics', key: 'analytics' },
    ];

    const getFeatureValue = (plan: typeof PLANS[PlanType], key: string) => {
        if (key === 'credits') {
            return formatMonthlyCredits(plan.monthlyCredits);
        }

        const feature = plan.features[key as keyof typeof plan.features];

        if (typeof feature === 'boolean') {
            return feature;
        }
        if (feature === 'conditional') {
            return 'Con condizioni';
        }
        if (feature === 'base') {
            return 'Base';
        }
        if (feature === 'full') {
            return 'Completo';
        }
        if (feature === 'watermark') {
            return 'Con watermark';
        }
        if (feature === 'clean') {
            return 'Senza watermark';
        }
        return feature;
    };

    return (
        <div className="pb-10">
            <div className="mb-10">
                <Link href="/dashboard/billing" className="text-stone-500 hover:text-stone-900 transition-all flex items-center gap-2 mb-4 text-sm font-medium">
                    <Icons.ArrowRight size={16} className="rotate-180" /> Torna alla gestione
                </Link>
                <h1 className="text-3xl font-bold text-stone-900 mb-2">Scegli il tuo piano</h1>
                <p className="text-stone-600">
                    Seleziona l&apos;opzione più adatta alle tue esigenze. Tutti i piani includono le funzionalità base.
                </p>
            </div>

            <div className="mb-6 max-w-6xl flex items-center justify-center gap-3">
                <Link
                    href="/dashboard/billing/plans?billing=monthly"
                    className={`px-4 py-2 rounded-xl text-sm font-bold border ${billingPeriod === 'monthly' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}
                >
                    Mensile
                </Link>
                <Link
                    href="/dashboard/billing/plans?billing=yearly"
                    className={`px-4 py-2 rounded-xl text-sm font-bold border ${billingPeriod === 'yearly' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}
                >
                    Annuale
                </Link>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
                {plans.map((plan) => {
                    const isCurrent = plan.isCurrent;
                    const isPopular = plan.popular;

                    return (
                        <div
                            key={plan.id}
                            className={`bg-white/80 backdrop-blur-md rounded-[32px] p-8 border ${isPopular ? 'border-amber-400 shadow-xl' : 'border-white/50 shadow-sm'
                                } flex flex-col relative`}
                        >
                            {isPopular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                                    Consigliato
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-stone-900 mb-2">{plan.name}</h3>
                            <p className="text-sm text-stone-500 mb-4">{plan.description}</p>

                            <div className="mb-4 flex items-baseline gap-1">
                                {plan.requiresSalesContact ? (
                                    <>
                                        <span className="text-4xl font-black text-stone-900">
                                            €{billingPeriod === 'yearly' ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice}
                                        </span>
                                        <span className="text-stone-400 text-sm">/mese</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-4xl font-black text-stone-900">
                                            €{billingPeriod === 'yearly' ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice}
                                        </span>
                                        <span className="text-stone-400 text-sm">/mese</span>
                                    </>
                                )}
                            </div>

                            {!plan.requiresSalesContact && billingPeriod === 'yearly' && plan.yearlyMonthlyEquivalent < plan.monthlyPrice && (
                                <div className="mb-4 text-sm text-green-600 font-medium bg-green-50 rounded-lg px-3 py-2">
                                    Fatturato annualmente: €{plan.yearlyPrice}/anno
                                </div>
                            )}

                            {plan.requiresSalesContact && (
                                <div className="mb-4 text-sm text-amber-700 font-medium bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                    Piano Business attivabile tramite contatto commerciale.
                                </div>
                            )}

                            {/* Credits highlight */}
                            <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icons.Sparkles size={16} className="text-amber-500" />
                                    <span className="text-xs font-bold text-amber-700 uppercase">Crediti AI</span>
                                </div>
                                <p className="text-2xl font-black text-amber-600">
                                    {formatMonthlyCredits(plan.monthlyCredits)}
                                    <span className="text-sm font-medium text-amber-500">/mese</span>
                                </p>
                            </div>

                            {/* Features list */}
                            <ul className="space-y-3 mb-10 flex-grow">
                                {plan.featureList
                                    .filter((feature) => {
                                        const normalized = feature.toLowerCase();
                                        return !normalized.includes('pdf')
                                            && !normalized.includes('api')
                                            && !normalized.includes('white label');
                                    })
                                    .map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-stone-600">
                                        <Icons.Check size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA Button */}
                            {isCurrent ? (
                                <button disabled className="w-full bg-stone-100 text-stone-400 font-bold py-4 rounded-2xl cursor-not-allowed">
                                    Piano attuale
                                </button>
                            ) : plan.requiresSalesContact ? (
                                <a
                                    href={`mailto:${SALES_EMAIL}?subject=Richiesta%20Piano%20Business`}
                                    className="w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-stone-800"
                                >
                                    Richiedi info via email <Icons.ArrowRight size={18} />
                                </a>
                            ) : (
                                <CheckoutButton
                                    tier={plan.id}
                                    billingPeriod={billingPeriod}
                                    organizationId={activeMembership?.organizationId}
                                    className={`w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 ${isPopular
                                            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                                            : 'bg-stone-900 text-white hover:bg-stone-800'
                                        }`}
                                >
                                </CheckoutButton>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-16 max-w-6xl">
                <h2 className="text-2xl font-bold text-stone-900 mb-8">Confronto funzionalità</h2>
                <div className="bg-white/80 backdrop-blur-md rounded-[24px] border border-white/50 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto w-full">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-stone-100">
                                <th className="text-left p-4 text-sm font-bold text-stone-500">Funzionalità</th>
                                {plans.map(plan => (
                                    <th key={plan.id} className="p-4 text-center">
                                        <span className={`text-sm font-bold ${plan.popular ? 'text-amber-600' : 'text-stone-900'}`}>
                                            {plan.name}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {featureComparison.map((feature, idx) => (
                                <tr key={feature.key} className={idx % 2 === 0 ? 'bg-stone-50/50' : ''}>
                                    <td className="p-4 text-sm text-stone-700 font-medium">{feature.name}</td>
                                    {plans.map(plan => {
                                        const value = getFeatureValue(plan, feature.key);
                                        return (
                                            <td key={plan.id} className="p-4 text-center">
                                                {typeof value === 'boolean' ? (
                                                    value ? (
                                                        <Icons.Check size={20} className="text-green-500 mx-auto" />
                                                    ) : (
                                                        <span className="text-stone-300">—</span>
                                                    )
                                                ) : (
                                                    <span className={`text-sm font-medium ${feature.key === 'credits' ? 'text-amber-600 font-bold' : 'text-stone-600'
                                                        }`}>
                                                        {value}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            {/* Annual billing CTA */}
            <div className="mt-12 bg-amber-50 rounded-[28px] p-8 border border-amber-100/50 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl">
                <div>
                    <h4 className="text-lg font-bold text-stone-900 mb-1">Passa alla fatturazione annuale</h4>
                    <p className="text-stone-600 text-sm">Risparmia fino al 30% su tutti i piani attivando il pagamento annuale.</p>
                </div>
                <StripePortalButton organizationId={activeMembership?.organizationId || ''} />
            </div>

        </div>
    );
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, PURCHASABLE_PLANS, formatMonthlyCredits } from '@/config/plans';
import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';

export default async function PlansPage() {
    const session = await auth();
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            plan: true
        }
    });

    const currentPlan = (user?.plan as PlanType) || PlanType.FREE;

    // Build plans array with current plan info
    const plans = PURCHASABLE_PLANS.map(planType => ({
        ...PLANS[planType],
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
        { name: 'White Label', key: 'whiteLabel' },
        { name: 'API Access', key: 'apiAccess' },
        { name: 'CMS Integrations', key: 'cmsIntegrations' },
        { name: 'Export PDF', key: 'exportPdf' },
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

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
                {plans.map((plan) => {
                    const isCurrent = plan.isCurrent;
                    const isPopular = plan.popular;

                    return (
                        <div
                            key={plan.id}
                            className={`bg-white/80 backdrop-blur-md rounded-[32px] p-8 border ${
                                isPopular ? 'border-amber-400 shadow-xl' : 'border-white/50 shadow-sm'
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
                                <span className="text-4xl font-black text-stone-900">€{plan.monthlyPrice}</span>
                                <span className="text-stone-400 text-sm">/mese</span>
                            </div>

                            {plan.yearlyMonthlyEquivalent < plan.monthlyPrice && (
                                <div className="mb-4 text-sm text-green-600 font-medium bg-green-50 rounded-lg px-3 py-2">
                                    €{plan.yearlyMonthlyEquivalent}/mese con piano annuale
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
                                {plan.featureList.map((feature, i) => (
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
                            ) : plan.id === PlanType.BUSINESS ? (
                                <Link href="mailto:hello@voler.ai?subject=Richiesta%20Piano%20Business" className="w-full">
                                    <button className="w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-stone-800">
                                        Contatta Sales <Icons.ArrowRight size={18} />
                                    </button>
                                </Link>
                            ) : (
                                <Link href={`/api/stripe/checkout?plan=${plan.id}`} className="w-full">
                                    <button className={`w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                                        isPopular
                                            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                                            : 'bg-stone-900 text-white hover:bg-stone-800'
                                    }`}>
                                        Seleziona piano <Icons.ArrowRight size={18} />
                                    </button>
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Feature Comparison Table */}
            <div className="mt-16 max-w-6xl">
                <h2 className="text-2xl font-bold text-stone-900 mb-8">Confronto funzionalità</h2>
                <div className="bg-white/80 backdrop-blur-md rounded-[24px] border border-white/50 shadow-sm overflow-hidden">
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
                                                    <span className={`text-sm font-medium ${
                                                        feature.key === 'credits' ? 'text-amber-600 font-bold' : 'text-stone-600'
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

            {/* Annual billing CTA */}
            <div className="mt-12 bg-amber-50 rounded-[28px] p-8 border border-amber-100/50 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl">
                <div>
                    <h4 className="text-lg font-bold text-stone-900 mb-1">Passa alla fatturazione annuale</h4>
                    <p className="text-stone-600 text-sm">Risparmia fino al 30% su tutti i piani attivando il pagamento annuale.</p>
                </div>
                <Link href="/api/stripe/portal">
                    <button className="bg-white text-stone-900 font-bold px-8 py-3.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all text-sm shadow-sm flex items-center gap-2">
                        <Icons.Settings2 size={16} /> Gestisci in Stripe
                    </button>
                </Link>
            </div>

            {/* Partner CTA */}
            <div className="mt-8 bg-stone-900 rounded-[28px] p-8 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl text-white">
                <div>
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Per consulenti</span>
                    <h4 className="text-lg font-bold mt-2 mb-1">Sei un&apos;agenzia o un consulente?</h4>
                    <p className="text-stone-400 text-sm">
                        Il piano Partner ti permette di gestire più clienti, trasferire progetti e guadagnare con Business Tuner.
                        €29/mese, gratuito con 3+ clienti attivi.
                    </p>
                </div>
                <Link href="/partner">
                    <button className="bg-amber-500 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-amber-600 transition-all text-sm shadow-sm flex items-center gap-2 whitespace-nowrap">
                        Scopri Partner <Icons.ArrowRight size={16} />
                    </button>
                </Link>
            </div>
        </div>
    );
}

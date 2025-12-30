import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/config/plans';
import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';

export default async function PlansPage() {
    const session = await auth();
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: true
                }
            }
        }
    });

    const currentPlan = (user?.memberships[0]?.organization?.plan?.toLowerCase() as PlanType) || PlanType.TRIAL;

    const plans = [
        { ...PLANS[PlanType.STARTER], tier: 'STARTER', popular: false },
        { ...PLANS[PlanType.PRO], tier: 'PRO', popular: true },
        { ...PLANS[PlanType.BUSINESS], tier: 'BUSINESS', popular: false }
    ];

    return (
        <div className="pb-10">
            <div className="mb-10">
                <Link href="/dashboard/billing" className="text-stone-500 hover:text-stone-900 transition-all flex items-center gap-2 mb-4 text-sm font-medium">
                    <Icons.ArrowRight size={16} className="rotate-180" /> Torna alla gestione
                </Link>
                <h1 className="text-3xl font-bold text-stone-900 mb-2">Scegli il tuo piano</h1>
                <p className="text-stone-600">
                    Seleziona l'opzione più adatta alla tua scala di ricerca.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
                {plans.map((plan) => {
                    const isCurrent = currentPlan === plan.id;

                    return (
                        <div key={plan.id} className={`bg-white/80 backdrop-blur-md rounded-[32px] p-8 border ${plan.popular ? 'border-amber-400 shadow-xl' : 'border-white/50 shadow-sm'} flex flex-col relative`}>
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                                    Consigliato
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-stone-900 mb-2">{plan.name}</h3>
                            <div className="mb-6 flex items-baseline gap-1">
                                <span className="text-4xl font-black text-stone-900">€{plan.price}</span>
                                <span className="text-stone-400 text-sm">/mese</span>
                            </div>

                            <ul className="space-y-4 mb-10 flex-grow">
                                {plan.marketingFeatures.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-stone-600">
                                        <Icons.Check size={18} className="text-amber-500 shadow-sm" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {isCurrent ? (
                                <button disabled className="w-full bg-stone-100 text-stone-400 font-bold py-4 rounded-2xl cursor-not-allowed">
                                    Piano attuale
                                </button>
                            ) : plan.tier === 'BUSINESS' ? (
                                <Link href="mailto:hello@voler.ai?subject=Richiesta%20Piano%20Business" className="w-full">
                                    <button className="w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-stone-800">
                                        Contatta Sales <Icons.ArrowRight size={18} />
                                    </button>
                                </Link>
                            ) : (
                                <Link href={`/api/stripe/checkout?tier=${plan.tier}`} className="w-full">
                                    <button className={`w-full font-bold py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 ${plan.popular ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20' : 'bg-stone-900 text-white hover:bg-stone-800'}`}>
                                        Seleziona piano <Icons.ArrowRight size={18} />
                                    </button>
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-12 bg-amber-50 rounded-[28px] p-8 border border-amber-100/50 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h4 className="text-lg font-bold text-stone-900 mb-1">Passa alla fatturazione annuale?</h4>
                    <p className="text-stone-600 text-sm">Risparmia il 20% su tutti i piani attivando il pagamento annuale.</p>
                </div>
                <Link href="/api/stripe/portal">
                    <button className="bg-white text-stone-900 font-bold px-8 py-3.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all text-sm shadow-sm flex items-center gap-2">
                        <Icons.Settings2 size={16} /> Gestisci in Stripe
                    </button>
                </Link>
            </div>
        </div>
    );
}

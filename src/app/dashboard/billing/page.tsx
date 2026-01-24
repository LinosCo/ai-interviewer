import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/config/plans';
import { Icons } from '@/components/ui/business-tuner/Icons';
import BillingClient from './billing-client';
import { UsageDashboard } from '@/components/dashboard/UsageDashboard';

export default async function BillingPage() {
    const session = await auth();
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            memberships: {
                include: {
                    organization: {
                        include: {
                            subscription: true
                        }
                    }
                }
            }
        }
    });

    if (!user || user.memberships.length === 0) return <div>Organizzazione non trovata.</div>;

    const org = user.memberships[0].organization;
    const currentPlan = (org.plan as PlanType) || PlanType.TRIAL;
    const planConfig = PLANS[currentPlan] || PLANS[PlanType.FREE];

    return (
        <div className="pb-10">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-stone-900 mb-2">Abbonamento</h1>
                <p className="text-stone-600">
                    Gestisci il tuo piano, i pagamenti e la fatturazione.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Current Plan Card */}
                <div className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-[24px] p-8 border border-white/50 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full mb-3 inline-block">
                                Piano Attuale
                            </span>
                            <h2 className="text-3xl font-black text-stone-900">{planConfig.name}</h2>
                        </div>
                        <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-900">
                            <Icons.CreditCard size={32} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8 mt-4">
                        <div className="p-4 bg-stone-50 rounded-2xl">
                            <p className="text-xs text-stone-400 font-bold uppercase mb-1">Interviste/Mese</p>
                            <p className="text-xl font-bold text-stone-900">{planConfig.limits.maxInterviewsPerMonth === -1 ? 'Illimitate' : planConfig.limits.maxInterviewsPerMonth}</p>
                        </div>
                        <div className="p-4 bg-stone-50 rounded-2xl">
                            <p className="text-xs text-stone-400 font-bold uppercase mb-1">Chatbot</p>
                            <p className="text-xl font-bold text-stone-900">{planConfig.limits.maxChatbots === -1 ? 'Illimitati' : planConfig.limits.maxChatbots}</p>
                        </div>
                        <div className="p-4 bg-stone-50 rounded-2xl">
                            <p className="text-xs text-stone-400 font-bold uppercase mb-1">Utenti</p>
                            <p className="text-xl font-bold text-stone-900">{planConfig.limits.maxUsers === -1 ? 'Illimitati' : planConfig.limits.maxUsers}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-100">
                        <BillingClient />
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-stone-900 text-white rounded-[24px] p-8 flex flex-col">
                    <h3 className="text-xl font-bold mb-4">Passa al piano superiore</h3>
                    <p className="text-stone-400 text-sm mb-8 leading-relaxed">
                        Hai bisogno di più risposte o di rimuovere il watermark? Fai l'upgrade in qualsiasi momento. Gli abbonamenti annuali risparmiano il 25%.
                    </p>

                    <ul className="space-y-4 flex-grow">
                        <li className="flex items-start gap-3 text-sm">
                            <Icons.Check size={18} className="text-amber-500 shrink-0" />
                            <span>Analytics Avanzate</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                            <Icons.Check size={18} className="text-amber-500 shrink-0" />
                            <span>Export Dati & Webhooks</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                            <Icons.Check size={18} className="text-amber-500 shrink-0" />
                            <span>Branding Personalizzato</span>
                        </li>
                    </ul>

                    <div className="mt-8">
                        <Icons.Logo size={40} className="opacity-20" />
                    </div>
                </div>
            </div>

            {/* Usage Dashboard */}
            <div className="mt-8">
                <UsageDashboard />
            </div>
        </div>
    );
}

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, formatMonthlyCredits } from '@/config/plans';
import { CREDIT_PACKS, formatCredits } from '@/config/creditPacks';
import { Icons } from '@/components/ui/business-tuner/Icons';
import BillingClient from './billing-client';
import { UsageDashboard } from '@/components/dashboard/UsageDashboard';
import Link from 'next/link';
import { cookies } from 'next/headers';

export default async function BillingPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    // Get user and their memberships to identify the active organization
    const userWithOrgs = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
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

    if (!userWithOrgs) return <div>Utente non trovato.</div>;

    // Determine active organization
    const activeMembership = activeOrgId
        ? userWithOrgs.memberships.find(m => m.organizationId === activeOrgId) || userWithOrgs.memberships[0]
        : userWithOrgs.memberships[0];

    if (!activeMembership) return <div>Nessuna organizzazione trovata. Selezionane una nella sidebar.</div>;

    const organization = activeMembership.organization;
    const subscription = organization.subscription;

    const currentPlan = (organization.plan as PlanType) || PlanType.FREE;
    const planConfig = PLANS[currentPlan] || PLANS[PlanType.FREE];

    // Source of truth: organization's configured monthlyCreditsLimit
    // (can be customized by admins from the default plan value).
    const monthlyLimit = Number(organization.monthlyCreditsLimit);
    const monthlyUsed = Number(organization.monthlyCreditsUsed);
    const packAvailable = Number(organization.packCreditsAvailable);
    const isUnlimited = monthlyLimit === -1;
    const creditsResetDate = organization.creditsResetDate;

    return (
        <div className="pb-10">
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-stone-900 mb-2">Abbonamento</h1>
                <p className="text-stone-600">
                    Gestisci il tuo piano, i crediti e la fatturazione.
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

                    {/* Credits Summary */}
                    <div className="bg-gradient-to-br from-amber-50 to-stone-50 rounded-2xl p-6 mb-8 border border-amber-100/50">
                        <div className="flex items-center gap-2 mb-4">
                            <Icons.Sparkles size={20} className="text-amber-500" />
                            <h3 className="font-bold text-stone-900">Crediti AI</h3>
                        </div>

                        {isUnlimited ? (
                            <div className="text-center py-4">
                                <p className="text-3xl font-black text-amber-600">Illimitati</p>
                                <p className="text-sm text-stone-500 mt-1">Nessun limite di utilizzo</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-white rounded-xl">
                                    <p className="text-xs text-stone-400 font-bold uppercase mb-1">Limite Mensile</p>
                                    <p className="text-xl font-bold text-stone-900">
                                        {formatMonthlyCredits(monthlyLimit)}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-white rounded-xl">
                                    <p className="text-xs text-stone-400 font-bold uppercase mb-1">Utilizzati</p>
                                    <p className="text-xl font-bold text-stone-900">
                                        {formatMonthlyCredits(monthlyUsed)}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-white rounded-xl">
                                    <p className="text-xs text-stone-400 font-bold uppercase mb-1">Pack Extra</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {packAvailable > 0 ? formatMonthlyCredits(packAvailable) : '-'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {creditsResetDate && !isUnlimited && (
                            <p className="text-xs text-stone-500 text-center mt-4">
                                Reset: {new Date(creditsResetDate).toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'long'
                                })}
                            </p>
                        )}
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                        <FeatureItem
                            label="Interview AI"
                            value={planConfig.features.interviewAI === 'full' ? 'Completo' : 'Base'}
                            available={true}
                        />
                        <FeatureItem
                            label="Chatbot"
                            value={planConfig.features.chatbot ? 'Attivo' : 'Non incluso'}
                            available={planConfig.features.chatbot}
                        />
                        <FeatureItem
                            label="Brand Monitor"
                            value={planConfig.features.visibilityTracker ? 'Attivo' : 'Non incluso'}
                            available={planConfig.features.visibilityTracker}
                        />
                        <FeatureItem
                            label="AI Tips"
                            value={planConfig.features.aiTips ? 'Attivo' : 'Non incluso'}
                            available={planConfig.features.aiTips}
                        />
                        <FeatureItem
                            label="Copilot"
                            value={planConfig.features.copilotStrategico ? 'Attivo' : 'Non incluso'}
                            available={planConfig.features.copilotStrategico}
                        />
                        <FeatureItem
                            label="White Label"
                            value={planConfig.features.whiteLabel === true ? 'Attivo' : planConfig.features.whiteLabel === 'conditional' ? 'Condizionale' : 'Non incluso'}
                            available={planConfig.features.whiteLabel !== false}
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-100">
                        <BillingClient />
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Upgrade Card */}
                    <div className="bg-stone-900 text-white rounded-[24px] p-8 flex flex-col">
                        <h3 className="text-xl font-bold mb-4">Passa al piano superiore</h3>
                        <p className="text-stone-400 text-sm mb-8 leading-relaxed">
                            Hai bisogno di più crediti o di funzionalità avanzate? Fai l&apos;upgrade in qualsiasi momento.
                        </p>

                        <ul className="space-y-4 flex-grow">
                            <li className="flex items-start gap-3 text-sm">
                                <Icons.Check size={18} className="text-amber-500 shrink-0" />
                                <span>Più crediti mensili</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <Icons.Check size={18} className="text-amber-500 shrink-0" />
                                <span>Tutte le funzionalità AI</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm">
                                <Icons.Check size={18} className="text-amber-500 shrink-0" />
                                <span>Export senza watermark</span>
                            </li>
                        </ul>

                        <Link href="/dashboard/billing/plans" className="mt-8">
                            <button className="w-full bg-amber-500 text-white font-bold py-4 rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2">
                                Vedi tutti i piani <Icons.ArrowRight size={18} />
                            </button>
                        </Link>
                    </div>

                    {/* Credit Packs */}
                    <div className="bg-white/80 backdrop-blur-md rounded-[24px] p-6 border border-white/50 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Icons.Sparkles size={20} className="text-amber-500" />
                            <h3 className="font-bold text-stone-900">Pack Crediti</h3>
                        </div>
                        <p className="text-sm text-stone-500 mb-4">
                            Acquista crediti extra che non scadono mai.
                        </p>
                        <div className="space-y-3">
                            {CREDIT_PACKS.map(pack => (
                                <div key={pack.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                                    <div>
                                        <p className="font-bold text-stone-900">{pack.name}</p>
                                        <p className="text-xs text-stone-500">
                                            {formatCredits(pack.credits)} crediti
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-amber-600">€{pack.price}</p>
                                        <p className="text-[10px] text-stone-400">
                                            €{pack.pricePerThousand.toFixed(2)}/1K
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link href="/dashboard/billing?tab=packs" className="block mt-4">
                            <button className="w-full bg-stone-100 text-stone-700 font-bold py-3 rounded-xl hover:bg-stone-200 transition-all text-sm">
                                Acquista pack
                            </button>
                        </Link>
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

function FeatureItem({ label, value, available }: { label: string; value: string; available: boolean }) {
    return (
        <div className={`p-4 rounded-2xl ${available ? 'bg-stone-50' : 'bg-stone-50/50'}`}>
            <p className="text-xs text-stone-400 font-bold uppercase mb-1">{label}</p>
            <p className={`text-lg font-bold ${available ? 'text-stone-900' : 'text-stone-300'}`}>
                {value}
            </p>
        </div>
    );
}

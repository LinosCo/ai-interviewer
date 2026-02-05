'use client';

import React, { useState } from 'react';
import { PLANS, PlanType } from '@/config/plans';
import { ADD_ONS } from '@/config/addons';
import { Check, Zap, ArrowRight, ShieldCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
    const [isYearly, setIsYearly] = useState(true);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const displayPlans = [
        PLANS[PlanType.STARTER],
        PLANS[PlanType.PRO],
        PLANS[PlanType.BUSINESS]
    ];

    const handleSubscribe = async (tier: string) => {
        setIsLoading(tier);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier,
                    billingPeriod: isYearly ? 'yearly' : 'monthly'
                })
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                // Se non loggato, vai alla registrazione
                router.push(`/register?plan=${tier}&billing=${isYearly ? 'yearly' : 'monthly'}`);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setIsLoading(null);
        }
    };

    const handleBuyAddon = async (addOnId: string) => {
        setIsLoading(addOnId);
        try {
            const res = await fetch('/api/stripe/addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addOnId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="bg-white min-h-screen py-24 px-6 md:px-12 selection:bg-amber-100 selection:text-amber-900">
            {/* Header */}
            <div className="max-w-4xl mx-auto text-center mb-20">
                <Badge className="mb-6 bg-amber-50 text-amber-700 border-amber-100 px-4 py-1 font-bold text-xs uppercase tracking-widest">
                    Pricing & Plans
                </Badge>
                <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
                    Investi nella tua <span className="text-amber-700 italic">Market Intelligence</span>
                </h1>
                <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                    Scegli il piano che meglio si adatta alle tue ambizioni. Inizia oggi con 14 giorni di prova gratuita su tutti i piani.
                </p>

                {/* Toggle */}
                <div className="flex items-center justify-center gap-4 mt-10">
                    <span className={`text-sm font-bold ${!isYearly ? 'text-slate-900' : 'text-slate-400'}`}>Mensile</span>
                    <button
                        onClick={() => setIsYearly(!isYearly)}
                        className="w-16 h-8 bg-slate-100 rounded-full p-1 relative transition-colors hover:bg-slate-200"
                    >
                        <div className={`w-6 h-6 bg-white shadow-md rounded-full absolute top-1 transition-all duration-300 ${isYearly ? 'left-9 bg-amber-600 shadow-amber-200' : 'left-1'}`} />
                    </button>
                    <span className={`text-sm font-bold flex items-center gap-2 ${isYearly ? 'text-slate-900' : 'text-slate-400'}`}>
                        Annuale
                        <Badge className="bg-green-50 text-green-700 border-green-100 font-black text-[10px]">-20% RISPARMIO</Badge>
                    </span>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                {displayPlans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`relative rounded-3xl p-8 transition-all duration-500 flex flex-col h-full bg-white border ${plan.popular ? 'border-amber-600 ring-4 ring-amber-50 scale-105 z-10' : 'border-slate-100 hover:border-slate-300'}`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-2">
                                <Star className="w-3 h-3 fill-current" /> Il più scelto
                            </div>
                        )}

                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">{plan.name}</h3>
                            <p className="text-slate-500 font-medium text-sm leading-relaxed">{plan.description}</p>
                        </div>

                        <div className="mb-8">
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-black text-slate-900 tracking-tighter">
                                    €{isYearly ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice}
                                </span>
                                <span className="text-slate-500 font-bold">/mese</span>
                            </div>
                            {isYearly && (
                                <p className="text-xs text-slate-400 mt-1 font-medium italic">Fatturato annualmente (€{plan.yearlyPrice}/anno)</p>
                            )}
                        </div>

                        <div className="space-y-4 mb-10 flex-1">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Cosa include:</p>
                            {plan.featureList.map((feature, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`mt-0.5 p-0.5 rounded-full ${plan.popular ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600">{feature}</span>
                                </div>
                            ))}

                            <div className="pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    {plan.monthlyCredits === -1 ? 'Crediti Illimitati' : `${(plan.monthlyCredits / 1000000).toFixed(0)}M Crediti/mese`}
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => handleSubscribe(plan.id)}
                            disabled={isLoading === plan.id}
                            className={`w-full py-7 rounded-2xl font-black text-lg shadow-xl transition-all duration-300 ${plan.popular ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'}`}
                        >
                            {isLoading === plan.id ? 'Attendi...' : 'Inizia Prova Gratuita'}
                            <ArrowRight className="ml-3 w-5 h-5" />
                        </Button>
                        <p className="text-[10px] text-center mt-4 text-slate-400 font-medium">NESSUN COSTO ADDEBITATO PER 14 GIORNI</p>
                    </div>
                ))}
            </div>

            {/* Add-ons Section */}
            <div id="addons" className="max-w-5xl mx-auto mt-32">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-black text-slate-900 mb-4">Potenzia il tuo piano</h2>
                    <p className="text-slate-500 font-medium">Acquista risorse extra quando ne hai bisogno, senza cambiare abbonamento.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ADD_ONS.filter(a => !a.recurring).slice(0, 6).map((addon) => (
                        <div key={addon.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col h-full hover:border-amber-200 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                                <Badge className="bg-white text-slate-600 border-slate-200 font-bold">{addon.type.replace('_', ' ')}</Badge>
                                <span className="text-lg font-black text-slate-900">€{(addon.price / 100).toFixed(2)}</span>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-1">{addon.name}</h3>
                            <p className="text-xs text-slate-500 font-medium mb-6 flex-1">{addon.description}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBuyAddon(addon.id)}
                                disabled={isLoading === addon.id}
                                className="w-full rounded-xl border-slate-200 font-bold bg-white"
                            >
                                {isLoading === addon.id ? 'Loading...' : 'Acquista Ora'}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Social Proof / Trust */}
            <div className="max-w-2xl mx-auto mt-32 text-center">
                <div className="flex items-center justify-center gap-1 mb-6">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-2xl font-medium text-slate-700 italic leading-relaxed">
                    &quot;Voler.ai ha rivoluzionato il modo in cui monitoriamo il nostro brand. I piano Pro è perfetto per un team che vuole dati concreti ogni giorno.&quot;
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div className="text-left">
                        <p className="font-bold text-slate-900 text-sm">Martina Rossi</p>
                        <p className="text-slate-500 text-xs">Head of Marketing @ TechFlow</p>
                    </div>
                </div>
            </div>

            {/* Final Safety */}
            <div className="max-w-4xl mx-auto mt-24 p-8 bg-slate-900 rounded-3xl text-center text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldCheck className="w-32 h-32" />
                </div>
                <h3 className="text-2xl font-bold mb-4 relative z-10">Pronto a sbloccare l&apos;AI per il tuo Business?</h3>
                <p className="text-slate-400 mb-8 relative z-10">Unisciti a oltre 500 aziende che usano Voler.ai per crescere.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                    <Link href="/register" className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 py-6 px-10 rounded-2xl font-black shadow-xl shadow-amber-500/20 text-white transition-colors">
                        Crea Account Gratis
                    </Link>
                    <Link href="/sales" className="inline-flex items-center justify-center text-white hover:bg-white/10 py-6 px-10 rounded-2xl font-bold transition-colors">
                        Parla con un Esperto
                    </Link>
                </div>
            </div>
        </div>
    );
}

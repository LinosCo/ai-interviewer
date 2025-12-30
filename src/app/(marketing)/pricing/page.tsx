'use client';

import React, { useState } from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { colors, gradients } from '@/lib/design-system';
import Link from 'next/link';
import { PRICING_PAGE } from '@/config/pricing';

export default function PricingPage() {
    const [isYearly, setIsYearly] = useState(false);

    return (
        <div className="bg-[#FAFAF8] min-h-screen font-sans text-stone-900 pb-20">
            {/* Hero Section */}
            <section className="pt-32 pb-16 px-6 relative overflow-hidden bg-stone-900">
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-600/20 blur-[100px]" />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <span className="inline-block text-xs font-semibold text-amber-400 tracking-widest uppercase bg-amber-900/40 border border-amber-800 px-3 py-1 rounded-full mb-6 relative">
                        <div className="absolute inset-0 bg-amber-500/20 blur-md rounded-full"></div>
                        <span className="relative">Pricing</span>
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight leading-tight">
                        {PRICING_PAGE.headline}
                    </h1>
                    <p className="text-xl text-stone-400 mb-10 max-w-xl mx-auto leading-relaxed">
                        {PRICING_PAGE.subheadline}
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-stone-500'}`}>Mensile</span>
                        <div
                            className="w-16 h-8 bg-stone-800 rounded-full p-1 cursor-pointer transition-colors hover:bg-stone-700 relative"
                            onClick={() => setIsYearly(!isYearly)}
                        >
                            <div className={`w-6 h-6 bg-amber-500 rounded-full shadow-md transform transition-transform duration-300 ${isYearly ? 'translate-x-8' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-sm font-medium flex items-center gap-2 ${isYearly ? 'text-white' : 'text-stone-500'}`}>
                            Annuale
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-bold">
                                {PRICING_PAGE.yearlyDiscount.badge}
                            </span>
                        </span>
                    </div>
                </div>
            </section>

            {/* Plans Grid */}
            <section className="px-6 -mt-10 relative z-20">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {PRICING_PAGE.plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`
                                relative rounded-2xl p-6 transition-all duration-300 flex flex-col h-full
                                ${plan.highlighted
                                    ? 'bg-white shadow-2xl border-2 border-amber-400 transform md:-translate-y-4 z-10'
                                    : 'bg-white/80 backdrop-blur-md shadow-lg border border-stone-100 hover:shadow-xl hover:bg-white'}
                            `}
                        >
                            {plan.badge && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-amber-600 text-white text-xs font-bold uppercase tracking-wide py-1 px-3 rounded-full shadow-lg">
                                    {plan.badge}
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-stone-900 mb-2">{plan.name}</h3>
                                <p className="text-sm text-stone-500 min-h-[40px]">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-stone-900 tracking-tight">
                                        {plan.price === '€0' ? '€0' : (
                                            isYearly && plan.price !== '€0'
                                                ? `€${Math.round(parseInt(plan.price.replace('€', '')) * (1 - PRICING_PAGE.yearlyDiscount.percentage / 100))}`
                                                : plan.price
                                        )}
                                    </span>
                                    {plan.price !== '€0' && <span className="text-stone-500 font-medium">/mese</span>}
                                </div>
                                {isYearly && plan.price !== '€0' && (
                                    <div className="text-xs text-stone-400 mt-1 line-through">{plan.price}/mese</div>
                                )}
                            </div>

                            <div className="mb-8 flex-1">
                                <ul className="space-y-3">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-stone-700">
                                            <Icons.Check size={18} className={`mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-amber-600' : 'text-stone-400'}`} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Link href={plan.cta === 'Contattaci' ? '/sales' : `/register?plan=${plan.id.toUpperCase()}&yearly=${isYearly}`}>
                                <Button
                                    fullWidth
                                    variant={plan.highlighted ? 'primary' : 'outline'}
                                    size="lg"
                                >
                                    {plan.cta}
                                </Button>
                            </Link>

                            {plan.id === 'trial' && (
                                <p className="text-xs text-stone-400 text-center mt-4">Nessuna carta richiesta</p>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Add-ons Configuration */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-stone-900 mb-2">Hai bisogno di più?</h2>
                        <p className="text-stone-600">Aggiungi risorse al tuo piano quando serve.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {PRICING_PAGE.addons.map((addon, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-stone-200 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-stone-900">{addon.name}</h3>
                                    <p className="text-sm text-stone-500">{addon.description}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-stone-900">{addon.price}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 px-6 bg-white border-t border-stone-100">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12 text-stone-900">Domande Frequenti</h2>
                    <div className="space-y-8">
                        {PRICING_PAGE.faq.map((item, i) => (
                            <div key={i} className="border-b border-stone-100 pb-8 last:border-0 last:pb-0">
                                <h3 className="text-lg font-bold text-stone-900 mb-3">{item.q}</h3>
                                <p className="text-stone-600 leading-relaxed">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6 bg-stone-50 text-center border-t border-stone-200">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-stone-900 mb-6">Non sei sicuro?</h2>
                    <p className="text-stone-600 text-lg mb-10">Confronta tutte le feature nel dettaglio o contattaci per una demo guidata.</p>
                    <div className="flex justify-center gap-4">
                        <Link href="/features">
                            <Button variant="outline" size="lg">Veid Feature Matrix</Button>
                        </Link>
                        <Link href="/sales">
                            <Button variant="ghost" size="lg">Contatta il Sales Team</Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

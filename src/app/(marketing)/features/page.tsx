'use client';

import React from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { colors, gradients } from '@/lib/design-system';
import Link from 'next/link';
import { FEATURE_MATRIX } from '@/config/featureMatrix';

export default function FeaturesPage() {
    return (
        <div className="bg-[#FAFAF8] min-h-screen font-sans text-stone-900">
            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative overflow-hidden">
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <span className="inline-block text-xs font-semibold text-amber-600 tracking-widest uppercase bg-amber-50 px-3 py-1 rounded-full mb-6 border border-amber-100">
                        Platform Tour
                    </span>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-stone-900 tracking-tight leading-tight">
                        Tutto ciò che serve per <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">
                            capire i tuoi clienti.
                        </span>
                    </h1>
                    <p className="text-xl text-stone-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Dalla creazione dell&apos;intervista all&apos;analisi dei trend. Business Tuner è la suite completa per la ricerca qualitativa AI.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link href="/register">
                            <Button size="lg" withShimmer>
                                Inizia la prova gratuita
                            </Button>
                        </Link>
                        <Link href="#compare">
                            <Button variant="outline" size="lg">
                                Confronta i piani
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Feature Deep Dive 1: AI Generation */}
            <section className="py-24 px-6 border-t border-stone-200/60 bg-white">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6 text-amber-600">
                            <Icons.Sparkles size={24} />
                        </div>
                        <h2 className="text-3xl font-bold mb-4 text-stone-900">Interviste pronte in 2 minuti</h2>
                        <p className="text-lg text-stone-600 mb-6 leading-relaxed">
                            Dimentica le ore passate a scrivere domande. Descrivi il tuo obiettivo e l&apos;AI genera un flusso di intervista professionale, ottimizzato per ottenere risposte profonde e oneste.
                        </p>
                        <ul className="space-y-3 mb-8">
                            {['Template validati da esperti', 'Adattamento automatico del tono', 'Ottimizzazione conversazionale'].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-stone-700">
                                    <Icons.Check size={20} className="text-amber-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-stone-100 bg-stone-50 aspect-video flex items-center justify-center">
                        {/* Placeholder for Screenshot */}
                        <div className="text-stone-400 flex flex-col items-center">
                            <Icons.Logo size={48} className="mb-4 opacity-50" />
                            <span className="text-sm font-medium">Screenshot: AI Generation Wizard</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Deep Dive 2: Analysis */}
            <section className="py-24 px-6 bg-[#FAFAF8]">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center md:flex-row-reverse">
                    <div className="order-2 md:order-1 relative rounded-2xl overflow-hidden shadow-2xl border border-stone-100 bg-stone-50 aspect-video flex items-center justify-center">
                        {/* Placeholder for Screenshot */}
                        <div className="text-stone-400 flex flex-col items-center">
                            <Icons.Dashboard size={48} className="mb-4 opacity-50" />
                            <span className="text-sm font-medium">Screenshot: Analytics Dashboard</span>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6 text-orange-600">
                            <Icons.Dashboard size={24} />
                        </div>
                        <h2 className="text-3xl font-bold mb-4 text-stone-900">Analisi qualitativa su scala</h2>
                        <p className="text-lg text-stone-600 mb-6 leading-relaxed">
                            Non leggere mille risposte una per una. La nostra AI estrae temi ricorrenti, sentiment e citazioni chiave automaticamente. Prendi decisioni basate sui dati, non sulle sensazioni.
                        </p>
                        <ul className="space-y-3 mb-8">
                            {['Analisi del sentiment automatica', 'Raggruppamento temi e topic', 'Citazioni chiave evidenziate'].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-stone-700">
                                    <Icons.Check size={20} className="text-green-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Detailed Comparison Table */}
            <section id="compare" className="py-24 px-6 bg-white border-t border-stone-200">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4 text-stone-900">Confronto completo funzionalitÃ </h2>
                        <p className="text-stone-600">Dettagli per ogni piano, senza sorprese.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-stone-100">
                                    <th className="py-4 px-6 w-1/3 text-stone-500 font-medium">FunzionalitÃ </th>
                                    <th className="py-4 px-6 text-center text-stone-900 font-bold bg-stone-50/50">Trial</th>
                                    <th className="py-4 px-6 text-center text-stone-900 font-bold">Starter</th>
                                    <th className="py-4 px-6 text-center text-amber-600 font-bold bg-amber-50/30 border-t-4 border-t-amber-500/0 md:border-t-amber-500 rounded-t-xl">Pro</th>
                                    <th className="py-4 px-6 text-center text-stone-900 font-bold">Business</th>
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURE_MATRIX.categories.map((category, catIdx) => (
                                    <React.Fragment key={catIdx}>
                                        <tr className="bg-stone-50/80">
                                            <td colSpan={5} className="py-3 px-6 font-semibold text-stone-800 text-sm uppercase tracking-wider">{category.name}</td>
                                        </tr>
                                        {category.features.map((feature: { label: string; new?: boolean; trial?: boolean; starter?: boolean; pro?: boolean; business?: boolean }, featIdx: number) => (
                                            <tr key={featIdx} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                                                <td className="py-4 px-6 text-stone-600 font-medium text-sm flex items-center gap-2">
                                                    {feature.label}
                                                    {feature.new && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                                </td>
                                                <td className="py-4 px-6 text-center text-stone-400 bg-stone-50/30">
                                                    {feature.trial ? <Icons.Check size={20} className="mx-auto text-stone-800" /> : <span className="text-stone-300">-</span>}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {feature.starter ? <Icons.Check size={20} className="mx-auto text-stone-800" /> : <span className="text-stone-300">-</span>}
                                                </td>
                                                <td className="py-4 px-6 text-center bg-amber-50/20">
                                                    {feature.pro ? <Icons.Check size={20} className="mx-auto text-amber-600" /> : <span className="text-stone-300">-</span>}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {feature.business ? <Icons.Check size={20} className="mx-auto text-stone-800" /> : <span className="text-stone-300">-</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-6 bg-stone-900 text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Pronto a trasformare il tuo feedback?</h2>
                    <p className="text-stone-400 text-lg mb-10">Inizia con il piano Trial gratuito. Nessuna carta di credito richiesta.</p>
                    <Link href="/register">
                        <Button size="lg" variant="primary" className="shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]">
                            Crea Account Gratuito <Icons.ArrowRight className="ml-2" />
                        </Button>
                    </Link>
                </div>
            </section>
        </div>
    );
}

'use client';

import React from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default function MethodologyPage() {
    return (
        <div className="bg-white min-h-screen pt-32 pb-20">
            <div className="container mx-auto px-6 max-w-4xl">
                <header className="mb-16">
                    <h1 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-6 tracking-tight">Metodologia Business Tuner</h1>
                    <p className="text-xl text-stone-600 leading-relaxed font-medium">
                        Cos'è e come funziona il "feedback conversazionale" a scala.
                    </p>
                </header>

                <div className="prose prose-stone prose-lg max-w-none">
                    <section className="mb-16">
                        <h2 className="text-3xl font-bold text-stone-900 mb-6">Cos'è il "feedback conversazionale"</h2>
                        <p>
                            Il feedback conversazionale è un approccio ibrido che combina la flessibilità delle domande aperte con l'adattività di un intervistatore umano e la scalabilità della tecnologia.
                        </p>
                        <div className="grid md:grid-cols-3 gap-6 mt-8">
                            {[
                                { title: 'Flessibilità', desc: 'Domande aperte che permettono sfumature.' },
                                { title: 'Adattività', desc: 'L\'AI approfondisce in base alle risposte.' },
                                { title: 'Scalabilità', desc: 'Parla con centinaia di persone contemporaneamente.' }
                            ].map((item, i) => (
                                <div key={i} className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                                    <h4 className="font-bold text-amber-900 mb-2">{item.title}</h4>
                                    <p className="text-sm text-amber-800/80">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mb-16">
                        <h2 className="text-3xl font-bold text-stone-900 mb-6">Come funziona</h2>
                        <ol className="space-y-8 list-none p-0">
                            {[
                                { title: 'Definisci l\'obiettivo', desc: 'Cosa vuoi capire? Perché i clienti non rinnovano? Come hanno vissuto l\'onboarding? Tu metti l\'obiettivo, l\'AI fa il resto.' },
                                { title: 'L\'AI struttura l\'intervista', desc: 'Basandosi sul tuo obiettivo, Business Tuner genera un flusso di conversazione con domande aperte e sotto-obiettivi mirati.' },
                                { title: 'La conversazione si adatta', desc: 'Durante l\'intervista, l\'AI decide quando approfondire e quando cambiare argomento, adattandosi al tono di chi risponde.' },
                                { title: 'Analisi automatica', desc: 'Le risposte vengono analizzate istantaneamente per estrarre temi, sentiment e citazioni rilevanti.' }
                            ].map((step, i) => (
                                <li key={i} className="flex gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center flex-shrink-0 font-bold text-xl">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-stone-900 mb-2">{step.title}</h4>
                                        <p className="text-stone-600">{step.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <section className="mb-16 grid md:grid-cols-2 gap-12">
                        <div className="p-8 bg-green-50 rounded-[2rem] border border-green-100">
                            <h3 className="text-2xl font-bold text-green-900 mb-6 flex items-center gap-2">
                                <Icons.Check size={24} /> Quando usarlo
                            </h3>
                            <ul className="space-y-4 text-green-800">
                                <li>Capire motivazioni e percezioni profonde</li>
                                <li>Campioni di decine o centinaia di persone</li>
                                <li>Budget o tempo limitati per interviste manuali</li>
                                <li>Necessità di insight qualitativi rapidi</li>
                            </ul>
                        </div>
                        <div className="p-8 bg-red-50 rounded-[2rem] border border-red-100">
                            <h3 className="text-2xl font-bold text-red-900 mb-6 flex items-center gap-2">
                                <Icons.X size={24} /> Quando NON usarlo
                            </h3>
                            <ul className="space-y-4 text-red-800">
                                <li>Ricerche statisticamente significative</li>
                                <li>Temi di estrema sensibilità (es. traumi)</li>
                                <li>Osservazione di comportamenti non verbali</li>
                                <li>Pubblico non a suo agio con la tecnologia</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-16">
                        <h2 className="text-3xl font-bold text-stone-900 mb-6">Best Practices</h2>
                        <div className="bg-stone-50 rounded-3xl p-8 border border-stone-200">
                            <ul className="space-y-6 list-none p-0">
                                <li className="flex gap-4">
                                    <div className="text-amber-500 mt-1"><Icons.Star size={20} fill="currentColor" /></div>
                                    <p className="text-stone-700"><strong>Sii trasparente:</strong> Spiega perché stai raccogliendo feedback. La fiducia aumenta la qualità delle risposte.</p>
                                </li>
                                <li className="flex gap-4">
                                    <div className="text-amber-500 mt-1"><Icons.Star size={20} fill="currentColor" /></div>
                                    <p className="text-stone-700"><strong>Durata ideale:</strong> Punta a 5-10 minuti. Oltre questa soglia, la qualità dell'attenzione cala drasticamente.</p>
                                </li>
                                <li className="flex gap-4">
                                    <div className="text-amber-500 mt-1"><Icons.Star size={20} fill="currentColor" /></div>
                                    <p className="text-stone-700"><strong>Incentiva se necessario:</strong> Un piccolo reward può aumentare drasticamente il tasso di completamento.</p>
                                </li>
                                <li className="flex gap-4">
                                    <div className="text-amber-500 mt-1"><Icons.Star size={20} fill="currentColor" /></div>
                                    <p className="text-stone-700"><strong>Itera:</strong> Testa l'intervista tu stesso, ascolta le prime risposte e aggiusta il tiro.</p>
                                </li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

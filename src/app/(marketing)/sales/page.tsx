'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { submitLeadAction } from '@/app/actions/leads';

export default function SalesPage() {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus('submitting');

        const formData = new FormData(e.currentTarget);
        try {
            const result = await submitLeadAction(formData);
            if (result.success) {
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Submission error:', error);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
                <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-stone-100 text-center">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 transform scale-110">
                        <Icons.Check size={40} />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900 mb-4">Richiesta Ricevuta!</h1>
                    <p className="text-stone-600 mb-8 leading-relaxed">
                        Grazie per l&apos;interesse. Il nostro sales team analizzerà la tua richiesta e ti contatterà entro le prossime 24 ore lavorative.
                    </p>
                    <Button fullWidth onClick={() => window.location.href = '/'}>
                        Torna alla Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAF8] pt-32 pb-20 px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

                {/* Info Text */}
                <div className="space-y-8">
                    <div>
                        <span className="inline-block text-xs font-semibold text-amber-600 tracking-widest uppercase bg-amber-50 border border-amber-100 px-3 py-1 rounded-full mb-6 relative">
                            Business Plan
                        </span>
                        <h1 className="text-4xl md:text-5xl font-bold text-stone-900 leading-tight mb-6">
                            Scaliamo insieme le tue interviste AI.
                        </h1>
                        <p className="text-xl text-stone-600 leading-relaxed max-w-lg">
                            Il piano Business è pensato per aziende che hanno bisogno di volumi elevati, integrazioni custom e supporto dedicato.
                        </p>
                    </div>

                    <div className="space-y-6 pt-10">
                        {[
                            { title: 'Volumi Illimitati', desc: 'Gestisci migliaia di interviste mensili senza preoccuparti dei limiti.' },
                            { title: 'White Label Complato', desc: 'Rimuovi ogni riferimento a Business Tuner e usa il tuo dominio.' },
                            { title: 'Supporto Dedicato', desc: 'Un account manager dedicato per ottimizzare i tuoi prompt e workflow.' },
                            { title: 'Security & Compliance', desc: 'SSO (SAML), contratti personalizzati e audit di sicurezza.' },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="mt-1 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-xs italic">
                                    +
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900">{item.title}</h3>
                                    <p className="text-sm text-stone-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-8 border-t border-stone-200">
                        <cite className="text-stone-500 italic block mb-4 text-sm">
                            &quot;L&apos;integrazione del piano Business ci ha permesso di automatizzare completamente la raccolta feedback in 12 lingue diverse con un tasso di completamento dell&apos;85%.&quot;
                        </cite>
                        <p className="font-bold text-stone-900 text-sm">— Responsabile CX, Tech Corporate</p>
                    </div>
                </div>

                {/* Form Card */}
                <div id="contact-form" className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-stone-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>

                    <h2 className="text-2xl font-bold text-stone-900 mb-8 relative">Inviaci una richiesta</h2>

                    <form onSubmit={handleSubmit} className="space-y-5 relative">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Nome</label>
                                <input
                                    required
                                    name="name"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    placeholder="Es. Mario"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Cognome</label>
                                <input
                                    required
                                    name="surname"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    placeholder="Es. Rossi"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Email Aziendale</label>
                            <input
                                required
                                name="email"
                                type="email"
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                placeholder="mario.rossi@azienda.it"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Nome Azienda</label>
                            <input
                                required
                                name="company"
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                placeholder="S.p.A, S.r.l..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Esigenze</label>
                            <textarea
                                required
                                name="needs"
                                rows={4}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                                placeholder="Dicci di cosa hai bisogno..."
                            ></textarea>
                        </div>

                        <div className="pt-4">
                            <Button
                                type="submit"
                                fullWidth
                                size="lg"
                                className="shadow-lg shadow-stone-200"
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? 'Invio in corso...' : 'Invia Richiesta'}
                            </Button>
                        </div>

                        <p className="text-[10px] text-stone-400 text-center leading-tight">
                            Cliccando su &quot;Invia Richiesta&quot; accetti che i tuoi dati vengano trattati per scopi commerciali in conformità con la nostra Privacy Policy.
                        </p>
                    </form>
                </div>

            </div>
        </div>
    );
}

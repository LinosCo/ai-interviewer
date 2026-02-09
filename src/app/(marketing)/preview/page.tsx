'use client';

import { useState } from 'react';
import SimulatorChat from '@/components/simulator/simulator-chat';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/Footer';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Default configuration for the public demo
const DEFAULT_DEMO_CONFIG = {
    name: "Intervista Demo",
    researchGoal: "Scoprire come le aziende italiane usano l'AI",
    targetAudience: "Imprenditori e Manager",
    language: "it",
    tone: "Professional/Empathetic",
    topics: [
        {
            label: "Introduzione",
            description: "Capire il ruolo dell'intervistato e della sua azienda.",
            subGoals: ["Settore", "Dimensione azienda", "Ruolo"],
            maxTurns: 3
        },
        {
            label: "Uso attuale di AI",
            description: "Approfondire gli strumenti AI già in uso.",
            subGoals: ["ChatGPT", "Automazioni", "Analisi dati"],
            maxTurns: 5
        },
        {
            label: "Sfide e Barriere",
            description: "Identificare cosa blocca l'adozione dell'AI.",
            subGoals: ["Costi", "Competenze", "Privacy"],
            maxTurns: 4
        }
    ]
};

export default function PublicPreviewPage() {
    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <LandingHeader session={null} />

            <main className="pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-4">
                            <Sparkles className="w-4 h-4" />
                            Versione Demo
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                            Testa la potenza di <span className="gradient-text">Business Tuner</span>
                        </h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Questa è una simulazione di come i tuoi stakeholder vivranno l'intervista.
                            Nessun dato verrà salvato in questa sessione demo.
                        </p>
                    </motion.div>

                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 min-h-[600px] flex flex-col">
                        <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200">
                                    BT
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">Assistente Business Tuner</p>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600">Live Simulation</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-0 flex flex-col">
                            <SimulatorChat
                                config={DEFAULT_DEMO_CONFIG as any}
                                onClose={() => { }}
                            />
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-12 text-center"
                    >
                        <Link
                            href="/register"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all hover:scale-105 shadow-xl"
                        >
                            Inizia a creare le tue interviste
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </motion.div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

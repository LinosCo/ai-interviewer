'use client';

import { useState, useEffect } from 'react';
import SimulatorChat from '@/components/simulator/simulator-chat';
import InterviewChat from '@/components/interview-chat';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/Footer';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { colors } from '@/lib/design-system';
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
    const [config, setConfig] = useState<any>(DEFAULT_DEMO_CONFIG);
    const [botId, setBotId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [conversation, setConversation] = useState<any>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/public/demo-config');
                if (res.ok) {
                    const data = await res.json();
                    if (!data.useDefault && data.config) {
                        setConfig(data.config);
                        setBotId(data.botId);
                    }
                }
            } catch (error) {
                console.error('Error fetching demo config:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleStartDemo = async () => {
        if (!botId) return; // Fallback to simulator if no botId (static default)

        setIsInitializing(true);
        try {
            const res = await fetch('/api/public/demo-config', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setConversation(data);
            }
        } catch (error) {
            console.error('Error starting demo session:', error);
        } finally {
            setIsInitializing(false);
        }
    };

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
                            {botId ? "I dati verranno salvati come lead nel sistema." : "Nessun dato verrà salvato in questa sessione demo."}
                        </p>
                    </motion.div>

                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 min-h-[650px] flex flex-col relative transition-all hover:shadow-amber-100/20">
                        <div className="flex-1 p-0 flex flex-col">
                            {isLoading || isInitializing ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4">
                                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
                                        {isInitializing ? "Inizializzazione Sessione..." : "Caricamento Demo..."}
                                    </p>
                                </div>
                            ) : conversation ? (
                                <InterviewChat
                                    conversationId={conversation.id}
                                    botId={conversation.botId}
                                    botName={conversation.bot.name}
                                    botDescription={conversation.bot.description || undefined}
                                    estimatedDuration={`~${conversation.bot.maxDurationMins || 10} mins`}
                                    logoUrl={conversation.bot.logoUrl}
                                    primaryColor={conversation.bot.primaryColor || colors.amber}
                                    backgroundColor={conversation.bot.backgroundColor || '#f9fafb'}
                                    language={conversation.bot.language}
                                    introMessage={conversation.bot.introMessage}
                                    topics={conversation.bot.topics}
                                    currentTopicId={conversation.currentTopicId}
                                    skipWelcome={true}
                                    isEmbedded={true}
                                />
                            ) : botId ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                                        <Play className="w-10 h-10 text-amber-600 ml-1" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Pronto per iniziare?</h2>
                                    <p className="text-gray-600 mb-8 max-w-md">
                                        Clicca sul bottone qui sotto per avviare una sessione reale con il nostro assistente AI configurato per questa demo.
                                    </p>
                                    <button
                                        onClick={handleStartDemo}
                                        className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-bold text-lg hover:bg-amber-700 transition-all hover:scale-105 shadow-xl shadow-amber-600/20"
                                    >
                                        Inizia Intervista Demo
                                    </button>
                                </div>
                            ) : (
                                <SimulatorChat
                                    config={config}
                                    onClose={() => { }}
                                />
                            )}
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

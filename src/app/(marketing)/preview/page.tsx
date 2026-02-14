'use client';

import { useState, useEffect } from 'react';
import InterviewChat from '@/components/interview-chat';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play } from 'lucide-react';
import { colors } from '@/lib/design-system';
import Link from 'next/link';

type DemoConversation = {
    id: string;
    botId: string;
    currentTopicId?: string | null;
    bot: {
        name: string;
        description?: string | null;
        maxDurationMins?: number | null;
        logoUrl?: string | null;
        primaryColor?: string | null;
        backgroundColor?: string | null;
        language?: string | null;
        introMessage?: string | null;
        topics?: any;
    };
};

function isDemoConversation(value: unknown): value is DemoConversation {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    const bot = record.bot as Record<string, unknown> | undefined;
    return (
        typeof record.id === 'string' &&
        typeof record.botId === 'string' &&
        !!bot &&
        typeof bot.name === 'string'
    );
}

export default function PublicPreviewPage() {
    const [botId, setBotId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [conversation, setConversation] = useState<DemoConversation | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch(`/api/public/demo-config?_ts=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (!data.useDefault && data.config) {
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
        if (!botId) return;

        setIsInitializing(true);
        try {
            const res = await fetch('/api/public/demo-config', {
                method: 'POST',
                cache: 'no-store'
            });
            if (res.ok) {
                const data: unknown = await res.json();
                if (isDemoConversation(data)) {
                    setConversation(data);
                } else {
                    console.error('Invalid demo conversation payload', data);
                }
            }
        } catch (error) {
            console.error('Error starting demo session:', error);
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
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
                            Questa è una simulazione di come i tuoi stakeholder vivranno l&apos;intervista.
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
                                    logoUrl={conversation.bot.logoUrl || undefined}
                                    primaryColor={conversation.bot.primaryColor || colors.amber}
                                    backgroundColor={conversation.bot.backgroundColor || '#f9fafb'}
                                    language={conversation.bot.language || undefined}
                                    introMessage={conversation.bot.introMessage || undefined}
                                    topics={conversation.bot.topics}
                                    currentTopicId={conversation.currentTopicId || undefined}
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
                                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Demo non disponibile</h2>
                                    <p className="text-gray-600 max-w-md">
                                        Nessuna intervista pubblicata disponibile per la demo. Seleziona un bot intervista come demo pubblica nelle impostazioni.
                                    </p>
                                </div>
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
        </div>
    );
}

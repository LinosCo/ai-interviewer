'use client';

import { useRef, useState } from 'react';
import { Bot, MessageSquare, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface WizardStepPreviewProps {
    config: any;
    projectId?: string;
    onBack: () => void;
}

export default function WizardStepPreview({ config, projectId, onBack }: WizardStepPreviewProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const publishInFlightRef = useRef(false);

    const handlePublish = async () => {
        if (publishInFlightRef.current) return;
        publishInFlightRef.current = true;
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/bots/create-from-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: config.name,
                    botType: 'chatbot',
                    projectId: projectId,
                    config: {
                        description: config.description,
                        tone: config.tone,
                        primaryColor: config.primaryColor,
                        welcomeMessage: config.welcomeMessage,
                        fallbackMessage: config.fallbackMessage,
                        leadCaptureStrategy: config.leadCaptureStrategy,
                        candidateDataFields: config.candidateDataFields,
                        bubblePosition: config.bubblePosition || 'bottom-right',
                        knowledgeSources: config.knowledgeSources,
                        // Convert specific fields to what API expects or keep them in config
                        ...config
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Creazione fallita');
            }

            const data = await res.json();
            // Redirect to embed page or success page
            router.push(`/dashboard/bots/${data.botId}/embed`);

        } catch (err: any) {
            console.error('Publish error:', err);
            setError(err.message || 'Si è verificato un errore durante la creazione');
        } finally {
            publishInFlightRef.current = false;
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Anteprima e Pubblicazione
                </h2>
                <p className="text-gray-600">
                    Verifica l'aspetto del tuo chatbot prima di pubblicarlo
                </p>
            </div>

            {/* Preview Container */}
            <div className="relative bg-gray-100 rounded-2xl border border-gray-200 h-[500px] overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none"></div>

                <div className="text-center p-8 max-w-md z-0">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Anteprima Live
                    </h3>
                    <p className="text-gray-500 text-sm">
                        Il tuo chatbot è pronto. Clicca sull&apos;icona in basso a destra per provare la conversazione.
                    </p>
                </div>

                {/* Mock Chat Bubble - Ensuring High Z-Index */}
                <div
                    className="absolute bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-105 z-20"
                    style={{ backgroundColor: config.primaryColor || '#2563EB' }}
                >
                    <MessageSquare className="w-7 h-7 text-white" />
                </div>

                {/* Mock Chat Window - Ensuring High Z-Index */}
                <div className="absolute bottom-24 right-8 w-80 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col z-20 origin-bottom-right animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="p-4 text-white" style={{ backgroundColor: config.primaryColor || '#2563EB' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/20">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{config.name || 'AI Assistant'}</div>
                                <div className="text-xs opacity-90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                    Online
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="p-4 bg-gray-50 h-64 space-y-4 overflow-y-auto">
                        <div className="flex gap-2 items-start">
                            <div
                                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs mt-1"
                                style={{ backgroundColor: config.primaryColor || '#2563EB' }}
                            >
                                <Bot className="w-3 h-3" />
                            </div>
                            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-800 border border-gray-100 max-w-[85%]">
                                <p>{config.welcomeMessage || 'Ciao! Come posso aiutarti oggi?'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t bg-white">
                        <div className="bg-gray-100 rounded-full h-10 w-full flex items-center px-4 text-gray-400 text-sm">
                            Scrivi un messaggio...
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={onBack}
                    disabled={loading}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                    ← Indietro
                </button>
                <button
                    onClick={handlePublish}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Pubblicazione in corso...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Pubblica Chatbot
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}

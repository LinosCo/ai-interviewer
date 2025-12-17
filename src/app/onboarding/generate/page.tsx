'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { getTemplateBySlug, Template } from '@/lib/templates';

const loadingMessages = [
    { text: 'Sto analizzando il tuo obiettivo...', icon: '🔍' },
    { text: 'Definisco le domande giuste...', icon: '💡' },
    { text: 'Applico le best practice di ricerca qualitativa...', icon: '📚' },
    { text: 'Ottimizzo il flusso conversazionale...', icon: '✨' },
    { text: 'Preparo la tua intervista...', icon: '🎯' },
];

export default function GeneratePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const goal = searchParams.get('goal');
    const templateSlug = searchParams.get('template');

    useEffect(() => {
        const generateInterview = async () => {
            try {
                // Animate through loading messages
                const interval = setInterval(() => {
                    setCurrentStep((prev) => {
                        if (prev < loadingMessages.length - 1) return prev + 1;
                        return prev;
                    });
                }, 1500);

                let configToUse: any;

                if (templateSlug) {
                    // Use template config
                    const template = getTemplateBySlug(templateSlug);
                    if (!template) {
                        throw new Error('Template non trovato');
                    }
                    configToUse = {
                        ...template.defaultConfig,
                        name: template.name,
                        fromTemplate: template.id,
                    };
                } else if (goal) {
                    // Generate via API
                    const response = await fetch('/api/bots/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ goal }),
                    });

                    if (!response.ok) {
                        throw new Error('Errore nella generazione');
                    }

                    configToUse = await response.json();
                } else {
                    throw new Error('Nessun obiettivo specificato');
                }

                clearInterval(interval);

                // Store config in sessionStorage and navigate to preview
                sessionStorage.setItem('generatedConfig', JSON.stringify(configToUse));
                router.push('/onboarding/preview');

            } catch (err: any) {
                setError(err.message || 'Errore sconosciuto');
            }
        };

        generateInterview();
    }, [goal, templateSlug, router]);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
                <div className="text-center space-y-6">
                    <div className="text-6xl">😕</div>
                    <h2 className="text-2xl font-bold text-white">Qualcosa è andato storto</h2>
                    <p className="text-slate-300">{error}</p>
                    <button
                        onClick={() => router.push('/onboarding')}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                    >
                        Riprova
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-12">
                {/* Animated Loader */}
                <div className="relative">
                    <div className="w-24 h-24 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-purple-400 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                </div>

                {/* Loading Messages */}
                <div className="space-y-4">
                    {loadingMessages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-3 transition-all duration-500 ${index <= currentStep
                                    ? 'opacity-100 translate-y-0'
                                    : 'opacity-0 translate-y-4'
                                }`}
                        >
                            {index < currentStep ? (
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            ) : index === currentStep ? (
                                <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                            ) : (
                                <div className="w-5 h-5 rounded-full border border-slate-600 flex-shrink-0" />
                            )}
                            <span className={`text-left ${index <= currentStep ? 'text-white' : 'text-slate-500'}`}>
                                {msg.icon} {msg.text}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Goal Preview */}
                {goal && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-sm text-slate-400 mb-2">Il tuo obiettivo:</p>
                        <p className="text-white">{goal}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

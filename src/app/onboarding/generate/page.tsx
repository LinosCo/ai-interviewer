'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { getTemplateBySlug } from '@/lib/templates';

const loadingMessages = [
    { text: 'Sto analizzando il tuo obiettivo...', icon: <Icons.Search size={20} /> },
    { text: 'Definisco le domande giuste...', icon: <Icons.BrainCircuit size={20} /> },
    { text: 'Applico le best practice di ricerca qualitativa...', icon: <Icons.BookOpen size={20} /> },
    { text: 'Ottimizzo il flusso conversazionale...', icon: <Icons.Sparkles size={20} /> },
    { text: 'Preparo la tua intervista...', icon: <Icons.Target size={20} /> },
];

function GenerateContent() {
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
            <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
                <div className="text-center space-y-6">
                    <div className="text-6xl text-amber-500">😕</div>
                    <h2 className="text-2xl font-bold text-white">Qualcosa è andato storto</h2>
                    <p className="text-stone-400">{error}</p>
                    <Button
                        onClick={() => router.push('/onboarding')}
                        variant="primary"
                    >
                        Riprova
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-600/10 blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[100px]" />
            </div>

            <div className="max-w-md w-full text-center space-y-12 relative z-10">
                {/* Animated Loader */}
                <div className="relative">
                    <div className="w-24 h-24 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center relative">
                        <div className="absolute inset-0 border-t-2 border-amber-500/30 rounded-full animate-spin"></div>
                        <Icons.Sparkles className="w-10 h-10 text-amber-500 animate-pulse" />
                    </div>
                </div>

                {/* Loading Messages */}
                <div className="space-y-6">
                    {loadingMessages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-4 transition-all duration-500 ${index <= currentStep
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-4'
                                }`}
                        >
                            {index < currentStep ? (
                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                                    <Icons.Check className="w-4 h-4 text-green-500" />
                                </div>
                            ) : index === currentStep ? (
                                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-stone-800 flex-shrink-0" />
                            )}
                            <div className={`text-left flex-1 ${index <= currentStep ? 'text-stone-200' : 'text-stone-600'}`}>
                                <p className="font-medium text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Goal Preview */}
                {goal && (
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-semibold">Il tuo obiettivo</p>
                        <p className="text-white font-medium">{goal}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center">
            <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center animate-pulse">
                <Icons.Sparkles className="w-10 h-10 text-amber-500" />
            </div>
        </div>
    );
}

export default function GeneratePage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <GenerateContent />
        </Suspense>
    );
}

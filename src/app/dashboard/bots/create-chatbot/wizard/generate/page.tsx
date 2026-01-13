'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { colors } from '@/lib/design-system';

const loadingSteps = [
    { text: 'Analizzo la tua richiesta...', icon: <Icons.Search size={20} /> },
    { text: 'Definisco la personalità del chatbot...', icon: <Icons.BrainCircuit size={20} /> },
    { text: 'Ottimizzo la strategia di Lead Generation...', icon: <Icons.Users size={20} /> },
    { text: 'Scrivo i messaggi di benvenuto...', icon: <Icons.Chat size={20} /> },
    { text: 'Configuro l\'assistente...', icon: <Icons.Bot size={20} /> },
];

function GenerateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const goal = searchParams.get('goal');

    useEffect(() => {
        if (!goal) return;

        const generate = async () => {
            try {
                // Animation loop
                const interval = setInterval(() => {
                    setCurrentStep(prev => prev < loadingSteps.length - 1 ? prev + 1 : prev);
                }, 1500);

                const res = await fetch('/api/chatbot/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Errore nella generazione');
                }

                const config = await res.json();

                clearInterval(interval);
                sessionStorage.setItem('generatedChatbotConfig', JSON.stringify({ ...config, goal }));
                router.push('/dashboard/bots/create-chatbot/wizard/preview');

            } catch (err: any) {
                setError(err.message);
            }
        };

        generate();
    }, [goal, router]);


    if (error) {
        return (
            <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Ops, qualcosa non va</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <Button onClick={() => router.push('/dashboard/bots/create-chatbot/wizard')} variant="primary">Riprova</Button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div className="max-w-md w-full text-center relative z-10">
                <div className="mb-12 relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-orange-200 animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-0 rounded-full border-t-4 border-orange-500 animate-[spin_1.5s_linear_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Icons.Bot size={48} className="text-orange-500" />
                    </div>
                </div>

                <div className="space-y-4">
                    {loadingSteps.map((step, i) => (
                        <div key={i}
                            className={`flex items-center gap-3 transition-all duration-500 
                                ${i <= currentStep ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-4'}
                            `}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border
                                ${i < currentStep ? 'bg-green-100 border-green-200 text-green-600' :
                                    i === currentStep ? 'bg-orange-100 border-orange-200 text-orange-600 animate-pulse' :
                                        'bg-gray-50 border-gray-200 text-gray-300'}
                            `}>
                                {i < currentStep ? <Icons.Check size={16} /> : step.icon}
                            </div>
                            <span className={`text-sm font-medium ${i <= currentStep ? 'text-gray-900' : 'text-gray-400'}`}>
                                {step.text}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function GeneratePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <GenerateContent />
        </Suspense>
    );
}

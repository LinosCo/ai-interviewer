'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WizardStepGoal from './wizard/WizardStepGoal';
import WizardStepSettings from './wizard/WizardStepSettings';
import WizardStepPreview from './wizard/WizardStepPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

function CreateInterviewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId');
    const templateId = searchParams.get('template');

    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<any>(null);

    const nextStep = (updatedConfig?: any) => {
        if (updatedConfig) setConfig({ ...config, ...updatedConfig });
        setStep(step + 1);
    };

    const prevStep = () => {
        setStep(step - 1);
    };

    return (
        <div className="min-h-screen bg-orange-50/30 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Crea la tua Intervista AI
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Definisci i tuoi obiettivi e ottieni approfondimenti immediati
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(217,119,6,0.5)]"
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-amber-700/60 font-semibold uppercase tracking-widest">
                        <span className={step >= 1 ? 'text-amber-700' : ''}>Obiettivo</span>
                        <span className={step >= 2 ? 'text-amber-700' : ''}>Configurazione</span>
                        <span className={step >= 3 ? 'text-amber-700' : ''}>Anteprima</span>
                    </div>
                </div>

                {/* Wizard Steps */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 sm:p-10 border border-amber-100/50">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <WizardStepGoal
                                key="step1"
                                templateId={templateId || undefined}
                                onNext={(generatedConfig: any) => {
                                    setConfig(generatedConfig);
                                    setStep(2);
                                }}
                            />
                        )}
                        {step === 2 && config && (
                            <WizardStepSettings
                                key="step2"
                                initialConfig={config}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {step === 3 && config && (
                            <WizardStepPreview
                                key="step3"
                                config={config}
                                projectId={projectId || undefined}
                                onBack={prevStep}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default function CreateInterviewPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-orange-50/30">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        }>
            <CreateInterviewContent />
        </Suspense>
    );
}

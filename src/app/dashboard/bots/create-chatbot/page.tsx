'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardStepPrompt from './wizard/WizardStepPrompt';
import WizardStepConfig from './wizard/WizardStepConfig';
import WizardStepKnowledge from './wizard/WizardStepKnowledge';
import WizardStepBoundaries from './wizard/WizardStepBoundaries';
import WizardStepLeads from './wizard/WizardStepLeads';
import WizardStepPreview from './wizard/WizardStepPreview';
import { motion, AnimatePresence } from 'framer-motion';

export default function CreateChatbotPage() {
    const router = useRouter();
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
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Crea il tuo Assistente AI
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Configura un chatbot intelligente in pochi minuti
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-500 ease-out"
                            style={{ width: `${(step / 6) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium uppercase tracking-wide">
                        <span>Generazione</span>
                        <span>Configurazione</span>
                        <span>Knowledge</span>
                        <span>Limiti</span>
                        <span>Leads</span>
                        <span>Pubblica</span>
                    </div>
                </div>

                {/* Wizard Steps */}
                <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-10 border border-gray-100">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <WizardStepPrompt
                                key="step1"
                                onNext={(generatedConfig) => {
                                    setConfig(generatedConfig);
                                    setStep(2);
                                }}
                            />
                        )}
                        {step === 2 && config && (
                            <WizardStepConfig
                                key="step2"
                                initialConfig={config}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {step === 3 && config && (
                            <WizardStepKnowledge
                                key="step3"
                                initialConfig={config}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {step === 4 && config && (
                            <WizardStepBoundaries
                                key="step4"
                                initialConfig={config}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {step === 5 && config && (
                            <WizardStepLeads
                                key="step5"
                                initialConfig={config}
                                onNext={nextStep}
                                onBack={prevStep}
                            />
                        )}
                        {step === 6 && config && (
                            <WizardStepPreview
                                key="step6"
                                config={config}
                                onBack={prevStep}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

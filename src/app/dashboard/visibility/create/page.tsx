'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { WizardStepBrand } from './wizard/WizardStepBrand';
import { WizardStepPrompts } from './wizard/WizardStepPrompts';
import { WizardStepCompetitors } from './wizard/WizardStepCompetitors';
import { WizardStepReview } from './wizard/WizardStepReview';

export interface VisibilityConfig {
    brandName: string;
    category: string;
    description: string;
    language: string;
    territory: string;
    prompts: Array<{
        id: string;
        text: string;
        enabled: boolean;
    }>;
    competitors: Array<{
        id: string;
        name: string;
    }>;
}

const STEPS = [
    { id: 1, title: 'Brand Info', description: 'Descrivi il tuo brand' },
    { id: 2, title: 'Prompts', description: 'Genera e affina i prompt' },
    { id: 3, title: 'Competitor', description: 'Aggiungi competitor da monitorare' },
    { id: 4, title: 'Review', description: 'Rivedi e salva' }
];

export default function CreateVisibilityWizardPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isEdit, setIsEdit] = useState(false);

    const [config, setConfig] = useState<VisibilityConfig>({
        brandName: '',
        category: '',
        description: '',
        language: 'it',
        territory: 'IT',
        prompts: [],
        competitors: []
    });

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch('/api/visibility/create');
                if (res.ok) {
                    const data = await res.json();
                    if (data.config) {
                        setConfig({
                            brandName: data.config.brandName || '',
                            category: data.config.category || '',
                            description: data.config.description || '',
                            language: data.config.language || 'it',
                            territory: data.config.territory || 'IT',
                            prompts: data.config.prompts?.map((p: any) => ({
                                id: p.id,
                                text: p.text,
                                enabled: p.enabled
                            })) || [],
                            competitors: data.config.competitors?.map((c: any) => ({
                                id: c.id,
                                name: c.name
                            })) || []
                        });
                        setIsEdit(true);
                    }
                }
            } catch (err) {
                console.error("Error loading config:", err);
            }
        };
        loadConfig();
    }, []);

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/visibility/create', {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to save');
            }

            router.push('/dashboard/visibility');
        } catch (error: any) {
            console.error('Save error:', error);
            alert(error.message || 'Errore nel salvataggio. Riprova.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="p-3 bg-purple-600 rounded-xl">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isEdit ? 'Modifica Visibility Tracking' : 'Configura Visibility Tracking'}
                    </h1>
                    <p className="text-gray-600">
                        Monitora come i principali LLM parlano del tuo brand
                    </p>
                </div>

                {/* Progress Stepper */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, index) => (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${currentStep > step.id
                                        ? 'bg-purple-600 border-purple-600'
                                        : currentStep === step.id
                                            ? 'border-purple-600 bg-white text-purple-600'
                                            : 'border-gray-300 bg-white text-gray-400'
                                        }`}>
                                        {currentStep > step.id ? (
                                            <Check className="w-5 h-5 text-white" />
                                        ) : (
                                            <span className="font-semibold">{step.id}</span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <div className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {step.title}
                                        </div>
                                        <div className="text-xs text-gray-500 hidden md:block">
                                            {step.description}
                                        </div>
                                    </div>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`h-0.5 flex-1 mx-4 ${currentStep > step.id ? 'bg-purple-600' : 'bg-gray-300'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
                    {currentStep === 1 && (
                        <WizardStepBrand config={config} setConfig={setConfig} />
                    )}
                    {currentStep === 2 && (
                        <WizardStepPrompts config={config} setConfig={setConfig} />
                    )}
                    {currentStep === 3 && (
                        <WizardStepCompetitors config={config} setConfig={setConfig} />
                    )}
                    {currentStep === 4 && (
                        <WizardStepReview config={config} />
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePrevious}
                        disabled={currentStep === 1}
                        className="flex items-center gap-2 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Indietro
                    </button>

                    {currentStep < STEPS.length ? (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Avanti
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Salvataggio...' : (isEdit ? 'Salva Modifiche' : 'Salva e Avvia')}
                            <Check className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

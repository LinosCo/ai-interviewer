'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { WizardStepBrand } from './wizard/WizardStepBrand';
import { WizardStepPrompts } from './wizard/WizardStepPrompts';
import { WizardStepCompetitors } from './wizard/WizardStepCompetitors';
import { WizardStepReview } from './wizard/WizardStepReview';

export interface AdditionalUrl {
    url: string;
    label: string;
}

export interface VisibilityConfig {
    brandName: string;
    category: string;
    description: string;
    websiteUrl?: string;
    additionalUrls?: AdditionalUrl[];
    language: string;
    territory: string;
    projectId?: string;
    prompts: Array<{
        id: string;
        text: string;
        enabled: boolean;
        aiOverviewEnabled?: boolean;
        aiOverviewVariant?: string | null;
        aiOverviewLastFound?: Date | null;
        referenceUrl?: string;
    }>;
    competitors: Array<{
        id: string;
        name: string;
    }>;
}

interface VisibilityConfigApiResponse {
    config?: {
        brandName?: string;
        category?: string;
        description?: string;
        websiteUrl?: string | null;
        additionalUrls?: AdditionalUrl[] | null;
        language?: string;
        territory?: string;
        projectId?: string | null;
        prompts?: Array<{
            id: string;
            text: string;
            enabled: boolean;
            aiOverviewEnabled?: boolean | null;
            aiOverviewVariant?: string | null;
            aiOverviewLastFound?: Date | string | null;
            referenceUrl?: string | null;
        }>;
        competitors?: Array<{
            id: string;
            name: string;
        }>;
    };
}

interface UserSettingsResponse {
    memberships?: Array<{
        organization?: {
            projects?: Array<{ id: string; name: string }>;
            subscription?: { tier?: string | null };
        } | null;
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
    const searchParams = useSearchParams();
    const projectIdParam = searchParams.get('projectId');
    const configIdParam = searchParams.get('configId') || searchParams.get('id');

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [configId, setConfigId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [config, setConfig] = useState<VisibilityConfig>({
        brandName: '',
        category: '',
        description: '',
        websiteUrl: undefined,
        additionalUrls: [],
        language: 'it',
        territory: 'IT',
        projectId: projectIdParam || undefined,
        prompts: [],
        competitors: []
    });

    const [projects, setProjects] = useState<Array<{ id: string, name: string }>>([]);
    const [limits, setLimits] = useState({ maxCompetitors: 0, maxPrompts: 0 });

    useEffect(() => {
        const loadConfig = async () => {
            try {
                setLoadError(null);

                // Only load existing config if configId is provided (edit mode)
                if (configIdParam) {
                    let data: VisibilityConfigApiResponse | null = null;
                    let loaded = false;

                    // Preferred endpoint for single config
                    const byIdRes = await fetch(`/api/visibility/${configIdParam}`);
                    if (byIdRes.ok) {
                        data = await byIdRes.json();
                        loaded = Boolean(data?.config);
                    }

                    // Backward-compat fallback
                    if (!loaded) {
                        const fallbackRes = await fetch(`/api/visibility/create?id=${configIdParam}`);
                        if (fallbackRes.ok) {
                            data = await fallbackRes.json();
                            loaded = Boolean(data?.config);
                        }
                    }

                    if (!loaded) {
                        setLoadError('Impossibile caricare questa configurazione brand. Potrebbe non esistere o non essere accessibile.');
                    } else if (data?.config) {
                        setConfig({
                            brandName: data.config.brandName || '',
                            category: data.config.category || '',
                            description: data.config.description || '',
                            websiteUrl: data.config.websiteUrl || undefined,
                            additionalUrls: Array.isArray(data.config.additionalUrls)
                                ? data.config.additionalUrls
                                : [],
                            language: data.config.language || 'it',
                            territory: data.config.territory || 'IT',
                            projectId: data.config.projectId || projectIdParam || undefined,
                            prompts: data.config.prompts?.map((p) => ({
                                id: p.id,
                                text: p.text,
                                enabled: p.enabled,
                                aiOverviewEnabled: p.aiOverviewEnabled ?? true,
                                aiOverviewVariant: p.aiOverviewVariant || null,
                                aiOverviewLastFound: (() => {
                                    if (!p.aiOverviewLastFound) return null;
                                    return p.aiOverviewLastFound instanceof Date
                                        ? p.aiOverviewLastFound
                                        : new Date(p.aiOverviewLastFound);
                                })(),
                                referenceUrl: p.referenceUrl || undefined
                            })) || [],
                            competitors: data.config.competitors?.map((c) => ({
                                id: c.id,
                                name: c.name
                            })) || []
                        });
                        setIsEdit(true);
                        setConfigId(configIdParam);
                    }
                }

                // Load Limits and Projects
                const limitRes = await fetch('/api/user/settings');
                if (limitRes.ok) {
                    const limitData: UserSettingsResponse = await limitRes.json();

                    // Extract projects
                    const org = limitData.memberships?.[0]?.organization;
                    const orgProjects = org?.projects || [];
                    setProjects(orgProjects.map((p) => ({ id: p.id, name: p.name })));

                    const tier = org?.subscription?.tier || 'FREE';

                    // Default limits (from our centralized config logic)
                    let maxComp = 15;
                    let maxPrompts = 10;

                    if (tier === 'FREE' || tier === 'STARTER') {
                        maxComp = 0;
                        maxPrompts = 0;
                    } else if (tier === 'TRIAL') {
                        maxComp = 5;
                        maxPrompts = 10;
                    }

                    setLimits({ maxCompetitors: maxComp, maxPrompts: maxPrompts });
                }
            } catch (err) {
                console.error("Error loading config/limits:", err);
            }
        };
        loadConfig();
    }, [configIdParam, projectIdParam]);

    useEffect(() => {
        const projectId = config.projectId;
        if (!projectId || config.websiteUrl) return;

        const prefillWebsiteFromCms = async () => {
            try {
                const res = await fetch(`/api/cms/connection?projectId=${projectId}`);
                if (!res.ok) return;

                const data = await res.json();
                const cmsPublicUrl = data?.connection?.cmsPublicUrl;
                if (typeof cmsPublicUrl !== 'string' || !cmsPublicUrl.startsWith('http')) return;

                setConfig((prev) => {
                    if (prev.websiteUrl) return prev;
                    if (prev.projectId !== projectId) return prev;
                    return { ...prev, websiteUrl: cmsPublicUrl };
                });
            } catch (error) {
                console.warn('Unable to prefill website URL from CMS connection:', error);
            }
        };

        void prefillWebsiteFromCms();
    }, [config.projectId, config.websiteUrl]);

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
                body: JSON.stringify(isEdit ? { ...config, id: configId } : config)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to save');
            }

            const data = await response.json();
            const savedConfigId = data.configId || configId;

            // Redirect to the monitoring page for this specific brand
            router.push(`/dashboard/visibility?brandId=${savedConfigId}`);
        } catch (error: unknown) {
            console.error('Save error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Errore nel salvataggio. Riprova.';
            alert(errorMessage);
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
                    {loadError && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {loadError}
                        </div>
                    )}
                    {currentStep === 1 && (
                        <WizardStepBrand config={config} setConfig={setConfig} projects={projects} />
                    )}
                    {currentStep === 2 && (
                        <WizardStepPrompts config={config} setConfig={setConfig} maxPrompts={limits.maxPrompts} />
                    )}
                    {currentStep === 3 && (
                        <WizardStepCompetitors config={config} setConfig={setConfig} maxCompetitors={limits.maxCompetitors} />
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

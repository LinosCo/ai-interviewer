'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TEMPLATES, Template } from '@/lib/onboarding-templates';
import { Sparkles, ArrowRight, LayoutTemplate, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Icons } from '@/components/ui/business-tuner/Icons';

const examplePrompts = [
    'B2B: Vorrei capire perché i miei clienti SaaS non rinnovano il contratto dopo il primo anno',
    'B2C: Voglio analizzare le reazioni dei consumatori al nuovo packaging sostenibile',
    'HR: Devo scoprire le vere cause del turnover nel reparto vendite',
    'Ops: Voglio capire i problemi di comunicazione tra reparto logistica e produzione',
];

export default function OnboardingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        }>
            <OnboardingPageContent />
        </Suspense>
    );
}

function OnboardingPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId');

    const [goal, setGoal] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    const handleGenerate = () => {
        if (!goal.trim()) return;
        const encoded = encodeURIComponent(goal);
        const projectQuery = projectId ? `&projectId=${projectId}` : '';
        router.push(`/onboarding/generate?goal=${encoded}${projectQuery}`);
    };

    const handleTemplateSelect = (template: Template) => {
        const encoded = encodeURIComponent(template.id);
        const projectQuery = projectId ? `&projectId=${projectId}` : '';
        router.push(`/onboarding/generate?template=${encoded}${projectQuery}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-100 font-sans relative overflow-hidden flex flex-col">
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-gradient-radial from-orange-100/40 to-transparent rounded-full blur-3xl" />
                <div className="absolute top-1/4 right-0 w-[60vw] h-[40vh] bg-gradient-radial from-rose-100/25 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-0 w-[50vw] h-[30vh] bg-gradient-radial from-purple-100/20 to-transparent rounded-full blur-3xl" />
            </div>

            {/* Dashboard-style Header */}
            <header className="px-6 py-4 border-b border-black/5 bg-white/60 backdrop-blur-md flex justify-between items-center relative z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white">
                        <Icons.Logo size={20} />
                    </div>
                    <span className="font-semibold text-lg text-gray-900">Business Tuner</span>
                </div>
                <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard')}
                    className="gap-2"
                >
                    <LayoutTemplate size={16} /> Dashboard
                </Button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
                <div className="max-w-3xl w-full">
                    {!showTemplates ? (
                        <div className="flex flex-col gap-8">
                            {/* Title */}
                            <div className="text-center mb-4">
                                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                                    Cosa vuoi capire?
                                </h2>
                                <p className="text-lg md:text-xl text-gray-500 leading-relaxed">
                                    Descrivi il tuo obiettivo di ricerca e genereremo l'intervista perfetta per te
                                </p>
                            </div>

                            {/* Goal Input */}
                            <div className="relative">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl opacity-10 blur-lg" />
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="Es: Voglio capire perché i miei clienti non completano l'acquisto..."
                                    className="relative w-full h-44 p-6 text-lg bg-white/90 backdrop-blur-xl border border-amber-200/50 rounded-2xl text-gray-900 resize-none outline-none shadow-lg transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20"
                                />
                                <div className="absolute bottom-4 right-4">
                                    <button
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            if (!goal.trim() || isRefining) return;
                                            setIsRefining(true);
                                            try {
                                                const response = await fetch('/api/ai/refine', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ text: goal, fieldType: 'researchGoal' }),
                                                });
                                                if (response.ok) {
                                                    const { refinedText } = await response.json();
                                                    setGoal(refinedText);
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            } finally {
                                                setIsRefining(false);
                                            }
                                        }}
                                        disabled={isRefining || !goal.trim()}
                                        className="bg-amber-100 text-amber-700 border-none rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1 hover:bg-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Sparkles size={14} className={isRefining ? 'animate-spin' : ''} />
                                        {isRefining ? 'Refining...' : 'Refine with AI'}
                                    </button>
                                </div>
                            </div>

                            {/* Example Chips */}
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-gray-400 text-center font-medium">Prova con:</p>
                                <div className="flex flex-wrap gap-3 justify-center">
                                    {examplePrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setGoal(prompt)}
                                            className="px-4 py-2.5 text-sm bg-white/80 backdrop-blur-sm border border-amber-200/40 rounded-full text-gray-900 cursor-pointer transition-all font-medium hover:bg-amber-50 hover:border-amber-400 hover:-translate-y-0.5"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-4 pt-4 items-center">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={!goal.trim()}
                                    size="lg"
                                    className="px-10 py-6 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
                                >
                                    Genera la mia intervista
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowTemplates(true)}
                                    size="lg"
                                    className="px-10 py-6 text-base bg-white/80 backdrop-blur-sm border-amber-300/40 text-gray-900 font-semibold rounded-xl hover:bg-amber-50 hover:border-amber-400 hover:-translate-y-0.5 transition-all"
                                >
                                    <LayoutTemplate className="w-5 h-5 mr-2" />
                                    Usa un template
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Template Selection */
                        <div className="flex flex-col gap-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                                    Scegli un template
                                </h2>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="text-gray-400 bg-transparent border-none cursor-pointer text-base font-medium transition-colors hover:text-gray-900"
                                >
                                    &larr; Torna indietro
                                </button>
                            </div>

                            <div className="grid gap-4">
                                {TEMPLATES.map((template) => {
                                    const Icon = Icons[template.icon as keyof typeof Icons] || Icons.FileText;
                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => handleTemplateSelect(template)}
                                            className="p-6 bg-white/80 backdrop-blur-xl border border-amber-200/40 rounded-2xl text-left cursor-pointer transition-all shadow-sm hover:bg-white hover:border-amber-400 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10 group"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-amber-100 rounded-xl text-amber-600 flex-shrink-0">
                                                    <Icon size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                        {template.name}
                                                    </h3>
                                                    <p className="text-gray-500 text-base mb-3">
                                                        {template.description}
                                                    </p>
                                                    <span className="inline-block px-3 py-1 text-xs bg-amber-100 rounded-full text-amber-700 font-semibold capitalize">
                                                        {template.category}
                                                    </span>
                                                </div>
                                                <ArrowRight className="w-5 h-5 text-amber-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}

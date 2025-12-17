'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { templates, Template } from '@/lib/templates';
import { Sparkles, ArrowRight, LayoutTemplate } from 'lucide-react';

const examplePrompts = [
    'Voglio capire perché i miei clienti abbandonano il carrello',
    'Voglio raccogliere feedback sul nuovo processo di onboarding',
    'Voglio capire cosa pensano i dipendenti del nuovo tool',
    'Voglio validare un\'idea di prodotto prima di svilupparla',
];

export default function OnboardingPage() {
    const router = useRouter();
    const [goal, setGoal] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);

    const handleGenerate = () => {
        if (!goal.trim()) return;
        // Encode the goal and navigate to generate page
        const encoded = encodeURIComponent(goal);
        router.push(`/onboarding/generate?goal=${encoded}`);
    };

    const handleTemplateSelect = (template: Template) => {
        // Pre-fill with template and go to generate with template flag
        const encoded = encodeURIComponent(template.slug);
        router.push(`/onboarding/generate?template=${encoded}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
            {/* Header */}
            <header className="p-6">
                <h1 className="text-2xl font-bold text-white">voler.AI</h1>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-2xl w-full">
                    {!showTemplates ? (
                        <div className="space-y-8">
                            {/* Title */}
                            <div className="text-center space-y-3">
                                <h2 className="text-4xl font-bold text-white">
                                    Cosa vuoi capire?
                                </h2>
                                <p className="text-lg text-slate-300">
                                    Descrivi il tuo obiettivo di ricerca e genereremo l'intervista perfetta per te
                                </p>
                            </div>

                            {/* Goal Input */}
                            <div className="relative">
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="Es: Voglio capire perché i miei clienti non completano l'acquisto..."
                                    className="w-full h-40 p-6 text-lg bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                />
                                <div className="absolute bottom-4 right-4">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                </div>
                            </div>

                            {/* Example Chips */}
                            <div className="space-y-3">
                                <p className="text-sm text-slate-400 text-center">Prova con:</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {examplePrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setGoal(prompt)}
                                            className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-300 transition-colors"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                                <button
                                    onClick={handleGenerate}
                                    disabled={!goal.trim()}
                                    className="px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    Genera la mia intervista
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setShowTemplates(true)}
                                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    <LayoutTemplate className="w-5 h-5" />
                                    Usa un template
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Template Selection */
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-bold text-white">
                                    Scegli un template
                                </h2>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    ← Torna indietro
                                </button>
                            </div>

                            <div className="grid gap-4">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => handleTemplateSelect(template)}
                                        className="p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all hover:border-purple-500/50 group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <span className="text-3xl">{template.icon}</span>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                                                    {template.name}
                                                </h3>
                                                <p className="text-slate-400 mt-1">{template.description}</p>
                                                <span className="inline-block mt-2 px-2 py-1 text-xs bg-white/10 rounded text-slate-300 capitalize">
                                                    {template.category}
                                                </span>
                                            </div>
                                            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

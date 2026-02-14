'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TEMPLATES, Template, getTemplateById } from '@/lib/onboarding-templates';
import { Icons } from '@/components/ui/business-tuner/Icons';

interface WizardStepGoalProps {
    onNext: (config: any) => void;
    templateId?: string;
}

export default function WizardStepGoal({ onNext, templateId }: WizardStepGoalProps) {
    const [goal, setGoal] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (templateId) {
            const template = getTemplateById(templateId);
            if (template) {
                applyTemplate(template);
            }
        }
    }, [templateId]);

    const handleGenerate = async () => {
        if (!goal.trim()) {
            setError('Inserisci un obiettivo di ricerca');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/bots/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal })
            });

            if (!res.ok) {
                throw new Error('Generazione fallita');
            }

            const config = await res.json();
            onNext(config);
        } catch (err: any) {
            setError(err.message || 'Errore durante la generazione');
        } finally {
            setLoading(false);
        }
    };

    const applyTemplate = (template: Template) => {
        onNext({
            ...template.defaultConfig,
            name: template.name,
            researchGoal: template.researchGoal,
            targetAudience: template.targetAudience,
            fromTemplate: template.id
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Cosa vuoi approfondire?
                </h2>
                <p className="text-gray-600">
                    Descrivi il tuo obiettivo di ricerca o scegli un modello pronto all'uso.
                </p>
            </div>

            {/* AI Generation Option */}
            <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm ring-4 ring-amber-50/50">
                <div className="flex gap-4 mb-6">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg text-white shadow-lg shadow-amber-500/20">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Genera con AI</h3>
                        <p className="text-sm text-gray-500">L'AI creerà domande e struttura su misura per te</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={goal}
                            onChange={(e) => {
                                setGoal(e.target.value);
                                setError('');
                            }}
                            className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 min-h-[120px]"
                            placeholder="Es: Voglio capire perché i miei clienti SaaS non rinnovano il contratto dopo il primo anno..."
                        />
                        <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !goal.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transform transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analizziamo il tuo obiettivo...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Crea la mia intervista
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-500 text-sm font-medium animate-shake text-center">{error}</p>}
                </div>
            </div>

            <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">Oppure usa un template</span>
                <div className="flex-grow border-t border-gray-100"></div>
            </div>

            {/* Template Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEMPLATES.map((template) => {
                    const Icon = (Icons as any)[template.icon] || Icons.FileText;
                    return (
                        <button
                            key={template.id}
                            onClick={() => applyTemplate(template)}
                            className="flex items-start gap-4 p-5 border border-gray-100 rounded-xl hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/5 transition-all text-left bg-white group relative overflow-hidden"
                        >
                            <div className="relative z-10 p-3 bg-amber-50 rounded-lg group-hover:bg-amber-100 text-amber-600 transition-colors">
                                <Icon size={24} />
                            </div>
                            <div className="relative z-10 pr-6">
                                <h4 className="font-bold text-gray-900 mb-1 group-hover:text-amber-700 transition-colors">{template.name}</h4>
                                <p className="text-sm text-gray-500 leading-snug line-clamp-2">{template.description}</p>
                            </div>
                            <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );
}

'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepPromptProps {
    onNext: (config: any) => void;
}

export default function WizardStepPrompt({ onNext }: WizardStepPromptProps) {
    const [prompt, setPrompt] = useState('');
    const [businessContext, setBusinessContext] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Inserisci una descrizione del chatbot');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/chatbot/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userPrompt: prompt,
                    businessContext: businessContext || undefined
                })
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

    // Lazy load templates via require is tricky in client components, better to import if standard
    // or just hardcode the reference if possible. We'll use a dynamic import or standard import.
    // Standard import is safe here as it's a TS file.
    // import { CHATBOT_TEMPLATES } from '@/lib/templates/chatbot-templates';
    // We can't use import inside the component body, but we can move it to top.

    // NOTE: We need to update imports at the top. I'll include CHATBOT_TEMPLATES in the write.

    const applyTemplate = (templateId: string) => {
        const templates = require('@/lib/templates/chatbot-templates').CHATBOT_TEMPLATES;
        setSelectedTemplate(templateId);
        const template = templates.find((t: any) => t.id === templateId);
        if (template) {
            onNext({ suggestedConfig: template.config });
        }
    };

    // We need to fetch templates. Since it is a client component, we can import them if they are in a .ts file.
    // But direct require might fail in some Next.js configs. 
    // Let's assume standard import works if I add it to the top.

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Come vuoi iniziare?
                </h2>
                <p className="text-gray-600">
                    Puoi descrivere la tua idea all'AI oppure scegliere un modello pronto all'uso.
                </p>
            </div>

            {/* AI Generation Option */}
            <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm ring-4 ring-blue-50/50">
                <div className="flex gap-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg text-white">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-lg">Genera con AI</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cosa vuoi che faccia il tuo chatbot? *
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => {
                                setPrompt(e.target.value);
                                setSelectedTemplate(null);
                            }}
                            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={3}
                            placeholder="Es: Voglio un chatbot per supporto clienti e-commerce che aiuti gli utenti a trovare prodotti..."
                        />
                    </div>

                    <div>
                        {/* Optional context */}
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Contesto aggiuntivo (opzionale)
                        </label>
                        <input
                            type="text"
                            value={businessContext}
                            onChange={(e) => setBusinessContext(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Es: Target audience, tono di voce, informazioni chiave..."
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !prompt.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-medium shadow transition-all hover:shadow-lg disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creazione in corso...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Genera Configurazione
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                </div>
            </div>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OPPURE SCEGLI UN TEMPLATE</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Template Selection */}
            {/* We need the templates data. For now, I will hardcode the import usage carefully. 
                I will add the import to the top of the file in the CodeContent.
            */}
            <TemplateSelector onSelect={applyTemplate} />
        </motion.div>
    );
}

// Sub-component for templates to handle the import/rendering cleanly
import { CHATBOT_TEMPLATES } from '@/lib/templates/chatbot-templates';

function TemplateSelector({ onSelect }: { onSelect: (id: string) => void }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHATBOT_TEMPLATES.map((template: any) => {
                const Icon = template.icon;
                return (
                    <button
                        key={template.id}
                        onClick={() => onSelect(template.id)}
                        className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left bg-white group"
                    >
                        <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-blue-50 text-gray-500 group-hover:text-blue-600 transition-colors">
                            <Icon className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
                            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{template.description}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

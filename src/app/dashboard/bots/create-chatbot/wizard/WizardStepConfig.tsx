'use client';

import { useState } from 'react';
import { Check, Edit2, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepConfigProps {
    initialConfig: any;
    onNext: (config: any) => void;
    onBack: () => void;
}

export default function WizardStepConfig({ initialConfig, onNext, onBack }: WizardStepConfigProps) {
    const [config, setConfig] = useState(initialConfig);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [refining, setRefining] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('');

    const handleRefine = async () => {
        if (!refinementPrompt.trim()) return;

        setRefining(true);
        try {
            const res = await fetch('/api/chatbot/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentConfig: config,
                    refinementPrompt
                })
            });

            if (res.ok) {
                const refinedConfig = await res.json();
                setConfig(refinedConfig);
                setRefinementPrompt('');
            }
        } catch (err) {
            console.error('Refinement failed:', err);
        } finally {
            setRefining(false);
        }
    };

    const toneOptions = [
        'Professional and warm',
        'Friendly and casual',
        'Technical and precise',
        'Empathetic and supportive',
        'Energetic and sales-focused'
    ];

    const colorOptions = [
        { name: 'Indigo', value: '#4F46E5' },
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Green', value: '#10B981' },
        { name: 'Orange', value: '#F59E0B' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Teal', value: '#14B8A6' }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Rivedi e Personalizza
                </h2>
                <p className="text-gray-600">
                    L'AI ha generato questa configurazione. Puoi modificarla o raffinarla ulteriormente.
                </p>
            </div>

            {/* AI Refinement */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">Raffina con AI</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Descrivi le modifiche che vuoi apportare
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={refinementPrompt}
                                onChange={(e) => setRefinementPrompt(e.target.value)}
                                placeholder="Es: Rendi il tono più formale"
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                            />
                            <button
                                onClick={handleRefine}
                                disabled={refining || !refinementPrompt.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                Raffina
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuration Fields */}
            <div className="space-y-4">
                {/* Name */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Nome Chatbot</label>
                        <button
                            onClick={() => setEditingField(editingField === 'name' ? null : 'name')}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                    {editingField === 'name' ? (
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            autoFocus
                        />
                    ) : (
                        <p className="text-gray-900 font-medium">{config.name}</p>
                    )}
                </div>

                {/* Description */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Descrizione</label>
                        <button
                            onClick={() => setEditingField(editingField === 'description' ? null : 'description')}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                    {editingField === 'description' ? (
                        <textarea
                            value={config.description}
                            onChange={(e) => setConfig({ ...config, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                            rows={3}
                            autoFocus
                        />
                    ) : (
                        <p className="text-gray-700">{config.description}</p>
                    )}
                </div>

                {/* Tone */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Tono di Voce</label>
                    <select
                        value={config.tone}
                        onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                        {toneOptions.map(tone => (
                            <option key={tone} value={tone}>{tone}</option>
                        ))}
                    </select>
                </div>

                {/* Primary Color */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Colore Principale</label>
                    <div className="flex gap-3 flex-wrap">
                        {colorOptions.map(color => (
                            <button
                                key={color.value}
                                onClick={() => setConfig({ ...config, primaryColor: color.value })}
                                className={`w-12 h-12 rounded-full border-2 transition-all ${config.primaryColor === color.value
                                    ? 'border-gray-900 scale-110 shadow-lg'
                                    : 'border-transparent hover:scale-105'
                                    }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            />
                        ))}
                        <input
                            type="color"
                            value={config.primaryColor || '#7C3AED'}
                            onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                            className="w-12 h-12 rounded-full border-2 border-gray-300 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Topics */}
                {config.topics && config.topics.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Argomenti Principali</label>
                        <div className="flex flex-wrap gap-2">
                            {config.topics.map((topic: string, idx: number) => (
                                <span
                                    key={idx}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                                >
                                    <Check className="w-3 h-3" />
                                    {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Welcome Message */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Messaggio di Benvenuto</label>
                        <button
                            onClick={() => setEditingField(editingField === 'welcomeMessage' ? null : 'welcomeMessage')}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                    {editingField === 'welcomeMessage' ? (
                        <textarea
                            value={config.welcomeMessage}
                            onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                            rows={2}
                            autoFocus
                        />
                    ) : (
                        <p className="text-gray-700 italic">&quot;{config.welcomeMessage}&quot;</p>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
                <button
                    onClick={onBack}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                    ← Indietro
                </button>
                <button
                    onClick={() => onNext(config)}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-lg"
                >
                    Continua →
                </button>
            </div>
        </motion.div>
    );
}

'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Edit2, Check, Clock, Globe, MessageSquare, Target, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepSettingsProps {
    initialConfig: any;
    onNext: (config: any) => void;
    onBack: () => void;
}

export default function WizardStepSettings({ initialConfig, onNext, onBack }: WizardStepSettingsProps) {
    const [config, setConfig] = useState(initialConfig);
    const [isRefining, setIsRefining] = useState<string | null>(null);

    const handleRefine = async (fieldType: string, text: string) => {
        if (!text.trim()) return;

        setIsRefining(fieldType);
        try {
            const res = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, fieldType })
            });

            if (res.ok) {
                const { refinedText } = await res.json();
                setConfig({ ...config, [fieldType]: refinedText });
            }
        } catch (err) {
            console.error('Refinement failed:', err);
        } finally {
            setIsRefining(null);
        }
    };

    const toneOptions = [
        'Empatico ma professionale',
        'Amichevole e informale',
        'Tecnico e preciso',
        'Professionale e distaccato',
        'Incuriosito e propositivo'
    ];

    const languageOptions = ['Italiano', 'English', 'Español', 'Français', 'Deutsch'];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Configura la tua ricerca
                </h2>
                <p className="text-gray-600">
                    Rivedi e affina i dettagli della tua intervista per ottenere i migliori risultati.
                </p>
            </div>

            <div className="space-y-4">
                {/* Research Goal */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <Target size={16} />
                            Obiettivo della ricerca
                        </div>
                        <button
                            onClick={() => handleRefine('researchGoal', config.researchGoal)}
                            disabled={isRefining === 'researchGoal'}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                            {isRefining === 'researchGoal' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Raffina con AI
                        </button>
                    </div>
                    <textarea
                        value={config.researchGoal}
                        onChange={(e) => setConfig({ ...config, researchGoal: e.target.value })}
                        className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[80px] resize-none"
                    />
                </div>

                {/* Target Audience */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <Users size={16} />
                            Target Audience
                        </div>
                    </div>
                    <input
                        type="text"
                        value={config.targetAudience}
                        onChange={(e) => setConfig({ ...config, targetAudience: e.target.value })}
                        placeholder="Es: Clienti che hanno cancellato l'abbonamento negli ultimi 30 giorni"
                        className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Language */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <Globe size={16} />
                            Lingua
                        </div>
                        <select
                            value={config.language}
                            onChange={(e) => setConfig({ ...config, language: e.target.value })}
                            className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                        >
                            {languageOptions.map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tone */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <MessageSquare size={16} />
                            Tono
                        </div>
                        <select
                            value={config.tone}
                            onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                            className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                        >
                            {toneOptions.map(tone => (
                                <option key={tone} value={tone}>{tone}</option>
                            ))}
                        </select>
                    </div>

                    {/* Duration */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <Clock size={16} />
                            Durata Max (min)
                        </div>
                        <input
                            type="number"
                            value={config.maxDurationMins}
                            onChange={(e) => setConfig({ ...config, maxDurationMins: parseInt(e.target.value) })}
                            className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-2 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Intro Message */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-sm uppercase tracking-wider">
                            <MessageSquare size={16} />
                            Messaggio di benvenuto
                        </div>
                        <button
                            onClick={() => handleRefine('introMessage', config.introMessage)}
                            disabled={isRefining === 'introMessage'}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                            {isRefining === 'introMessage' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Raffina con AI
                        </button>
                    </div>
                    <textarea
                        value={config.introMessage}
                        onChange={(e) => setConfig({ ...config, introMessage: e.target.value })}
                        className="w-full bg-orange-50/20 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[60px] resize-none"
                    />
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 pt-6">
                <button
                    onClick={onBack}
                    className="px-8 py-3.5 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                    Indietro
                </button>
                <button
                    onClick={() => onNext(config)}
                    className="flex-1 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                    Continua
                    <Check size={20} />
                </button>
            </div>
        </motion.div>
    );
}

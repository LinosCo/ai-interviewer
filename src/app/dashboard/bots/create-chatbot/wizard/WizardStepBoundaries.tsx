'use client';

import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepBoundariesProps {
    initialConfig: any;
    onNext: (config: any) => void;
    onBack: () => void;
}

export default function WizardStepBoundaries({ initialConfig, onNext, onBack }: WizardStepBoundariesProps) {
    const [config, setConfig] = useState(initialConfig);
    const [boundaries, setBoundaries] = useState<string[]>(config.boundaries || [
        'Non fornire consigli medici o legali',
        'Non condividere informazioni personali degli utenti',
        'Rimandare a un operatore umano per questioni complesse'
    ]);
    const [fallbackMessage, setFallbackMessage] = useState(
        config.fallbackMessage || 'Mi dispiace, non ho informazioni sufficienti per rispondere a questa domanda. Posso metterti in contatto con un nostro operatore?'
    );
    const [newBoundary, setNewBoundary] = useState('');

    const handleAddBoundary = () => {
        if (!newBoundary.trim()) return;
        setBoundaries([...boundaries, newBoundary]);
        setNewBoundary('');
    };

    const handleRemoveBoundary = (index: number) => {
        setBoundaries(boundaries.filter((_, i) => i !== index));
    };

    const handleContinue = () => {
        onNext({
            ...config,
            boundaries,
            fallbackMessage
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Limiti e Comportamenti
                </h2>
                <p className="text-gray-600">
                    Definisci cosa il chatbot può e non può fare per garantire risposte appropriate
                </p>
            </div>

            {/* AI Suggested Boundaries */}
            {config.boundaries && config.boundaries.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Suggerimenti di Sicurezza
                    </h3>
                    <p className="text-sm text-blue-700 mb-3">
                        L'AI suggerisce di limitare questi argomenti sensibili:
                    </p>
                    <ul className="space-y-1">
                        {config.boundaries.map((boundary: string, idx: number) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {boundary}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Boundaries List */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Limiti Attivi</h3>
                <div className="space-y-2 mb-4">
                    {boundaries.map((boundary, idx) => (
                        <div
                            key={idx}
                            className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                            <div className="flex items-start gap-2">
                                <Shield className="w-4 h-4 text-red-600 mt-0.5" />
                                <p className="text-sm text-gray-900">{boundary}</p>
                            </div>
                            <button
                                onClick={() => handleRemoveBoundary(idx)}
                                className="text-red-600 hover:text-red-700 text-sm"
                            >
                                Rimuovi
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add New Boundary */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newBoundary}
                        onChange={(e) => setNewBoundary(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Es: Non discutere di politica o religione"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBoundary()}
                    />
                    <button
                        onClick={handleAddBoundary}
                        disabled={!newBoundary.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        Aggiungi
                    </button>
                </div>
            </div>

            {/* Fallback Message */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Messaggio di Fallback
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                    Cosa dire quando il bot non sa rispondere o la domanda è fuori scope
                </p>
                <textarea
                    value={fallbackMessage}
                    onChange={(e) => setFallbackMessage(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                    rows={3}
                />
            </div>

            {/* Best Practices */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-medium text-blue-900 mb-2">💡 Best Practices</h3>
                <ul className="space-y-1 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5" />
                        Sii specifico sui limiti per evitare risposte inappropriate
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5" />
                        Includi sempre un&apos;opzione per parlare con un umano
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5" />
                        Il messaggio di fallback deve essere cortese e offrire alternative
                    </li>
                </ul>
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
                    onClick={handleContinue}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-lg"
                >
                    Continua →
                </button>
            </div>
        </motion.div>
    );
}

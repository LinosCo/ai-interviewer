'use client';

import { useState } from 'react';
import { Upload, Link as LinkIcon, FileText, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WizardStepKnowledgeProps {
    initialConfig: any;
    onNext: (config: any) => void;
    onBack: () => void;
}

export default function WizardStepKnowledge({ initialConfig, onNext, onBack }: WizardStepKnowledgeProps) {
    const [config, setConfig] = useState(initialConfig);
    const [knowledgeSources, setKnowledgeSources] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'text' | 'url'>('text');
    const [textContent, setTextContent] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddText = () => {
        if (!textContent.trim()) return;

        setKnowledgeSources([
            ...knowledgeSources,
            {
                type: 'text',
                title: `Documento ${knowledgeSources.length + 1}`,
                content: textContent
            }
        ]);
        setTextContent('');
    };

    const handleAddUrl = async () => {
        if (!urlInput.trim()) return;

        setLoading(true);
        try {
            // Add URL to be scraped later
            setKnowledgeSources([
                ...knowledgeSources,
                {
                    type: 'url',
                    title: urlInput,
                    content: 'To be scraped'
                }
            ]);
            setUrlInput('');
        } catch (err) {
            console.error('Failed to add URL:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (index: number) => {
        setKnowledgeSources(knowledgeSources.filter((_, i) => i !== index));
    };

    const handleContinue = () => {
        onNext({
            ...config,
            knowledgeSources
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
                    Knowledge Base
                </h2>
                <p className="text-gray-600">
                    Aggiungi le informazioni che il chatbot deve conoscere per rispondere correttamente
                </p>
            </div>

            {/* Suggested Knowledge from AI */}
            {config.suggestedKnowledge && config.suggestedKnowledge.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-medium text-blue-900 mb-2">💡 Suggerimenti AI</h3>
                    <p className="text-sm text-blue-700 mb-3">
                        L'AI suggerisce di aggiungere informazioni su questi argomenti:
                    </p>
                    <ul className="space-y-1">
                        {config.suggestedKnowledge.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('text')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'text'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Testo
                </button>
                <button
                    onClick={() => setActiveTab('url')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'url'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <LinkIcon className="w-4 h-4 inline mr-2" />
                    URL
                </button>
            </div>

            {/* Content */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
                {activeTab === 'text' && (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">
                            Incolla informazioni, FAQ, listini, ecc.
                        </label>
                        <textarea
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg resize-none font-mono text-sm"
                            rows={8}
                            placeholder="La nostra azienda offre...&#10;&#10;Orari di apertura: ...&#10;&#10;Politica di reso: ..."
                        />
                        <button
                            onClick={handleAddText}
                            disabled={!textContent.trim()}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            Aggiungi Testo
                        </button>
                    </div>
                )}

                {activeTab === 'url' && (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">
                            Inserisci URL da cui estrarre informazioni
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="https://esempio.com/faq"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                            />
                            <button
                                onClick={handleAddUrl}
                                disabled={!urlInput.trim() || loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                                Aggiungi
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Il contenuto verrà estratto automaticamente dall'URL
                        </p>
                    </div>
                )}
            </div>

            {/* Knowledge Sources List */}
            {knowledgeSources.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">
                        Fonti Aggiunte ({knowledgeSources.length})
                    </h3>
                    {knowledgeSources.map((source, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                {source.type === 'url' ? (
                                    <LinkIcon className="w-4 h-4 text-blue-600" />
                                ) : (
                                    <FileText className="w-4 h-4 text-blue-600" />
                                )}
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{source.title}</p>
                                    {source.type === 'text' && (
                                        <p className="text-xs text-gray-500">
                                            {source.content.substring(0, 60)}...
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemove(idx)}
                                className="text-red-600 hover:text-red-700"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Skip Option */}
            {knowledgeSources.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800">
                        ⚠️ Puoi saltare questo step, ma il chatbot avrà solo conoscenze generiche.
                        Aggiungere una knowledge base migliora significativamente la qualità delle risposte.
                    </p>
                </div>
            )}

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

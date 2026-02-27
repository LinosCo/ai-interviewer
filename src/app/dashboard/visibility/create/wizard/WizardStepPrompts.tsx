'use client';

import { useState } from 'react';
import { Sparkles, Edit2, Trash2, Loader2, Plus, Wand2, Globe, X, Link2 } from 'lucide-react';
import { VisibilityConfig } from '../page';

interface Props {
    config: VisibilityConfig;
    setConfig: (config: VisibilityConfig) => void;
    maxPrompts?: number;
}

export function WizardStepPrompts({ config, setConfig, maxPrompts = 10 }: Props) {
    const [generating, setGenerating] = useState(false);
    const [refiningId, setRefiningId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editingRefUrlId, setEditingRefUrlId] = useState<string | null>(null);
    const [refUrlText, setRefUrlText] = useState('');

    const isLimitReached = maxPrompts !== -1 && config.prompts.length >= maxPrompts;

    const handleEditRefUrl = (prompt: typeof config.prompts[0]) => {
        setEditingRefUrlId(prompt.id);
        setRefUrlText(prompt.referenceUrl || '');
    };

    const handleSaveRefUrl = (promptId: string) => {
        const updated = config.prompts.map(p =>
            p.id === promptId ? { ...p, referenceUrl: refUrlText.trim() || undefined } : p
        );
        setConfig({ ...config, prompts: updated });
        setEditingRefUrlId(null);
        setRefUrlText('');
    };

    const handleRemoveRefUrl = (promptId: string) => {
        const updated = config.prompts.map(p =>
            p.id === promptId ? { ...p, referenceUrl: undefined } : p
        );
        setConfig({ ...config, prompts: updated });
    };

    const handleGenerate = async () => {
        if (!config.brandName || !config.category) {
            alert('Compila prima le informazioni del brand');
            return;
        }

        setGenerating(true);
        try {
            const response = await fetch('/api/visibility/generate-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brandName: config.brandName,
                    category: config.category,
                    description: config.description,
                    language: config.language,
                    territory: config.territory,
                    count: Math.min(5, maxPrompts)
                })
            });

            if (!response.ok) throw new Error('Generation failed');

            const data = await response.json();
            // Truncate if API returns too many
            const rawPrompts = data.prompts.slice(0, maxPrompts);

            const prompts = rawPrompts.map((text: string, index: number) => ({
                id: `prompt-${Date.now()}-${index}`,
                text,
                enabled: true
            }));

            setConfig({ ...config, prompts });
        } catch (error) {
            console.error('Error generating prompts:', error);
            alert('Errore nella generazione. Riprova.');
        } finally {
            setGenerating(false);
        }
    };

    const handleRefine = async (prompt: typeof config.prompts[0]) => {
        if (!config.brandName) return;

        setRefiningId(prompt.id);
        try {
            const response = await fetch('/api/visibility/refine-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promptText: prompt.text,
                    brandName: config.brandName,
                    language: config.language,
                    territory: config.territory
                })
            });

            if (!response.ok) throw new Error('Refine failed');

            const data = await response.json();
            const updated = config.prompts.map(p =>
                p.id === prompt.id ? { ...p, text: data.refinedPrompt } : p
            );
            setConfig({ ...config, prompts: updated });
        } catch (error) {
            console.error('Error refining prompt:', error);
            alert('Errore durante il raffinamento. Riprova.');
        } finally {
            setRefiningId(null);
        }
    };

    const handleAddManual = () => {
        if (isLimitReached) return;
        const newPrompt = {
            id: `prompt-${Date.now()}`,
            text: '',
            enabled: true
        };
        setConfig({ ...config, prompts: [...config.prompts, newPrompt] });
        setEditingId(newPrompt.id);
        setEditText('');
    };

    const handleEdit = (prompt: typeof config.prompts[0]) => {
        setEditingId(prompt.id);
        setEditText(prompt.text);
    };

    const handleSaveEdit = () => {
        if (!editingId) return;
        const updated = config.prompts.map(p =>
            p.id === editingId ? { ...p, text: editText } : p
        );
        setConfig({ ...config, prompts: updated });
        setEditingId(null);
        setEditText('');
    };

    const handleDelete = (id: string) => {
        setConfig({ ...config, prompts: config.prompts.filter(p => p.id !== id) });
    };

    const handleToggle = (id: string) => {
        const updated = config.prompts.map(p =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
        );
        setConfig({ ...config, prompts: updated });
    };

    const handleToggleAiOverview = (id: string) => {
        const updated = config.prompts.map(p =>
            p.id === id ? { ...p, aiOverviewEnabled: !(p.aiOverviewEnabled ?? true) } : p
        );
        setConfig({ ...config, prompts: updated });
    };

    const handleClearAiOverviewVariant = (id: string) => {
        const updated = config.prompts.map(p =>
            p.id === id ? { ...p, aiOverviewVariant: null, aiOverviewLastFound: null } : p
        );
        setConfig({ ...config, prompts: updated });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-stone-900 mb-2">
                    Prompts di Monitoring
                </h2>
                <div className="flex justify-between items-start">
                    <p className="text-stone-600">
                        Genera automaticamente o crea manualmente i prompt che verranno utilizzati per interrogare gli LLM
                    </p>
                    <div className="text-xs font-semibold bg-stone-100 px-3 py-1 rounded-full text-stone-700">
                        {config.prompts.length} / {maxPrompts === -1 ? '∞' : maxPrompts} Prompts
                    </div>
                </div>
            </div>

            {/* Generate Button */}
            {config.prompts.length === 0 && (
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-all"
                >
                    {generating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generazione in corso...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Genera Prompts con AI
                        </>
                    )}
                </button>
            )}

            {/* Prompts List */}
            {config.prompts.length > 0 && (
                <div className="space-y-3">
                    {config.prompts.map((prompt) => (
                        <div
                            key={prompt.id}
                            className={`border rounded-lg p-4 transition-all ${prompt.enabled ? 'border-stone-300 bg-white' : 'border-stone-200 bg-stone-50 opacity-60'
                                }`}
                        >
                            {editingId === prompt.id ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                                        rows={3}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                                        >
                                            Salva
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="px-4 py-2 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 text-sm"
                                        >
                                            Annulla
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-stone-900">{prompt.text || 'Prompt vuoto - clicca modifica'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Refine AI Button */}
                                            <button
                                                onClick={() => handleRefine(prompt)}
                                                disabled={refiningId === prompt.id || !prompt.text}
                                                className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Raffina con AI"
                                            >
                                                {refiningId === prompt.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Wand2 className="w-4 h-4" />
                                                )}
                                            </button>

                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={prompt.enabled}
                                                    onChange={() => handleToggle(prompt.id)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                            </label>
                                            <button
                                                onClick={() => handleEdit(prompt)}
                                                className="p-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(prompt.id)}
                                                className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Overview Section */}
                                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-blue-500" />
                                            <span className="text-sm text-stone-600">Google AI Overview</span>
                                            {prompt.aiOverviewVariant && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                    Variante trovata
                                                    {prompt.aiOverviewLastFound && (
                                                        <span className="text-green-600">
                                                            ({new Date(prompt.aiOverviewLastFound).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {!prompt.aiOverviewVariant && (prompt.aiOverviewEnabled ?? true) && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-stone-100 text-stone-500 text-xs rounded-full">
                                                    Da cercare
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {prompt.aiOverviewVariant && (
                                                <button
                                                    onClick={() => handleClearAiOverviewVariant(prompt.id)}
                                                    className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    title="Rimuovi variante salvata"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={prompt.aiOverviewEnabled ?? true}
                                                    onChange={() => handleToggleAiOverview(prompt.id)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                            </label>
                                        </div>
                                    </div>
                                    {prompt.aiOverviewVariant && (
                                        <div className="text-xs text-stone-500 pl-6">
                                            Query: &quot;<span className="italic">{prompt.aiOverviewVariant}</span>&quot;
                                        </div>
                                    )}

                                    {/* Reference URL Section */}
                                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Link2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            <span className="text-sm text-stone-600">URL di Riferimento</span>
                                            {editingRefUrlId === prompt.id ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                        type="url"
                                                        value={refUrlText}
                                                        onChange={(e) => setRefUrlText(e.target.value)}
                                                        placeholder="https://esempio.it/pagina-rilevante"
                                                        className="flex-1 px-2 py-1 text-sm border border-stone-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleSaveRefUrl(prompt.id);
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditingRefUrlId(null);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => handleSaveRefUrl(prompt.id)}
                                                        className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                                                    >
                                                        OK
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingRefUrlId(null)}
                                                        className="px-2 py-1 text-xs bg-stone-200 text-stone-700 rounded hover:bg-stone-300"
                                                    >
                                                        Annulla
                                                    </button>
                                                </div>
                                            ) : prompt.referenceUrl ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <a
                                                        href={prompt.referenceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-amber-600 hover:underline truncate max-w-[300px]"
                                                    >
                                                        {prompt.referenceUrl}
                                                    </a>
                                                    <button
                                                        onClick={() => handleEditRefUrl(prompt)}
                                                        className="p-1 text-stone-400 hover:text-amber-600 transition-colors"
                                                        title="Modifica URL"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveRefUrl(prompt.id)}
                                                        className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                                                        title="Rimuovi URL"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEditRefUrl(prompt)}
                                                    className="text-xs text-amber-600 hover:underline"
                                                >
                                                    + Aggiungi URL
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={handleAddManual}
                        disabled={isLimitReached}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-lg text-stone-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-5 h-5" />
                        {isLimitReached ? "Limite Raggiunto" : "Aggiungi Prompt Manuale"}
                    </button>

                    {config.prompts.length > 0 && (
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-amber-600 text-amber-600 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-all"
                        >
                            {generating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Rigenera Tutti con AI
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                    <strong>⚠️ Nota:</strong> I prompt disabilitati (toggle off) non verranno utilizzati nel monitoring ma rimarranno salvati. Usa il bottone <Wand2 className="w-3 h-3 inline" /> per raffinare un singolo prompt con l&apos;AI.
                </p>
            </div>
        </div>
    );
}

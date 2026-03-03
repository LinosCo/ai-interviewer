'use client';

import { useState } from 'react';
import { Plus, X, Link } from 'lucide-react';
import { VisibilityConfig } from '../page';

interface Props {
    config: VisibilityConfig;
    setConfig: (config: VisibilityConfig) => void;
    projects: Array<{ id: string, name: string }>;
}

export function WizardStepBrand({ config, setConfig, projects }: Props) {
    const [newUrl, setNewUrl] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newAlias, setNewAlias] = useState('');

    const addAdditionalUrl = () => {
        if (!newUrl.trim() || !newLabel.trim()) return;

        const additionalUrls = [...(config.additionalUrls || [])];
        additionalUrls.push({ url: newUrl.trim(), label: newLabel.trim() });
        setConfig({ ...config, additionalUrls });
        setNewUrl('');
        setNewLabel('');
    };

    const removeAdditionalUrl = (index: number) => {
        const additionalUrls = [...(config.additionalUrls || [])];
        additionalUrls.splice(index, 1);
        setConfig({ ...config, additionalUrls });
    };

    const addBrandAlias = () => {
        const alias = newAlias.trim();
        if (!alias) return;
        if (alias.toLowerCase() === config.brandName.trim().toLowerCase()) {
            setNewAlias('');
            return;
        }
        const currentAliases = Array.isArray(config.brandAliases) ? config.brandAliases : [];
        if (currentAliases.some((item) => item.toLowerCase() === alias.toLowerCase())) {
            setNewAlias('');
            return;
        }
        setConfig({ ...config, brandAliases: [...currentAliases, alias] });
        setNewAlias('');
    };

    const removeBrandAlias = (index: number) => {
        const aliases = [...(config.brandAliases || [])];
        aliases.splice(index, 1);
        setConfig({ ...config, brandAliases: aliases });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Informazioni sul Brand
                    </h2>
                    <p className="text-gray-600">
                        Fornisci le informazioni di base per la configurazione del monitoring
                    </p>
                </div>
                {projects.length > 0 && (
                    <div className="w-64">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">
                            Progetto Associato
                        </label>
                        <select
                            value={config.projectId || ''}
                            onChange={(e) => setConfig({ ...config, projectId: e.target.value || undefined })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                        >
                            <option value="">Nessun Progetto</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome Brand *
                    </label>
                    <input
                        type="text"
                        value={config.brandName}
                        onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
                        placeholder="Es. Business Tuner"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                    />
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Varianti Brand (opzionale)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Inserisci varianti/forme alternative del brand (es. nomi storici, forme estese, typo ricorrenti) per migliorare il rilevamento.
                    </p>
                    {config.brandAliases && config.brandAliases.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {config.brandAliases.map((alias, index) => (
                                <span key={`${alias}-${index}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs font-medium text-amber-800">
                                    {alias}
                                    <button
                                        type="button"
                                        onClick={() => removeBrandAlias(index)}
                                        className="text-amber-500 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newAlias}
                            onChange={(e) => setNewAlias(e.target.value)}
                            placeholder="Es. Villa Capra detta La Rotonda"
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addBrandAlias();
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={addBrandAlias}
                            disabled={!newAlias.trim()}
                            className="px-3 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Categoria di Prodotto *
                    </label>
                    <input
                        type="text"
                        value={config.category}
                        onChange={(e) => setConfig({ ...config, category: e.target.value })}
                        placeholder="Es. AI Interview Platform, CRM Software, etc."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descrizione Breve *
                    </label>
                    <textarea
                        value={config.description}
                        onChange={(e) => setConfig({ ...config, description: e.target.value })}
                        placeholder="Descrivi brevemente cosa fa il tuo prodotto e quali problemi risolve..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL Sito Web
                    </label>
                    <input
                        type="url"
                        value={config.websiteUrl || ''}
                        onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value || undefined })}
                        placeholder="https://www.esempio.it"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Opzionale. Inserisci l&apos;URL per ricevere AI Tips di ottimizzazione per LLM e motori di ricerca.
                    </p>
                </div>

                {/* Additional URLs Section */}
                {config.websiteUrl && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            <Link className="w-4 h-4 inline mr-2" />
                            Pagine Aggiuntive Importanti
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Aggiungi pagine specifiche del tuo sito che vuoi includere nell&apos;analisi (es. pagina prodotto, pricing, FAQ).
                        </p>

                        {/* List of added URLs */}
                        {config.additionalUrls && config.additionalUrls.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {config.additionalUrls.map((item, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                            {item.label}
                                        </span>
                                        <span className="text-sm text-gray-600 truncate flex-1">
                                            {item.url}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAdditionalUrl(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new URL form */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="Etichetta (es. Pricing)"
                                className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                            />
                            <input
                                type="url"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                placeholder="https://esempio.it/pagina"
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addAdditionalUrl();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={addAdditionalUrl}
                                disabled={!newUrl.trim() || !newLabel.trim()}
                                className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lingua *
                        </label>
                        <select
                            value={config.language || 'it'}
                            onChange={(e) => setConfig({ ...config, language: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                        >
                            <option value="it">🇮🇹 Italiano</option>
                            <option value="en">🇬🇧 English</option>
                            <option value="es">🇪🇸 Español</option>
                            <option value="fr">🇫🇷 Français</option>
                            <option value="de">🇩🇪 Deutsch</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Target Territoriale *
                        </label>
                        <select
                            value={config.territory || 'IT'}
                            onChange={(e) => setConfig({ ...config, territory: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                        >
                            <option value="IT">🇮🇹 Italia</option>
                            <option value="US">🇺🇸 USA</option>
                            <option value="UK">🇬🇧 UK</option>
                            <option value="ES">🇪🇸 España</option>
                            <option value="FR">🇫🇷 France</option>
                            <option value="DE">🇩🇪 Deutschland</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>💡 Suggerimento:</strong> La lingua e il territorio influenzeranno la generazione dei prompts e le query agli LLM per risultati localizzati.
                </p>
            </div>
        </div>
    );
}


import React, { useState } from 'react';
import { VisibilityConfig } from '../page';
import { Plus, Trash2, Globe, Search } from 'lucide-react';

interface WizardStepCompetitorsProps {
    config: VisibilityConfig;
    setConfig: (config: VisibilityConfig) => void;
}

export function WizardStepCompetitors({ config, setConfig }: WizardStepCompetitorsProps) {
    const [newCompetitor, setNewCompetitor] = useState('');

    const addCompetitor = () => {
        if (!newCompetitor.trim()) return;

        const updatedCompetitors = [
            ...config.competitors,
            {
                id: crypto.randomUUID(),
                name: newCompetitor.trim()
            }
        ];

        setConfig({ ...config, competitors: updatedCompetitors });
        setNewCompetitor('');
    };

    const removeCompetitor = (id: string) => {
        const updatedCompetitors = config.competitors.filter(c => c.id !== id);
        setConfig({ ...config, competitors: updatedCompetitors });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCompetitor();
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-blue-900 text-sm">Monitora i Competitor</h3>
                    <p className="text-blue-700 text-sm">
                        Aggiungi i tuoi principali concorrenti per confrontare la loro visibilità con la tua.
                        Analizzeremo come gli LLM rispondono quando vengono chiesti confronti nel tuo settore.
                    </p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aggiungi Competitor
                </label>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={newCompetitor}
                            onChange={(e) => setNewCompetitor(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Es. Competitor X, Inc."
                        />
                    </div>
                    <button
                        onClick={addCompetitor}
                        disabled={!newCompetitor.trim()}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Aggiungi
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {config.competitors.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                        Nessun competitor aggiunto
                    </div>
                ) : (
                    config.competitors.map((competitor) => (
                        <div
                            key={competitor.id}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm group hover:border-purple-200 transition-all"
                        >
                            <span className="font-medium text-gray-900">{competitor.name}</span>
                            <button
                                onClick={() => removeCompetitor(competitor.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


import React from 'react';
import { VisibilityConfig } from '../page';
import { Building2, MessageSquare, Users, Globe } from 'lucide-react';

interface WizardStepReviewProps {
    config: VisibilityConfig;
}

export function WizardStepReview({ config }: WizardStepReviewProps) {
    const activePrompts = config.prompts.filter(p => p.enabled);

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">Riepilogo Configurazione</h2>
                <p className="text-gray-500 mt-1">Controlla i dati prima di avviare il monitoraggio</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Brand Info */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-5 h-5 text-purple-600" />
                        <h3 className="font-semibold text-gray-900">Brand Identity</h3>
                    </div>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Nome Brand</dt>
                            <dd className="font-medium text-gray-900">{config.brandName}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Categoria</dt>
                            <dd className="font-medium text-gray-900">{config.category}</dd>
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                            <dt className="text-gray-500 mb-1">Descrizione</dt>
                            <dd className="text-gray-900 line-clamp-2">{config.description}</dd>
                        </div>
                    </dl>
                </div>

                {/* Settings */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">Impostazioni</h3>
                    </div>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Lingua</dt>
                            <dd className="font-medium text-gray-900 uppercase">{config.language}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Territorio</dt>
                            <dd className="font-medium text-gray-900">{config.territory}</dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Prompts Summary */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        <h3 className="font-semibold text-gray-900">Prompt di Analisi</h3>
                    </div>
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-medium">
                        {activePrompts.length} attivi
                    </span>
                </div>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {activePrompts.length > 0 ? (
                        activePrompts.map((prompt) => (
                            <div key={prompt.id} className="p-4 text-sm text-gray-600">
                                {prompt.text}
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500 text-sm italic">
                            Nessun prompt selezionato
                        </div>
                    )}
                </div>
            </div>

            {/* Competitors Summary */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">Competitor da Monitorare</h3>
                    </div>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                        {config.competitors.length} inclusi
                    </span>
                </div>
                <div className="p-4">
                    {config.competitors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {config.competitors.map((competitor) => (
                                <span
                                    key={competitor.id}
                                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200"
                                >
                                    {competitor.name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 text-sm italic py-2">
                            Nessun competitor aggiunto
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

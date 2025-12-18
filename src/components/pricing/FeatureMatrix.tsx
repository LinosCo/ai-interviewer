'use client';

import { PLANS } from '@/config/plans';
import { Card } from '@/components/ui/business-tuner/Card';
import { Icons } from '@/components/ui/business-tuner/Icons';
import React from 'react';

type Feature = {
    key: string;
    label: string;
    boolean?: boolean;
};

const FEATURE_CATEGORIES: Array<{ name: string; features: Feature[] }> = [
    {
        name: 'Interviste',
        features: [
            { key: 'responsesPerMonth', label: 'Risposte/mese' },
            { key: 'activeInterviews', label: 'Interviste attive' },
            { key: 'users', label: 'Utenti' }
        ]
    },
    {
        name: 'Funzionalità Avanzate',
        features: [
            { key: 'knowledgeBase', label: 'Knowledge Base', boolean: true },
            { key: 'conditionalLogic', label: 'Logica Condizionale', boolean: true },
            { key: 'customBranding', label: 'Branding Personalizzato', boolean: true },
            { key: 'exportData', label: 'Export Dati', boolean: true }
        ]
    },
    {
        name: 'Analytics',
        features: [
            { key: 'sentiment', label: 'Analisi Sentiment', boolean: true },
            { key: 'themeExtraction', label: 'Estrazione Temi', boolean: true },
            { key: 'keyQuotes', label: 'Citazioni Chiave', boolean: true },
            { key: 'trends', label: 'Trend Analysis', boolean: true },
            { key: 'comparison', label: 'Confronto Interviste', boolean: true }
        ]
    },
    {
        name: 'Integrazioni',
        features: [
            { key: 'webhooks', label: 'Webhooks', boolean: true },
            { key: 'api', label: 'API Access', boolean: true },
            { key: 'zapier', label: 'Zapier', boolean: true },
            { key: 'sso', label: 'SSO', boolean: true }
        ]
    }
];

export function FeatureMatrix() {
    const planKeys = ['trial', 'starter', 'pro', 'business'] as const;

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-200">
                        <th className="text-left p-4 font-semibold">Funzionalità</th>
                        {planKeys.map((planKey) => {
                            const plan = PLANS[planKey];
                            return (
                                <th key={planKey} className="p-4 text-center">
                                    <div className="font-semibold text-lg">{plan.name}</div>
                                    <div className="text-2xl font-bold text-amber-600 mt-1">
                                        €{plan.price}
                                    </div>
                                    <div className="text-sm text-gray-600">/mese</div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {FEATURE_CATEGORIES.map((category) => (
                        <React.Fragment key={category.name}>
                            <tr className="bg-gray-50">
                                <td colSpan={5} className="p-3 font-semibold text-gray-700">
                                    {category.name}
                                </td>
                            </tr>
                            {category.features.map((feature) => (
                                <tr key={feature.key} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-4 text-gray-700">{feature.label}</td>
                                    {planKeys.map((planKey) => {
                                        const plan = PLANS[planKey];
                                        const value = feature.boolean
                                            ? plan.features[feature.key as keyof typeof plan.features]
                                            : plan[feature.key as keyof typeof plan];

                                        return (
                                            <td key={planKey} className="p-4 text-center">
                                                {feature.boolean ? (
                                                    value ? (
                                                        <Icons.Check className="w-5 h-5 text-green-600 mx-auto" />
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )
                                                ) : (
                                                    <span className="font-medium">
                                                        {value === -1 ? 'Illimitate' : String(value)}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

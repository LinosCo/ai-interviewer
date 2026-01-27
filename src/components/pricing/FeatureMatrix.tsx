'use client';

import { PLANS, PlanType, PlanConfig } from '@/config/plans';
import { Card } from '@/components/ui/business-tuner/Card';
import { Icons } from '@/components/ui/business-tuner/Icons';
import React from 'react';

type Feature = {
    key: string;
    label: string;
    boolean?: boolean;
    getValue?: (plan: PlanConfig) => string | number | boolean;
};

const FEATURE_CATEGORIES: Array<{ name: string; features: Feature[] }> = [
    {
        name: 'Interviste',
        features: [
            { key: 'maxInterviewsPerMonth', label: 'Interviste/mese', getValue: (p) => p.limits.maxInterviewsPerMonth === -1 ? 'Illimitate' : p.limits.maxInterviewsPerMonth },
            { key: 'maxChatbotSessionsPerMonth', label: 'Sessioni Chatbot/mese', getValue: (p) => p.limits.maxChatbotSessionsPerMonth === -1 ? 'Illimitate' : p.limits.maxChatbotSessionsPerMonth },
        ]
    },
    {
        name: 'Funzionalità Avanzate',
        features: [
            { key: 'visibilityEnabled', label: 'Brand Monitor', boolean: true, getValue: (p) => p.limits.visibilityEnabled },
            { key: 'aiTipsEnabled', label: 'AI Tips', boolean: true, getValue: (p) => p.limits.aiTipsEnabled },
            { key: 'whiteLabelEnabled', label: 'White Label', boolean: true, getValue: (p) => p.limits.whiteLabelEnabled },
            { key: 'canTransferProjects', label: 'Trasferimento Progetti', boolean: true, getValue: (p) => p.limits.canTransferProjects }
        ]
    },
    {
        name: 'Integrazioni',
        features: [
            { key: 'apiAccessEnabled', label: 'API Access', boolean: true, getValue: (p) => p.limits.apiAccessEnabled }
        ]
    }
];

export function FeatureMatrix() {
    const planKeys = [PlanType.STARTER, PlanType.PRO, PlanType.BUSINESS] as const;

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
                                        €{plan.monthlyPrice}
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
                                        const value = feature.getValue ? feature.getValue(plan) : null;

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
                                                        {String(value)}
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

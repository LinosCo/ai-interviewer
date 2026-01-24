'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { PLANS } from '@/config/plans';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan?: string;
    requiredPlan?: string;
    feature?: string;
    reason?: 'feature_locked' | 'limit_reached' | 'manual';
}

export function UpgradeModal({
    isOpen,
    onClose,
    currentPlan = 'trial',
    requiredPlan = 'starter',
    feature,
    reason = 'manual'
}: UpgradeModalProps) {
    if (!isOpen) return null;

    const current = PLANS[currentPlan.toLowerCase() as keyof typeof PLANS];
    const required = PLANS[requiredPlan.toLowerCase() as keyof typeof PLANS];

    const getMessage = () => {
        switch (reason) {
            case 'feature_locked':
                return `La funzionalità "${feature}" non è disponibile nel piano ${current.name}.`;
            case 'limit_reached':
                return `Hai raggiunto il limite del piano ${current.name}.`;
            default:
                return `Passa al piano ${required.name} per sbloccare più funzionalità.`;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <Card className="max-w-2xl w-full p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <Icons.X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.Sparkles className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Sblocca Più Funzionalità</h2>
                    <p className="text-gray-600">{getMessage()}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {/* Current Plan */}
                    <div className="border-2 border-gray-200 rounded-lg p-4">
                        <div className="text-sm text-gray-600 mb-1">Piano Attuale</div>
                        <div className="text-xl font-bold mb-2">{current.name}</div>
                        <div className="text-2xl font-bold text-gray-900 mb-4">
                            €{current.monthlyPrice}
                            <span className="text-sm font-normal text-gray-600">/mese</span>
                        </div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-gray-400" />
                                {current.limits.maxInterviewsPerMonth === -1 ? 'Illimitate' : current.limits.maxInterviewsPerMonth} interviste/mese
                            </li>
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-gray-400" />
                                {current.limits.maxChatbots === -1 ? 'Illimitati' : current.limits.maxChatbots} chatbot
                            </li>
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-gray-400" />
                                {current.limits.maxUsers === -1 ? 'Illimitati' : current.limits.maxUsers} utenti
                            </li>
                        </ul>
                    </div>

                    {/* Recommended Plan */}
                    <div className="border-2 border-amber-500 rounded-lg p-4 relative">
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                Consigliato
                            </span>
                        </div>
                        <div className="text-sm text-amber-600 mb-1">Passa a</div>
                        <div className="text-xl font-bold mb-2">{required.name}</div>
                        <div className="text-2xl font-bold text-amber-600 mb-4">
                            €{required.monthlyPrice}
                            <span className="text-sm font-normal text-gray-600">/mese</span>
                        </div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-green-600" />
                                {required.limits.maxInterviewsPerMonth === -1 ? 'Illimitate' : required.limits.maxInterviewsPerMonth} interviste/mese
                            </li>
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-green-600" />
                                {required.limits.maxChatbots === -1 ? 'Illimitati' : required.limits.maxChatbots} chatbot
                            </li>
                            <li className="flex items-center gap-2">
                                <Icons.Check className="w-4 h-4 text-green-600" />
                                {required.limits.maxUsers === -1 ? 'Illimitati' : required.limits.maxUsers} utenti
                            </li>
                            {required.limits.visibilityEnabled && (
                                <li className="flex items-center gap-2">
                                    <Icons.Check className="w-4 h-4 text-green-600" />
                                    Brand Monitor
                                </li>
                            )}
                            {required.limits.aiTipsEnabled && (
                                <li className="flex items-center gap-2">
                                    <Icons.Check className="w-4 h-4 text-green-600" />
                                    AI Tips
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Forse Dopo
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => window.location.href = '/dashboard/billing/plans'}
                        className="flex-1"
                    >
                        Fai Upgrade Ora
                    </Button>
                </div>
            </Card>
        </div>
    );
}

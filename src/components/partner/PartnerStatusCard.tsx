'use client';

/**
 * PartnerStatusCard
 *
 * Mostra lo status del partner con indicatori visivi per trial,
 * soglie clienti, fee e white label.
 */

import { Users, Clock, Crown, Check, AlertCircle } from 'lucide-react';

interface PartnerStatusCardProps {
    status: 'trial' | 'active' | 'suspended' | 'grace_period' | null;
    trialDaysRemaining: number | null;
    activeClients: number;
    monthlyFee: number;
    hasWhiteLabel: boolean;
    gracePeriodEndDate: Date | null;
    thresholds: {
        freeAccess: { required: number; current: number; met: boolean };
        whiteLabel: { required: number; current: number; met: boolean };
    };
}

export function PartnerStatusCard({
    status,
    trialDaysRemaining,
    activeClients,
    monthlyFee,
    hasWhiteLabel,
    gracePeriodEndDate,
    thresholds
}: PartnerStatusCardProps) {
    const getStatusBadge = () => {
        switch (status) {
            case 'trial':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                        <Clock className="w-4 h-4" />
                        Trial - {trialDaysRemaining} giorni
                    </span>
                );
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                        <Check className="w-4 h-4" />
                        Attivo
                    </span>
                );
            case 'grace_period':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
                        <AlertCircle className="w-4 h-4" />
                        Grace Period
                    </span>
                );
            case 'suspended':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        Sospeso
                    </span>
                );
            default:
                return null;
        }
    };

    const formatGracePeriodEnd = () => {
        if (!gracePeriodEndDate) return '';
        return new Date(gracePeriodEndDate).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long'
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-stone-900">Status Partner</h3>
                {getStatusBadge()}
            </div>

            {/* Trial warning */}
            {status === 'trial' && trialDaysRemaining !== null && trialDaysRemaining <= 14 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-700">
                        <strong>Trial in scadenza:</strong> Hai ancora {trialDaysRemaining} giorni.
                        Raggiungi 3 clienti attivi per accedere gratuitamente.
                    </p>
                </div>
            )}

            {/* Grace period warning */}
            {status === 'grace_period' && gracePeriodEndDate && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-orange-700">
                        <strong>Grace Period:</strong> Hai tempo fino al {formatGracePeriodEnd()} per
                        raggiungere 3 clienti attivi e mantenere l&apos;accesso gratuito.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Active Clients */}
                <div className="bg-stone-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-stone-600" />
                        <span className="text-sm text-stone-600">Clienti Attivi</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">{activeClients}</p>
                </div>

                {/* Monthly Fee */}
                <div className="bg-stone-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-stone-600">Fee Mensile</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">
                        {monthlyFee === 0 ? (
                            <span className="text-green-600">GRATIS</span>
                        ) : (
                            <span>{monthlyFee}€/mese</span>
                        )}
                    </p>
                </div>
            </div>

            {/* Thresholds Progress */}
            <div className="space-y-4">
                {/* Free Access Threshold */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-stone-600">Accesso Gratuito</span>
                        <span className={thresholds.freeAccess.met ? 'text-green-600 font-medium' : 'text-stone-600'}>
                            {thresholds.freeAccess.current}/{thresholds.freeAccess.required} clienti
                        </span>
                    </div>
                    <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${thresholds.freeAccess.met ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{
                                width: `${Math.min((thresholds.freeAccess.current / thresholds.freeAccess.required) * 100, 100)}%`
                            }}
                        />
                    </div>
                    {thresholds.freeAccess.met && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Soglia raggiunta - Accesso gratuito!
                        </p>
                    )}
                </div>

                {/* White Label Threshold */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-500" />
                            <span className="text-stone-600">White Label</span>
                        </div>
                        <span className={thresholds.whiteLabel.met ? 'text-green-600 font-medium' : 'text-stone-600'}>
                            {thresholds.whiteLabel.current}/{thresholds.whiteLabel.required} clienti
                        </span>
                    </div>
                    <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${thresholds.whiteLabel.met ? 'bg-amber-500' : 'bg-stone-400'}`}
                            style={{
                                width: `${Math.min((thresholds.whiteLabel.current / thresholds.whiteLabel.required) * 100, 100)}%`
                            }}
                        />
                    </div>
                    {thresholds.whiteLabel.met ? (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <Crown className="w-3 h-3" /> White Label sbloccato!
                        </p>
                    ) : (
                        <p className="text-xs text-stone-500 mt-1">
                            {thresholds.whiteLabel.required - thresholds.whiteLabel.current} clienti per sbloccare
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PartnerStatusCard;

'use client';

/**
 * PartnerDashboardClient
 *
 * Client component per la dashboard partner con stato interattivo.
 */

import { useState } from 'react';
import { Send, RefreshCcw, Crown, Settings } from 'lucide-react';
import Link from 'next/link';
import { PartnerStatusCard } from '@/components/partner/PartnerStatusCard';
import { ClientsTable } from '@/components/partner/ClientsTable';
import { TransferModal } from '@/components/partner/TransferModal';
import type { PartnerStatus, PartnerClientsSummary } from '@/services/partnerService';

interface PartnerDashboardClientProps {
    partnerStatus: PartnerStatus;
    clientsData: PartnerClientsSummary;
    projects: { id: string; name: string }[];
    pendingInvitesCount: number;
}

export default function PartnerDashboardClient({
    partnerStatus,
    clientsData,
    projects,
    pendingInvitesCount
}: PartnerDashboardClientProps) {
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleTransferSuccess = () => {
        // Trigger refresh by changing key (in a real app, you'd refetch data)
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard Partner</h1>
                        <p className="text-gray-600 mt-2">
                            Gestisci i tuoi clienti e trasferisci progetti
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 px-4 py-2 text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Aggiorna
                        </button>
                        <button
                            onClick={() => setIsTransferModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            Trasferisci Progetto
                        </button>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid gap-6 lg:grid-cols-3 mb-8">
                    {/* Status Card - 1 column */}
                    <div className="lg:col-span-1">
                        <PartnerStatusCard
                            status={partnerStatus.status}
                            trialDaysRemaining={partnerStatus.trialDaysRemaining}
                            activeClients={partnerStatus.activeClients}
                            monthlyFee={partnerStatus.monthlyFee}
                            hasWhiteLabel={partnerStatus.hasWhiteLabel}
                            gracePeriodEndDate={partnerStatus.gracePeriodEndDate}
                            thresholds={clientsData.thresholds}
                        />

                        {/* Quick Actions */}
                        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mt-6">
                            <h3 className="font-semibold text-stone-900 mb-4">Azioni Rapide</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setIsTransferModalOpen(true)}
                                    className="w-full flex items-center gap-3 p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors text-left"
                                >
                                    <Send className="w-5 h-5 text-amber-500" />
                                    <div>
                                        <p className="font-medium text-stone-900">Trasferisci Progetto</p>
                                        <p className="text-xs text-stone-500">Invia un progetto a un cliente</p>
                                    </div>
                                </button>

                                {partnerStatus.hasWhiteLabel && (
                                    <Link
                                        href="/dashboard/partner/branding"
                                        className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                                    >
                                        <Crown className="w-5 h-5 text-amber-500" />
                                        <div>
                                            <p className="font-medium text-stone-900">White Label</p>
                                            <p className="text-xs text-stone-500">Personalizza il tuo branding</p>
                                        </div>
                                    </Link>
                                )}

                                <Link
                                    href="/dashboard/settings"
                                    className="w-full flex items-center gap-3 p-3 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
                                >
                                    <Settings className="w-5 h-5 text-stone-500" />
                                    <div>
                                        <p className="font-medium text-stone-900">Impostazioni</p>
                                        <p className="text-xs text-stone-500">Gestisci il tuo account</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Clients Table - 2 columns */}
                    <div className="lg:col-span-2">
                        <ClientsTable
                            key={refreshKey}
                            clients={clientsData.clients}
                            summary={{
                                ...clientsData.summary,
                                pendingInvites: pendingInvitesCount
                            }}
                        />
                    </div>
                </div>

                {/* Tips Section */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
                    <h3 className="font-semibold text-stone-900 mb-3">Come far crescere il tuo portafoglio</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-white/60 rounded-lg p-4">
                            <p className="text-2xl font-bold text-amber-600 mb-1">1</p>
                            <p className="font-medium text-stone-900 mb-1">Crea progetti template</p>
                            <p className="text-sm text-stone-600">
                                Prepara progetti configurati che puoi trasferire rapidamente ai nuovi clienti.
                            </p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-4">
                            <p className="text-2xl font-bold text-amber-600 mb-1">2</p>
                            <p className="font-medium text-stone-900 mb-1">Invita clienti paganti</p>
                            <p className="text-sm text-stone-600">
                                Solo i clienti con piano STARTER, PRO o BUSINESS contano per le soglie.
                            </p>
                        </div>
                        <div className="bg-white/60 rounded-lg p-4">
                            <p className="text-2xl font-bold text-amber-600 mb-1">3</p>
                            <p className="font-medium text-stone-900 mb-1">Raggiungi 10 clienti</p>
                            <p className="text-sm text-stone-600">
                                Con 10+ clienti attivi sblocchi il White Label e puoi personalizzare il branding.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transfer Modal */}
            <TransferModal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                projects={projects}
                onTransferSuccess={handleTransferSuccess}
            />
        </div>
    );
}

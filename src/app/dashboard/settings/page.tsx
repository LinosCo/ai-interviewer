'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import PlatformSettingsForm from './settings-form';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformSettingsState {
    id?: string;
    methodologyKnowledge?: string;
    strategicPlan?: string;
}

interface GlobalConfigState {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
    googleSerpApiKey?: string;
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    stripePriceStarter?: string;
    stripePriceStarterYearly?: string;
    stripePricePro?: string;
    stripePriceProYearly?: string;
    stripePriceBusiness?: string;
    stripePriceBusinessYearly?: string;
    stripePricePackSmall?: string;
    stripePricePackMedium?: string;
    stripePricePackLarge?: string;
    stripePricePartner?: string;
    stripePricePartnerYearly?: string;
    stripePriceEnterprise?: string;
    stripePriceEnterpriseYearly?: string;
    smtpHost?: string;
    smtpPort?: number | null;
    smtpSecure?: boolean | null;
    smtpUser?: string;
    smtpPass?: string;
    smtpFromEmail?: string;
    smtpNotificationEmail?: string;
    publicDemoBotId?: string;
}

export default function PlatformSettingsPage() {
    const { currentOrganization, loading: orgLoading, isAdmin } = useOrganization();
    const [settings, setSettings] = useState<PlatformSettingsState | null>(null);
    const [globalConfig, setGlobalConfig] = useState<GlobalConfigState | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!currentOrganization) return;
            try {
                setLoading(true);
                const res = await fetch(`/api/organizations/${currentOrganization.id}/settings`, {
                    cache: 'no-store'
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data.settings);
                    setGlobalConfig(data.globalConfig);
                }
            } catch (error) {
                console.error('Error fetching organization settings:', error);
            } finally {
                setLoading(false);
            }
        };

        if (!orgLoading) {
            fetchSettings();
        }
    }, [currentOrganization, orgLoading]);

    if (orgLoading || loading) {
        return (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!currentOrganization) {
        return (
            <div className="max-w-5xl mx-auto p-6 text-center">
                <h1 className="text-2xl font-bold">Seleziona un&apos;organizzazione</h1>
                <p className="text-gray-500 mt-2">Devi selezionare un team per gestire le impostazioni.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        Impostazioni Team: <span className="text-amber-600">{currentOrganization.name}</span>
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Configura la metodologia e il piano strategico per questo spazio di lavoro.
                    </p>
                </div>

                <div className="space-y-6">
                    <PlatformSettingsForm
                        organizationId={currentOrganization.id}
                        isAdmin={isAdmin}
                        currentKnowledge={settings?.methodologyKnowledge || ''}
                        currentStrategicPlan={settings?.strategicPlan || ''}
                        platformOpenaiApiKey={globalConfig?.openaiApiKey || ''}
                        platformAnthropicApiKey={globalConfig?.anthropicApiKey || ''}
                        platformGeminiApiKey={globalConfig?.geminiApiKey}
                        googleSerpApiKey={globalConfig?.googleSerpApiKey}
                        stripeSecretKey={globalConfig?.stripeSecretKey}
                        stripeWebhookSecret={globalConfig?.stripeWebhookSecret}
                        stripePriceStarter={globalConfig?.stripePriceStarter}
                        stripePriceStarterYearly={globalConfig?.stripePriceStarterYearly}
                        stripePricePro={globalConfig?.stripePricePro}
                        stripePriceProYearly={globalConfig?.stripePriceProYearly}
                        stripePriceBusiness={globalConfig?.stripePriceBusiness}
                        stripePriceBusinessYearly={globalConfig?.stripePriceBusinessYearly}
                        stripePricePackSmall={globalConfig?.stripePricePackSmall}
                        stripePricePackMedium={globalConfig?.stripePricePackMedium}
                        stripePricePackLarge={globalConfig?.stripePricePackLarge}
                        stripePricePartner={globalConfig?.stripePricePartner}
                        stripePricePartnerYearly={globalConfig?.stripePricePartnerYearly}
                        stripePriceEnterprise={globalConfig?.stripePriceEnterprise}
                        stripePriceEnterpriseYearly={globalConfig?.stripePriceEnterpriseYearly}
                        smtpHost={globalConfig?.smtpHost}
                        smtpPort={globalConfig?.smtpPort}
                        smtpSecure={globalConfig?.smtpSecure}
                        smtpUser={globalConfig?.smtpUser}
                        smtpPass={globalConfig?.smtpPass}
                        smtpFromEmail={globalConfig?.smtpFromEmail}
                        smtpNotificationEmail={globalConfig?.smtpNotificationEmail}
                        publicDemoBotId={globalConfig?.publicDemoBotId}
                    />
                </div>
            </div>
        </div>
    );
}

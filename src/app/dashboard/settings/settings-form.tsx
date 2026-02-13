'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/toast';

interface PlatformSettingsFormProps {
    organizationId: string;
    currentKnowledge: string;
    currentStrategicPlan: string;

    platformOpenaiApiKey: string;
    platformAnthropicApiKey: string;
    platformGeminiApiKey?: string;
    googleSerpApiKey?: string;
    isAdmin: boolean;

    // Stripe Config (Admin only)
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    stripePriceStarter?: string;
    stripePriceStarterYearly?: string;
    stripePricePro?: string;
    stripePriceProYearly?: string;
    stripePriceBusiness?: string;
    stripePriceBusinessYearly?: string;
    stripePricePartner?: string;
    stripePricePartnerYearly?: string;
    stripePriceEnterprise?: string;
    stripePriceEnterpriseYearly?: string;
    stripePricePackSmall?: string;
    stripePricePackMedium?: string;
    stripePricePackLarge?: string;
    smtpHost?: string;
    smtpPort?: number | null;
    smtpSecure?: boolean | null;
    smtpUser?: string;
    smtpPass?: string;
    smtpFromEmail?: string;
    smtpNotificationEmail?: string;
    publicDemoBotId?: string;
}

interface AdminBot {
    id: string;
    name: string;
    slug: string;
}

export default function PlatformSettingsForm({
    organizationId,
    currentKnowledge,
    currentStrategicPlan,
    platformOpenaiApiKey,
    platformAnthropicApiKey,
    platformGeminiApiKey = '',
    googleSerpApiKey = '',
    isAdmin,
    stripeSecretKey = '',
    stripeWebhookSecret = '',
    stripePriceStarter = '',
    stripePriceStarterYearly = '',
    stripePricePro = '',
    stripePriceProYearly = '',
    stripePriceBusiness = '',
    stripePriceBusinessYearly = '',
    stripePricePartner = '',
    stripePricePartnerYearly = '',
    stripePriceEnterprise = '',
    stripePriceEnterpriseYearly = '',
    stripePricePackSmall = '',
    stripePricePackMedium = '',
    stripePricePackLarge = '',
    smtpHost = '',
    smtpPort = null,
    smtpSecure = null,
    smtpUser = '',
    smtpPass = '',
    smtpFromEmail = '',
    smtpNotificationEmail = '',
    publicDemoBotId = ''
}: PlatformSettingsFormProps) {
    const [knowledge, setKnowledge] = useState(currentKnowledge);
    const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
    const [strategicPlan, setStrategicPlan] = useState(currentStrategicPlan);
    const [isStrategicPlanOpen, setIsStrategicPlanOpen] = useState(false);
    // Don't pre-fill value in input for security/ux, use placeholder. Only set if user types.
    const [openaiKey, setOpenaiKey] = useState(platformOpenaiApiKey);
    const [anthropicKey, setAnthropicKey] = useState(platformAnthropicApiKey);
    const [geminiKey, setGeminiKey] = useState(platformGeminiApiKey);
    const [serpKey, setSerpKey] = useState(googleSerpApiKey);

    // Stripe State
    const [sSecretKey, setSSecretKey] = useState(stripeSecretKey);
    const [sWebhookSecret, setSWebhookSecret] = useState(stripeWebhookSecret);
    const [sPriceStarter, setSPriceStarter] = useState(stripePriceStarter);
    const [sPriceStarterYearly, setSPriceStarterYearly] = useState(stripePriceStarterYearly);
    const [sPricePro, setSPricePro] = useState(stripePricePro);
    const [sPriceProYearly, setSPriceProYearly] = useState(stripePriceProYearly);
    const [sPriceBusiness, setSPriceBusiness] = useState(stripePriceBusiness);
    const [sPriceBusinessYearly, setSPriceBusinessYearly] = useState(stripePriceBusinessYearly);
    const [sPricePartner, setSPricePartner] = useState(stripePricePartner);
    const [sPricePartnerYearly, setSPricePartnerYearly] = useState(stripePricePartnerYearly);
    const [sPriceEnterprise, setSPriceEnterprise] = useState(stripePriceEnterprise);
    const [sPriceEnterpriseYearly, setSPriceEnterpriseYearly] = useState(stripePriceEnterpriseYearly);
    const [sPricePackSmall, setSPricePackSmall] = useState(stripePricePackSmall);
    const [sPricePackMedium, setSPricePackMedium] = useState(stripePricePackMedium);
    const [sPricePackLarge, setSPricePackLarge] = useState(stripePricePackLarge);

    // SMTP State
    const [smtpHostValue, setSmtpHostValue] = useState(smtpHost);
    const [smtpPortValue, setSmtpPortValue] = useState(smtpPort ? String(smtpPort) : '');
    const [smtpSecureValue, setSmtpSecureValue] = useState(
        smtpSecure === null || smtpSecure === undefined ? true : smtpSecure
    );
    const [smtpUserValue, setSmtpUserValue] = useState(smtpUser);
    const [smtpPassValue, setSmtpPassValue] = useState(smtpPass);
    const [smtpFromEmailValue, setSmtpFromEmailValue] = useState(smtpFromEmail);
    const [smtpNotificationEmailValue, setSmtpNotificationEmailValue] = useState(smtpNotificationEmail);
    const [demoBotId, setDemoBotId] = useState(publicDemoBotId);
    const [availableBots, setAvailableBots] = useState<AdminBot[]>([]);
    const [isLoadingBots, setIsLoadingBots] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [emailTestMessage, setEmailTestMessage] = useState<string | null>(null);
    const [emailTestError, setEmailTestError] = useState<string | null>(null);
    const [testEmailTo, setTestEmailTo] = useState('');
    const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
    const [sendTestEmailMessage, setSendTestEmailMessage] = useState<string | null>(null);
    const [sendTestEmailError, setSendTestEmailError] = useState<string | null>(null);

    useEffect(() => {
        if (isAdmin) {
            const fetchBots = async () => {
                setIsLoadingBots(true);
                try {
                    const res = await fetch('/api/admin/bots');
                    if (res.ok) {
                        const data = await res.json();
                        setAvailableBots(data);
                    }
                } catch (error) {
                    console.error('Error fetching admin bots:', error);
                } finally {
                    setIsLoadingBots(false);
                }
            };
            fetchBots();
        }
    }, [isAdmin]);

    const normalize = (value?: string | null) => value ?? '';

    const isDirty = (
        openaiKey !== normalize(platformOpenaiApiKey) ||
        anthropicKey !== normalize(platformAnthropicApiKey) ||
        geminiKey !== normalize(platformGeminiApiKey) ||
        serpKey !== normalize(googleSerpApiKey) ||
        sSecretKey !== normalize(stripeSecretKey) ||
        sWebhookSecret !== normalize(stripeWebhookSecret) ||
        sPriceStarter !== stripePriceStarter ||
        sPriceStarterYearly !== stripePriceStarterYearly ||
        sPricePro !== stripePricePro ||
        sPriceProYearly !== stripePriceProYearly ||
        sPriceBusiness !== stripePriceBusiness ||
        sPriceBusinessYearly !== stripePriceBusinessYearly ||
        sPricePartner !== stripePricePartner ||
        sPricePartnerYearly !== stripePricePartnerYearly ||
        sPriceEnterprise !== stripePriceEnterprise ||
        sPriceEnterpriseYearly !== stripePriceEnterpriseYearly ||
        sPricePackSmall !== stripePricePackSmall ||
        sPricePackMedium !== stripePricePackMedium ||
        sPricePackLarge !== stripePricePackLarge ||
        smtpHostValue !== smtpHost ||
        smtpPortValue !== (smtpPort ? String(smtpPort) : '') ||
        smtpSecureValue !== (smtpSecure === null || smtpSecure === undefined ? true : smtpSecure) ||
        smtpUserValue !== smtpUser ||
        smtpPassValue !== smtpPass ||
        smtpFromEmailValue !== smtpFromEmail ||
        smtpNotificationEmailValue !== smtpNotificationEmail ||
        demoBotId !== publicDemoBotId ||
        knowledge !== currentKnowledge ||
        strategicPlan !== currentStrategicPlan
    );

    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/platform-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    methodologyKnowledge: knowledge,
                    strategicPlan: strategicPlan,
                    platformOpenaiApiKey: openaiKey,
                    platformAnthropicApiKey: anthropicKey,
                    platformGeminiApiKey: geminiKey,
                    googleSerpApiKey: serpKey,

                    // Stripe
                    stripeSecretKey: sSecretKey,
                    stripeWebhookSecret: sWebhookSecret,
                    stripePriceStarter: sPriceStarter,
                    stripePriceStarterYearly: sPriceStarterYearly,
                    stripePricePro: sPricePro,
                    stripePriceProYearly: sPriceProYearly,
                    stripePriceBusiness: sPriceBusiness,
                    stripePriceBusinessYearly: sPriceBusinessYearly,
                    stripePricePartner: sPricePartner,
                    stripePricePartnerYearly: sPricePartnerYearly,
                    stripePriceEnterprise: sPriceEnterprise,
                    stripePriceEnterpriseYearly: sPriceEnterpriseYearly,
                    stripePricePackSmall: sPricePackSmall,
                    stripePricePackMedium: sPricePackMedium,
                    stripePricePackLarge: sPricePackLarge,
                    smtpHost: smtpHostValue,
                    smtpPort: smtpPortValue ? Number(smtpPortValue) : null,
                    smtpSecure: smtpSecureValue,
                    smtpUser: smtpUserValue,
                    smtpPass: smtpPassValue,
                    smtpFromEmail: smtpFromEmailValue,
                    smtpNotificationEmail: smtpNotificationEmailValue,
                    publicDemoBotId: demoBotId
                })
            });

            if (!response.ok) {
                let message = 'Failed to save settings';
                try {
                    const errorData = await response.json();
                    if (errorData?.missingColumns?.length) {
                        message = `Colonne mancanti nel DB: ${errorData.missingColumns.join(', ')}`;
                    } else if (errorData?.error) {
                        message = errorData.error;
                    }
                } catch { }
                throw new Error(message);
            }

            router.refresh();
            showToast('Impostazioni salvate con successo!');
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Errore durante il salvataggio. Riprova.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (confirm('Reset to default methodology knowledge? This will overwrite your current settings.')) {
            setKnowledge(currentKnowledge);
        }
    };

    const handleTestEmailConnection = async () => {
        setIsTestingEmail(true);
        setEmailTestMessage(null);
        setEmailTestError(null);
        try {
            const response = await fetch('/api/platform-settings/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    smtpHost: smtpHostValue || null,
                    smtpPort: smtpPortValue ? Number(smtpPortValue) : null,
                    smtpSecure: smtpSecureValue,
                    smtpUser: smtpUserValue || null,
                    smtpPass: smtpPassValue || null
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || data?.details?.error || 'Connessione email non valida');
            }

            if (data.provider === 'smtp') {
                setEmailTestMessage(`SMTP OK: ${data.details.host}:${data.details.port} (${data.details.secure ? 'secure' : 'starttls/plain'})`);
            } else if (data.provider === 'resend') {
                setEmailTestMessage('Resend configurato correttamente.');
            } else {
                setEmailTestMessage('Provider email configurato correttamente.');
            }
        } catch (error: any) {
            setEmailTestError(error?.message || 'Test connessione fallito');
        } finally {
            setIsTestingEmail(false);
        }
    };

    const handleSendTestEmail = async () => {
        setIsSendingTestEmail(true);
        setSendTestEmailMessage(null);
        setSendTestEmailError(null);
        try {
            const response = await fetch('/api/platform-settings/send-test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testEmailTo.trim(),
                    smtpHost: smtpHostValue || null,
                    smtpPort: smtpPortValue ? Number(smtpPortValue) : null,
                    smtpSecure: smtpSecureValue,
                    smtpUser: smtpUserValue || null,
                    smtpPass: smtpPassValue || null,
                    smtpFromEmail: smtpFromEmailValue || null
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.details || data?.error || 'Invio email di test fallito');
            }
            setSendTestEmailMessage(`Email di test inviata a ${data.to}`);
        } catch (error: any) {
            setSendTestEmailError(error?.message || 'Invio email di test fallito');
        } finally {
            setIsSendingTestEmail(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* API Keys Section */}
            {/* API Keys Section - Visible only to Admins */}
            {isAdmin && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4 text-amber-600">Global API Keys (Admin Only)</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        These keys are used as a fallback for all chatbots created by administrators.
                        <br />
                        <strong>Note:</strong> Regular users must configure their own API keys in their bot settings; these global keys will <strong>not</strong> work for them.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                OpenAI API Key
                                {platformOpenaiApiKey && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={openaiKey}
                                onChange={(e) => setOpenaiKey(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                placeholder={platformOpenaiApiKey ? "•••••••••••••••• (Enter new to replace)" : "sk-..."}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Anthropic API Key
                                {platformAnthropicApiKey && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={anthropicKey}
                                onChange={(e) => setAnthropicKey(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                placeholder={platformAnthropicApiKey ? "•••••••••••••••• (Enter new to replace)" : "sk-ant-..."}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Google Gemini API Key (For Visibility Tracking)
                                {platformGeminiApiKey && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                placeholder={platformGeminiApiKey ? "•••••••••••••••• (Enter new to replace)" : "AIzaSy..."}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Google SERP API Key (Optional - For SEO Tracking)
                                {googleSerpApiKey && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={serpKey}
                                onChange={(e) => setSerpKey(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                placeholder={googleSerpApiKey ? "•••••••••••••••• (Enter new to replace)" : "serpapi_..."}
                            />
                            <p className="text-xs text-gray-500 mt-1">Per ricerche web e SEO tracking (opzionale)</p>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Interview Methodology Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Metodologia interviste</h2>
                    <button
                        onClick={() => setIsKnowledgeOpen(!isKnowledgeOpen)}
                        className="text-sm text-amber-600 font-bold hover:underline"
                    >
                        {isKnowledgeOpen ? 'Nascondi editor' : 'Modifica metodologia'}
                    </button>
                </div>

                {!isKnowledgeOpen ? (
                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                        <p className="text-sm text-stone-500 italic">
                            La metodologia di intervista definisce come l&apos;AI si comporta durante le conversazioni.
                            Clicca su &quot;Modifica metodologia&quot; per visualizzare e cambiare il testo.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            Questa base di conoscenza è inclusa automaticamente in tutti i prompt dei chatbot.
                            Personalizzala per adattarla alla metodologia di intervista della tua organizzazione.
                        </p>
                        <textarea
                            value={knowledge}
                            onChange={(e) => setKnowledge(e.target.value)}
                            className="w-full h-96 border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                            placeholder="Inserisci la metodologia di intervista..."
                        />
                        <div className="mt-4 flex justify-start">
                            <button
                                onClick={handleReset}
                                className="text-xs text-stone-400 hover:text-stone-600 underline"
                            >
                                Ripristina metodologia predefinita
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Strategic Plan Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">Piano Strategico</h2>
                        <p className="text-xs text-gray-500 mt-1">Utilizzato dal Copilot Strategico per interpretare i dati</p>
                    </div>
                    <button
                        onClick={() => setIsStrategicPlanOpen(!isStrategicPlanOpen)}
                        className="text-sm text-amber-600 font-bold hover:underline"
                    >
                        {isStrategicPlanOpen ? 'Nascondi editor' : 'Modifica piano'}
                    </button>
                </div>

                {!isStrategicPlanOpen ? (
                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                        <p className="text-sm text-stone-500 italic">
                            Il piano strategico definisce obiettivi, priorità e linee guida che il Copilot utilizzerà
                            per interpretare i dati e suggerire azioni concrete.
                            Clicca su &quot;Modifica piano&quot; per personalizzarlo.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600 mb-4">
                            Descrivi qui la strategia della tua organizzazione. Il Copilot userà queste informazioni per:
                        </p>
                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
                            <li>Interpretare i dati in linea con i tuoi obiettivi</li>
                            <li>Suggerire azioni concrete e prioritizzate</li>
                            <li>Allineare le raccomandazioni alla tua visione</li>
                        </ul>
                        <textarea
                            value={strategicPlan}
                            onChange={(e) => setStrategicPlan(e.target.value)}
                            className="w-full h-96 border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                            placeholder={`Esempio di piano strategico:

## Visione e Obiettivi
- Diventare leader di mercato nel segmento PMI entro 2 anni
- Aumentare la retention del 20% nel prossimo trimestre
- Espandere in 3 nuovi mercati europei

## Target e Posizionamento
- Target primario: PMI 10-50 dipendenti, settore servizi
- Posizionamento: soluzione premium con supporto dedicato
- Differenziatori: facilità d'uso, integrazione nativa

## Priorità Attuali
1. Migliorare onboarding (troppi abbandoni prima settimana)
2. Ridurre churn cliente enterprise
3. Lanciare feature X richiesta da 40% utenti

## Vincoli e Risorse
- Budget marketing: €50k/trimestre
- Team dev: 5 persone, focus su stabilità
- No investimenti in mercato US per ora

## KPI Chiave
- NPS > 50
- Churn < 5% mensile
- CAC < €200`}
                        />
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-800">
                                <strong>Suggerimento:</strong> Più dettagli fornisci, più il Copilot potrà darti
                                suggerimenti specifici e allineati alla tua strategia. Includi obiettivi, vincoli,
                                priorità e KPI.
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Admin Only: Stripe Configuration */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Stripe Configuration (Admin Only)
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stripe Secret Key
                                {stripeSecretKey && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={sSecretKey}
                                onChange={(e) => setSSecretKey(e.target.value)}
                                placeholder={stripeSecretKey ? "•••••••••••••••• (Enter new to replace)" : "sk_live_..."}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stripe Webhook Secret
                                {stripeWebhookSecret && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                            </label>
                            <input
                                type="password"
                                value={sWebhookSecret}
                                onChange={(e) => setSWebhookSecret(e.target.value)}
                                placeholder={stripeWebhookSecret ? "•••••••••••••••• (Enter new to replace)" : "whsec_..."}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Starter Price ID (Monthly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceStarter}
                                    onChange={(e) => setSPriceStarter(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Starter Price ID (Yearly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceStarterYearly}
                                    onChange={(e) => setSPriceStarterYearly(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pro Price ID (Monthly)
                                </label>
                                <input
                                    type="text"
                                    value={sPricePro}
                                    onChange={(e) => setSPricePro(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pro Price ID (Yearly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceProYearly}
                                    onChange={(e) => setSPriceProYearly(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Business Price ID (Monthly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceBusiness}
                                    onChange={(e) => setSPriceBusiness(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Business Price ID (Yearly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceBusinessYearly}
                                    onChange={(e) => setSPriceBusinessYearly(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Partner Price ID (Monthly)
                                </label>
                                <input
                                    type="text"
                                    value={sPricePartner}
                                    onChange={(e) => setSPricePartner(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Partner Price ID (Yearly)
                                </label>
                                <input
                                    type="text"
                                    value={sPricePartnerYearly}
                                    onChange={(e) => setSPricePartnerYearly(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Enterprise Price ID (Monthly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceEnterprise}
                                    onChange={(e) => setSPriceEnterprise(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Enterprise Price ID (Yearly)
                                </label>
                                <input
                                    type="text"
                                    value={sPriceEnterpriseYearly}
                                    onChange={(e) => setSPriceEnterpriseYearly(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Credit Pack Small Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPricePackSmall}
                                    onChange={(e) => setSPricePackSmall(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Credit Pack Medium Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPricePackMedium}
                                    onChange={(e) => setSPricePackMedium(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Credit Pack Large Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPricePackLarge}
                                    onChange={(e) => setSPricePackLarge(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <h3 className="text-md font-semibold text-gray-900 mb-3">SMTP Transazionali</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                                    <input
                                        type="text"
                                        value={smtpHostValue}
                                        onChange={(e) => setSmtpHostValue(e.target.value)}
                                        placeholder="mail.example.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                                    <input
                                        type="number"
                                        value={smtpPortValue}
                                        onChange={(e) => setSmtpPortValue(e.target.value)}
                                        placeholder="465"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SMTP User
                                        {smtpUser && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={smtpUserValue}
                                        onChange={(e) => setSmtpUserValue(e.target.value)}
                                        placeholder="no-reply@example.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SMTP Password
                                        {smtpPass && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">● Configured</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={smtpPassValue}
                                        onChange={(e) => setSmtpPassValue(e.target.value)}
                                        placeholder={smtpPass ? "•••••••••••••••• (Enter new to replace)" : "Password SMTP"}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Mittente (From)</label>
                                    <input
                                        type="text"
                                        value={smtpFromEmailValue}
                                        onChange={(e) => setSmtpFromEmailValue(e.target.value)}
                                        placeholder="Business Tuner <noreply@example.com>"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Notifiche interne</label>
                                    <input
                                        type="text"
                                        value={smtpNotificationEmailValue}
                                        onChange={(e) => setSmtpNotificationEmailValue(e.target.value)}
                                        placeholder="ops@example.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={smtpSecureValue}
                                            onChange={(e) => setSmtpSecureValue(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        SMTP Secure (TLS/SSL)
                                    </label>
                                </div>
                                <div className="md:col-span-2 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleTestEmailConnection}
                                        disabled={isTestingEmail}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isTestingEmail ? 'Test in corso...' : 'Test connessione email'}
                                    </button>
                                    {emailTestMessage && (
                                        <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                                            {emailTestMessage}
                                        </span>
                                    )}
                                    {emailTestError && (
                                        <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                            {emailTestError}
                                        </span>
                                    )}
                                </div>
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                                    <input
                                        type="email"
                                        value={testEmailTo}
                                        onChange={(e) => setTestEmailTo(e.target.value)}
                                        placeholder="destinatario@test.com"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendTestEmail}
                                        disabled={isSendingTestEmail || !testEmailTo.trim()}
                                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSendingTestEmail ? 'Invio...' : 'Invia email di test'}
                                    </button>
                                    {sendTestEmailMessage && (
                                        <span className="md:col-span-2 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                                            {sendTestEmailMessage}
                                        </span>
                                    )}
                                    {sendTestEmailError && (
                                        <span className="md:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                            {sendTestEmailError}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="pt-6 border-t border-gray-100">
                                <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    Configurazione Landing Page
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black uppercase tracking-wider">Demo Simulator</span>
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Seleziona Bot per la Demo Pubblica
                                        </label>
                                        <select
                                            value={demoBotId || ''}
                                            onChange={(e) => setDemoBotId(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                            disabled={isLoadingBots}
                                        >
                                            <option value="">-- Nessun bot selezionato (Usa default statico) --</option>
                                            {availableBots.map((bot) => (
                                                <option key={bot.id} value={bot.id}>
                                                    {bot.name} ({bot.slug})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Il bot selezionato verrà utilizzato nella pagina `/preview`. Tutte le simulazioni verranno salvate come interviste reali per raccogliere lead e trascrizioni.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                    className="px-8 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-600/20 active:scale-[0.98] transition-all"
                >
                    {isSaving ? 'Salvataggio...' : 'Salva tutte le impostazioni'}
                </button>
            </div>
        </div>
    );
}

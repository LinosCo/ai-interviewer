'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlatformSettingsFormProps {
    userId: string;
    currentKnowledge: string;
    settingsId?: string;

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
}

export default function PlatformSettingsForm({
    userId,
    currentKnowledge,
    settingsId,
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
    stripePriceProYearly = ''
}: PlatformSettingsFormProps) {
    const [knowledge, setKnowledge] = useState(currentKnowledge);
    const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
    // Don't pre-fill value in input for security/ux, use placeholder. Only set if user types.
    const [openaiKey, setOpenaiKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [serpKey, setSerpKey] = useState('');

    // Stripe State
    const [sSecretKey, setSSecretKey] = useState('');
    const [sWebhookSecret, setSWebhookSecret] = useState('');
    const [sPriceStarter, setSPriceStarter] = useState(stripePriceStarter);
    const [sPriceStarterYearly, setSPriceStarterYearly] = useState(stripePriceStarterYearly);
    const [sPricePro, setSPricePro] = useState(stripePricePro);
    const [sPriceProYearly, setSPriceProYearly] = useState(stripePriceProYearly);

    const isDirty = (
        (openaiKey && openaiKey !== platformOpenaiApiKey) ||
        (anthropicKey && anthropicKey !== platformAnthropicApiKey) ||
        (geminiKey && geminiKey !== platformGeminiApiKey) ||
        (serpKey && serpKey !== googleSerpApiKey) ||
        (sSecretKey && sSecretKey !== stripeSecretKey) ||
        (sWebhookSecret && sWebhookSecret !== stripeWebhookSecret) ||
        sPriceStarter !== stripePriceStarter ||
        sPriceStarterYearly !== stripePriceStarterYearly ||
        sPricePro !== stripePricePro ||
        sPriceProYearly !== stripePriceProYearly ||
        knowledge !== currentKnowledge
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
                    userId,
                    settingsId,
                    methodologyKnowledge: knowledge,
                    platformOpenaiApiKey: openaiKey || undefined,
                    platformAnthropicApiKey: anthropicKey || undefined,
                    platformGeminiApiKey: geminiKey || undefined,
                    googleSerpApiKey: serpKey || undefined,

                    // Stripe
                    stripeSecretKey: sSecretKey || undefined,
                    stripeWebhookSecret: sWebhookSecret || undefined,
                    stripePriceStarter: sPriceStarter,
                    stripePriceStarterYearly: sPriceStarterYearly,
                    stripePricePro: sPricePro,
                    stripePriceProYearly: sPriceProYearly
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            router.refresh();
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (confirm('Reset to default methodology knowledge? This will overwrite your current settings.')) {
            setKnowledge(currentKnowledge);
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
                            La metodologia di intervista definisce come l'AI si comporta durante le conversazioni.
                            Clicca su "Modifica metodologia" per visualizzare e cambiare il testo.
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
                        </div>
                    </div>
                </div>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-600/20 active:scale-[0.98] transition-all"
                >
                    {isSaving ? 'Salvataggio...' : 'Salva tutte le impostazioni'}
                </button>
            </div>
        </div>
    );
}

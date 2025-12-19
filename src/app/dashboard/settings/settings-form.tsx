'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlatformSettingsFormProps {
    userId: string;
    currentKnowledge: string;
    settingsId?: string;

    platformOpenaiApiKey: string;
    platformAnthropicApiKey: string;
    isAdmin: boolean;

    // Stripe Config (Admin only)
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    stripePriceStarter?: string;
    stripePricePro?: string;
    stripePriceBusiness?: string;
}

export default function PlatformSettingsForm({
    userId,
    currentKnowledge,
    settingsId,
    platformOpenaiApiKey,
    platformAnthropicApiKey,
    isAdmin,
    stripeSecretKey = '',
    stripeWebhookSecret = '',
    stripePriceStarter = '',
    stripePricePro = '',
    stripePriceBusiness = ''
}: PlatformSettingsFormProps) {
    const [knowledge, setKnowledge] = useState(currentKnowledge);
    // Don't pre-fill value in input for security/ux, use placeholder. Only set if user types.
    const [openaiKey, setOpenaiKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');

    // Stripe State
    const [sSecretKey, setSSecretKey] = useState('');
    const [sWebhookSecret, setSWebhookSecret] = useState('');
    const [sPriceStarter, setSPriceStarter] = useState(stripePriceStarter);
    const [sPricePro, setSPricePro] = useState(stripePricePro);
    const [sPriceBusiness, setSPriceBusiness] = useState(stripePriceBusiness);

    const isDirty = (
        (openaiKey && openaiKey !== platformOpenaiApiKey) ||
        (anthropicKey && anthropicKey !== platformAnthropicApiKey) ||
        (sSecretKey && sSecretKey !== stripeSecretKey) ||
        (sWebhookSecret && sWebhookSecret !== stripeWebhookSecret) ||
        sPriceStarter !== stripePriceStarter ||
        sPricePro !== stripePricePro ||
        sPriceBusiness !== stripePriceBusiness ||
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
                    // If empty string, don't send updates unless we want to clear it?
                    // Actually, if user leaves empty, we assume they don't want to change it.
                    // But if they want to clear it? Hard to say. 
                    // For now, let's send what we have. API should handle partials? 
                    // No, upsert replaces.
                    // But we init with empty. So valid update requires typing.
                    // If empty, pass the original prop value so it doesn't get cleared?
                    // Better: Send only if changed. But this is a simple form.
                    // Let's rely on backend: we send current input. If input is empty, backend should probably ignore OR we send the ORIGINAL if input is empty.
                    platformOpenaiApiKey: openaiKey || undefined, // undefined to not overwrite if empty ? No, backend logic handles specific field update.
                    platformAnthropicApiKey: anthropicKey || undefined,

                    // Stripe
                    stripeSecretKey: sSecretKey || undefined,
                    stripeWebhookSecret: sWebhookSecret || undefined,
                    stripePriceStarter: sPriceStarter, // Prices can be updated directly as strings
                    stripePricePro: sPricePro,
                    stripePriceBusiness: sPriceBusiness
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
                    </div>
                </div>
            )
            }

            {/* Interview Methodology Section */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Interview Methodology</h2>
                <p className="text-sm text-gray-600 mb-4">
                    This knowledge base is automatically included in all chatbot prompts.
                    Customize it to match your organization's interview methodology.
                </p>
                <textarea
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    className="w-full h-96 border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm"
                    placeholder="Enter interview methodology knowledge..."
                />
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Starter Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPriceStarter}
                                    onChange={(e) => setSPriceStarter(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pro Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPricePro}
                                    onChange={(e) => setSPricePro(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Business Price ID
                                </label>
                                <input
                                    type="text"
                                    value={sPriceBusiness}
                                    onChange={(e) => setSPriceBusiness(e.target.value)}
                                    placeholder="price_..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Buttons */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Saving...' : 'Save All Settings'}
                </button>
                <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                    Reset Methodology to Default
                </button>
            </div>
        </div >
    );
}

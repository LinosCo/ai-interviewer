'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlatformSettingsFormProps {
    userId: string;
    currentKnowledge: string;
    settingsId?: string;
    platformOpenaiApiKey: string;
    platformAnthropicApiKey: string;
}

export default function PlatformSettingsForm({
    userId,
    currentKnowledge,
    settingsId,
    platformOpenaiApiKey,
    platformAnthropicApiKey
}: PlatformSettingsFormProps) {
    const [knowledge, setKnowledge] = useState(currentKnowledge);
    const [openaiKey, setOpenaiKey] = useState(platformOpenaiApiKey);
    const [anthropicKey, setAnthropicKey] = useState(platformAnthropicApiKey);
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
                    platformOpenaiApiKey: openaiKey,
                    platformAnthropicApiKey: anthropicKey
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
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">API Keys</h2>
                <p className="text-sm text-gray-600 mb-4">
                    These keys are used as defaults when individual bots don't have their own keys configured.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            OpenAI API Key
                        </label>
                        <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                            placeholder="sk-..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Used as fallback when bot doesn't have its own OpenAI key
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Anthropic API Key
                        </label>
                        <input
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2"
                            placeholder="sk-ant-..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Used as fallback when bot doesn't have its own Anthropic key
                        </p>
                    </div>
                </div>
            </div>

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

            {/* Save Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
    );
}

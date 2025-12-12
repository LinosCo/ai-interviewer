'use client';

import { updateSettingsAction } from '@/app/actions';
import { useState } from 'react';
import { showToast } from '@/components/toast';
import { User } from '@prisma/client';

export default function SettingsForm({ user }: { user: User }) {
    const updateAction = updateSettingsAction.bind(null, user.id);

    const handleSubmit = async (formData: FormData) => {
        await updateAction(formData);
        showToast('✅ System settings saved successfully!', 'success');
    };

    return (
        <form action={handleSubmit} className="bg-white p-6 rounded shadow space-y-6">
            <div>
                <h2 className="text-lg font-semibold border-b pb-2 mb-4">Platform API Keys</h2>
                <p className="text-sm text-gray-500 mb-4">
                    These keys will be used as the default for all bots if not overridden at the bot level.
                    They are also used for system features like "AI Bot Builder" and analytics.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
                    <input
                        type="password"
                        name="platformOpenaiApiKey"
                        defaultValue={(user as any).platformOpenaiApiKey || ''}
                        placeholder="sk-..."
                        className="w-full border p-2 rounded font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">Required for GPT-4 features.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Anthropic API Key</label>
                    <input
                        type="password"
                        name="platformAnthropicApiKey"
                        defaultValue={(user as any).platformAnthropicApiKey || ''}
                        placeholder="sk-ant-..."
                        className="w-full border p-2 rounded font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">Required for Claude features.</p>
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                    Save System Settings
                </button>
            </div>
        </form>
    );
}

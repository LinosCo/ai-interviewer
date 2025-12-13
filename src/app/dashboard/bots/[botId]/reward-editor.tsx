'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RewardConfig {
    id?: string;
    enabled: boolean;
    type: string;
    payload: string;
    displayText?: string | null;
    showOnLanding: boolean;
}

interface RewardEditorProps {
    botId: string;
    rewardConfig?: RewardConfig | null;
}

export default function RewardEditor({ botId, rewardConfig }: RewardEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState<RewardConfig>({
        enabled: rewardConfig?.enabled || false,
        type: rewardConfig?.type || 'coupon',
        payload: rewardConfig?.payload || '',
        displayText: rewardConfig?.displayText || '',
        showOnLanding: rewardConfig?.showOnLanding ?? true
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/bots/${botId}/reward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Failed to save');

            router.refresh();
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving reward config:', error);
            alert('Failed to save reward configuration');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Reward Configuration</h2>
            <p className="text-sm text-gray-500 mb-4">
                Offer rewards to participants who complete the interview.
            </p>

            {!isEditing ? (
                <div className="space-y-4">
                    <div>
                        <div className="text-sm font-medium text-gray-700">Status</div>
                        <div className="text-sm text-gray-600 mt-1">
                            {formData.enabled ? '✅ Enabled' : '❌ Disabled'}
                        </div>
                    </div>
                    {formData.enabled && (
                        <>
                            <div>
                                <div className="text-sm font-medium text-gray-700">Type</div>
                                <div className="text-sm text-gray-600 mt-1 capitalize">{formData.type}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-700">Display Text</div>
                                <div className="text-sm text-gray-600 mt-1">{formData.displayText || 'Not set'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-700">Show on Landing</div>
                                <div className="text-sm text-gray-600 mt-1">{formData.showOnLanding ? 'Yes' : 'No'}</div>
                            </div>
                        </>
                    )}
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        {formData.enabled ? 'Edit Reward' : 'Enable Reward'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="rewardEnabled"
                            checked={formData.enabled}
                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                        />
                        <label htmlFor="rewardEnabled" className="text-sm font-medium">Enable rewards</label>
                    </div>

                    {formData.enabled && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reward Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full border p-2 rounded text-sm"
                                >
                                    <option value="coupon">Coupon Code</option>
                                    <option value="gift_card">Gift Card</option>
                                    <option value="redirect">Redirect URL</option>
                                    <option value="raffle">Raffle Entry</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {formData.type === 'redirect' ? 'Redirect URL' : 'Reward Details'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.payload}
                                    onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                                    className="w-full border p-2 rounded text-sm"
                                    placeholder={
                                        formData.type === 'redirect'
                                            ? 'https://example.com/thank-you'
                                            : 'SAVE20 or reward details'
                                    }
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Display Text (Landing Page)</label>
                                <input
                                    type="text"
                                    value={formData.displayText || ''}
                                    onChange={(e) => setFormData({ ...formData, displayText: e.target.value })}
                                    className="w-full border p-2 rounded text-sm"
                                    placeholder="e.g., Get a 10% discount coupon upon completion"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showOnLanding"
                                    checked={formData.showOnLanding}
                                    onChange={(e) => setFormData({ ...formData, showOnLanding: e.target.checked })}
                                />
                                <label htmlFor="showOnLanding" className="text-sm">Show reward on landing page</label>
                            </div>
                        </>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="text-sm text-gray-600 px-4 py-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

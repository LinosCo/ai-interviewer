'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LegalPrivacyEditorProps {
    botId: string;
    privacyNotice?: string | null;
    dataUsageInfo?: string | null;
    consentText?: string | null;
    showAnonymityInfo: boolean;
    showDataUsageInfo: boolean;
    anonymizationLevel: string;
}

export default function LegalPrivacyEditor({
    botId,
    privacyNotice,
    dataUsageInfo,
    consentText,
    showAnonymityInfo,
    showDataUsageInfo,
    anonymizationLevel
}: LegalPrivacyEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const [formData, setFormData] = useState({
        privacyNotice: privacyNotice || '',
        dataUsageInfo: dataUsageInfo || '',
        consentText: consentText || '',
        showAnonymityInfo,
        showDataUsageInfo,
        anonymizationLevel
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/bots/${botId}/legal`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Failed to save');

            router.refresh();
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving legal settings:', error);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Legal & Privacy</h2>
            <p className="text-sm text-gray-500 mb-4">
                Customize legal information shown to participants.
            </p>

            {!isEditing ? (
                <div className="space-y-4">
                    <div>
                        <div className="text-sm font-medium text-gray-700">Anonymization Level</div>
                        <div className="text-sm text-gray-600 mt-1">{anonymizationLevel}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-700">Show Anonymity Info</div>
                        <div className="text-sm text-gray-600 mt-1">{showAnonymityInfo ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-700">Show Data Usage Info</div>
                        <div className="text-sm text-gray-600 mt-1">{showDataUsageInfo ? 'Yes' : 'No'}</div>
                    </div>
                    {privacyNotice && (
                        <div>
                            <div className="text-sm font-medium text-gray-700">Privacy Notice</div>
                            <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{privacyNotice}</div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        Edit Settings
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Anonymization Level</label>
                        <select
                            value={formData.anonymizationLevel}
                            onChange={(e) => setFormData({ ...formData, anonymizationLevel: e.target.value })}
                            className="w-full border p-2 rounded text-sm"
                        >
                            <option value="none">None</option>
                            <option value="partial">Partial</option>
                            <option value="full">Full</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showAnonymity"
                            checked={formData.showAnonymityInfo}
                            onChange={(e) => setFormData({ ...formData, showAnonymityInfo: e.target.checked })}
                        />
                        <label htmlFor="showAnonymity" className="text-sm">Show anonymity information</label>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showDataUsage"
                            checked={formData.showDataUsageInfo}
                            onChange={(e) => setFormData({ ...formData, showDataUsageInfo: e.target.checked })}
                        />
                        <label htmlFor="showDataUsage" className="text-sm">Show data usage information</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Privacy Notice</label>
                        <textarea
                            value={formData.privacyNotice}
                            onChange={(e) => setFormData({ ...formData, privacyNotice: e.target.value })}
                            className="w-full border p-2 rounded text-sm h-24"
                            placeholder="Your responses are anonymous and will be used for research..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Data Usage Info</label>
                        <textarea
                            value={formData.dataUsageInfo}
                            onChange={(e) => setFormData({ ...formData, dataUsageInfo: e.target.value })}
                            className="w-full border p-2 rounded text-sm h-24"
                            placeholder="Your data will be used to improve our products..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Consent Text</label>
                        <textarea
                            value={formData.consentText}
                            onChange={(e) => setFormData({ ...formData, consentText: e.target.value })}
                            className="w-full border p-2 rounded text-sm h-24"
                            placeholder="By participating, you consent to..."
                        />
                    </div>

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

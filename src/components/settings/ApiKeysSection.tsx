'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';

export function ApiKeysSection() {
    const { data: session } = useSession();
    const [apiKeys, setApiKeys] = useState({
        openai: '',
        anthropic: '',
        google: ''
    });
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkRole = async () => {
            try {
                const response = await fetch('/api/user/settings', { cache: 'no-store' });
                const data = await response.json();
                setIsAdmin(data.role === 'ADMIN');
                const customApiKeys = (data?.customApiKeys && typeof data.customApiKeys === 'object')
                    ? data.customApiKeys
                    : {};
                setApiKeys({
                    openai: typeof customApiKeys.openai === 'string' ? customApiKeys.openai : '',
                    anthropic: typeof customApiKeys.anthropic === 'string' ? customApiKeys.anthropic : '',
                    google: typeof customApiKeys.google === 'string' ? customApiKeys.google : ''
                });
            } catch (error) {
                console.error('Failed to check role:', error);
            } finally {
                setLoading(false);
            }
        };

        if (session?.user) {
            checkRole();
        } else {
            setLoading(false);
        }
    }, [session]);

    // Don't show section if not admin
    if (loading || !isAdmin) {
        return null;
    }

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/user/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customApiKeys: apiKeys
                })
            });

            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Failed to save API keys');
                return;
            }

            alert('API keys saved successfully');
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save API keys');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="p-6">
            <h2 className="text-xl font-semibold mb-2">API Keys Personalizzate</h2>
            <p className="text-gray-600 mb-6">
                Configura chiavi API personalizzate per i provider LLM.
                Queste chiavi verranno usate al posto di quelle di sistema.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        OpenAI API Key
                    </label>
                    <input
                        type="password"
                        value={apiKeys.openai}
                        onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Anthropic API Key
                    </label>
                    <input
                        type="password"
                        value={apiKeys.anthropic}
                        onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
                        placeholder="sk-ant-..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Google AI API Key
                    </label>
                    <input
                        type="password"
                        value={apiKeys.google}
                        onChange={(e) => setApiKeys({ ...apiKeys, google: e.target.value })}
                        placeholder="AIza..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                    ⚠️ Le chiavi API sono sensibili. Assicurati di usare chiavi
                    con i permessi minimi necessari e di ruotarle periodicamente.
                </p>
            </div>

            <div className="mt-6">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    variant="primary"
                >
                    {saving ? 'Salvataggio...' : 'Salva API Keys'}
                </Button>
            </div>
        </Card>
    );
}

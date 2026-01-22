'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ConnectionStatus {
    connection: {
        id: string;
        name: string;
        status: string;
        cmsApiUrl: string;
        cmsDashboardUrl: string | null;
        cmsPublicUrl: string | null;
        apiKeyPreview: string;
        webhookUrl: string;
        lastPingAt: string | null;
        lastSyncAt: string | null;
        lastSyncError: string | null;
        capabilities: string[];
        cmsVersion: string | null;
    };
    google: {
        analyticsConnected: boolean;
        analyticsPropertyId: string | null;
        searchConsoleConnected: boolean;
        searchConsoleSiteUrl: string | null;
    };
    stats: {
        suggestionsPending: number;
        suggestionsPushed: number;
        suggestionsPublished: number;
        suggestionsRejected: number;
        suggestionsFailed: number;
        analyticsRecordsCount: number;
    };
    audit: {
        enabledAt: string;
        enabledBy: string;
        notes: string | null;
    };
}

export default function CMSConnectionDetailPage({ params }: { params: Promise<{ connectionId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    // Get organization ID from connection
    const [orgId, setOrgId] = useState<string | null>(null);

    useEffect(() => {
        loadStatus();
    }, [resolvedParams.connectionId]);

    async function loadStatus() {
        try {
            // First get the connection to find the organization
            const connRes = await fetch(`/api/admin/cms/connections`);
            const connData = await connRes.json();
            const connection = connData.connections?.find((c: any) => c.id === resolvedParams.connectionId);

            if (!connection) {
                setError('Connessione non trovata');
                setLoading(false);
                return;
            }

            setOrgId(connection.organization.id);

            // Now get the full status
            const statusRes = await fetch(`/api/admin/organizations/${connection.organization.id}/cms/status`);
            const statusData = await statusRes.json();

            if (!statusRes.ok) {
                throw new Error(statusData.error || 'Errore nel caricamento');
            }

            setStatus(statusData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleTest() {
        if (!orgId) return;
        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch(`/api/admin/organizations/${orgId}/cms/test`, {
                method: 'POST'
            });
            const data = await res.json();
            setTestResult(data);
            loadStatus(); // Reload status after test
        } catch (err: any) {
            setTestResult({ success: false, message: err.message });
        } finally {
            setTesting(false);
        }
    }

    async function handleConnectGoogle() {
        if (!orgId) return;

        try {
            const res = await fetch(`/api/admin/organizations/${orgId}/cms/google/auth-url`);
            const data = await res.json();

            if (data.authUrl) {
                window.location.href = data.authUrl;
            }
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function handleDisable() {
        if (!orgId || !confirm('Vuoi disabilitare questa connessione?')) return;

        try {
            await fetch(`/api/admin/organizations/${orgId}/cms/disable`, {
                method: 'POST'
            });
            loadStatus();
        } catch (err: any) {
            setError(err.message);
        }
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
                <Link href="/dashboard/admin/cms" className="text-indigo-600 hover:underline mt-4 inline-block">
                    Torna alla lista
                </Link>
            </div>
        );
    }

    if (!status) return null;

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        ACTIVE: 'bg-green-100 text-green-800',
        PARTIAL: 'bg-blue-100 text-blue-800',
        GOOGLE_ONLY: 'bg-purple-100 text-purple-800',
        ERROR: 'bg-red-100 text-red-800',
        DISABLED: 'bg-gray-100 text-gray-800'
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <Link href="/dashboard/admin/cms" className="text-indigo-600 hover:underline text-sm mb-2 inline-block">
                        &larr; Torna alla lista
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">{status.connection.name}</h1>
                    <p className="text-gray-500">{status.connection.cmsApiUrl}</p>
                </div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors[status.connection.status]}`}>
                    {status.connection.status}
                </span>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                        {testResult.message}
                    </p>
                    {testResult.details && (
                        <div className="mt-2 text-sm">
                            {testResult.details.cmsVersion && <p>Versione CMS: {testResult.details.cmsVersion}</p>}
                            {testResult.details.responseTime && <p>Tempo risposta: {testResult.details.responseTime}ms</p>}
                        </div>
                    )}
                </div>
            )}

            {/* Connection Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Informazioni Connessione</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">API Key</p>
                        <p className="font-mono">{status.connection.apiKeyPreview}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Webhook URL</p>
                        <p className="font-mono text-xs break-all">{status.connection.webhookUrl}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Ultimo Ping</p>
                        <p>{status.connection.lastPingAt ? new Date(status.connection.lastPingAt).toLocaleString('it-IT') : '-'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Ultimo Sync</p>
                        <p>{status.connection.lastSyncAt ? new Date(status.connection.lastSyncAt).toLocaleString('it-IT') : '-'}</p>
                    </div>
                    {status.connection.lastSyncError && (
                        <div className="col-span-2">
                            <p className="text-gray-500">Ultimo Errore</p>
                            <p className="text-red-600">{status.connection.lastSyncError}</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {testing ? 'Test in corso...' : 'Test Connessione'}
                    </button>
                </div>
            </div>

            {/* Google Integration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Integrazione Google</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-lg ${status.google.analyticsConnected ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Google Analytics</span>
                            <span className={`text-xs px-2 py-1 rounded ${status.google.analyticsConnected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                {status.google.analyticsConnected ? 'Connesso' : 'Non connesso'}
                            </span>
                        </div>
                        {status.google.analyticsPropertyId && (
                            <p className="text-sm text-gray-500 mt-1">{status.google.analyticsPropertyId}</p>
                        )}
                    </div>
                    <div className={`p-4 rounded-lg ${status.google.searchConsoleConnected ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                            <span className="font-medium">Search Console</span>
                            <span className={`text-xs px-2 py-1 rounded ${status.google.searchConsoleConnected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                {status.google.searchConsoleConnected ? 'Connesso' : 'Non connesso'}
                            </span>
                        </div>
                        {status.google.searchConsoleSiteUrl && (
                            <p className="text-sm text-gray-500 mt-1">{status.google.searchConsoleSiteUrl}</p>
                        )}
                    </div>
                </div>
                <div className="mt-4">
                    <button
                        onClick={handleConnectGoogle}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        {status.google.analyticsConnected ? 'Ricollega Google' : 'Collega Google'}
                    </button>
                </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Statistiche</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-indigo-600">{status.stats.suggestionsPending}</p>
                        <p className="text-sm text-gray-500">In attesa</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-blue-600">{status.stats.suggestionsPushed}</p>
                        <p className="text-sm text-gray-500">Inviati</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">{status.stats.suggestionsPublished}</p>
                        <p className="text-sm text-gray-500">Pubblicati</p>
                    </div>
                </div>
            </div>

            {/* Audit */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Audit</h2>
                <div className="text-sm space-y-2">
                    <p><span className="text-gray-500">Abilitato il:</span> {new Date(status.audit.enabledAt).toLocaleString('it-IT')}</p>
                    <p><span className="text-gray-500">Abilitato da:</span> {status.audit.enabledBy}</p>
                    {status.audit.notes && <p><span className="text-gray-500">Note:</span> {status.audit.notes}</p>}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <button
                    onClick={handleDisable}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                    {status.connection.status === 'DISABLED' ? 'Elimina Connessione' : 'Disabilita'}
                </button>
            </div>
        </div>
    );
}

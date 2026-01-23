'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
    id: string;
    name: string;
    slug: string;
    hasCMSIntegration: boolean;
}

export default function NewCMSConnectionPage() {
    const router = useRouter();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [credentials, setCredentials] = useState<{
        apiKey: string;
        webhookUrl: string;
        webhookSecret: string;
        envSnippet: string;
    } | null>(null);

    const [form, setForm] = useState({
        organizationId: '',
        name: '',
        cmsApiUrl: '',
        cmsDashboardUrl: '',
        cmsPublicUrl: '',
        notes: ''
    });

    useEffect(() => {
        async function loadOrganizations() {
            try {
                const res = await fetch('/api/admin/organizations');
                const data = await res.json();
                // API returns { organizations: [...], pagination: {...} }
                const orgs = data.organizations || [];
                // Filter out organizations that already have CMS integration
                setOrganizations(orgs.filter((o: Organization) => !o.hasCMSIntegration));
            } catch (err) {
                setError('Errore nel caricamento delle organizzazioni');
            } finally {
                setLoading(false);
            }
        }
        loadOrganizations();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const res = await fetch(`/api/admin/organizations/${form.organizationId}/cms/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    cmsApiUrl: form.cmsApiUrl,
                    cmsDashboardUrl: form.cmsDashboardUrl || undefined,
                    cmsPublicUrl: form.cmsPublicUrl || undefined,
                    notes: form.notes || undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Errore nella creazione');
            }

            // Show credentials (only shown once)
            setCredentials(data.credentials);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (credentials) {
        return (
            <div className="p-8 max-w-2xl mx-auto">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold text-green-800 mb-2">Connessione Creata</h2>
                    <p className="text-green-700">
                        Salva queste credenziali. Non verranno mostrate di nuovo.
                    </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                            {credentials.apiKey}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                        <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                            {credentials.webhookUrl}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                        <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                            {credentials.webhookSecret}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Snippet .env (copia nel CMS)
                        </label>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto">
                            {credentials.envSnippet}
                        </pre>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            onClick={() => navigator.clipboard.writeText(credentials.envSnippet)}
                            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                        >
                            Copia .env
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/admin/cms')}
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                        >
                            Vai alla lista
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuova Connessione CMS</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organizzazione *
                    </label>
                    {loading ? (
                        <div className="animate-pulse bg-gray-200 h-10 rounded"></div>
                    ) : (
                        <select
                            value={form.organizationId}
                            onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                            required
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                            <option value="">Seleziona organizzazione...</option>
                            {organizations.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name} ({org.slug})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Connessione *
                    </label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="es. Sito Aziendale"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL API CMS *
                    </label>
                    <input
                        type="url"
                        value={form.cmsApiUrl}
                        onChange={(e) => setForm({ ...form, cmsApiUrl: e.target.value })}
                        placeholder="https://cms.example.com/api/integration"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Endpoint base per le API del CMS
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL Dashboard CMS
                    </label>
                    <input
                        type="url"
                        value={form.cmsDashboardUrl}
                        onChange={(e) => setForm({ ...form, cmsDashboardUrl: e.target.value })}
                        placeholder="https://cms.example.com/dashboard"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL Sito Pubblico
                    </label>
                    <input
                        type="url"
                        value={form.cmsPublicUrl}
                        onChange={(e) => setForm({ ...form, cmsPublicUrl: e.target.value })}
                        placeholder="https://www.example.com"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note Interne
                    </label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Note per uso interno..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                        Annulla
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {submitting ? 'Creazione...' : 'Crea Connessione'}
                    </button>
                </div>
            </form>
        </div>
    );
}

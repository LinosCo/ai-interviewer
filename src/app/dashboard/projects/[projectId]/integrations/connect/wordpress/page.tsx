'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link2, AlertCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showToast } from '@/components/toast';

interface ExistingConnection {
    id: string;
    name: string;
    endpoint: string;
}

interface MCPConnectionSummary {
    id: string;
    type: 'WORDPRESS' | 'WOOCOMMERCE';
    name: string;
    endpoint: string;
}

interface MCPConnectionsResponse {
    connections?: MCPConnectionSummary[];
}

export default function ConnectWordPressPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        baseUrl: '',
        username: '',
        applicationPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [existingConnection, setExistingConnection] = useState<ExistingConnection | null>(null);

    useEffect(() => {
        const loadExistingConnection = async () => {
            try {
                const res = await fetch(`/api/integrations/mcp/connections?projectId=${projectId}`);
                if (!res.ok) return;

                const data = await res.json() as MCPConnectionsResponse;
                const existing = data.connections?.find((c) => c.type === 'WORDPRESS');
                if (!existing) return;

                setExistingConnection({
                    id: existing.id,
                    name: existing.name,
                    endpoint: existing.endpoint,
                });

                setFormData(prev => ({
                    ...prev,
                    name: existing.name || prev.name,
                    baseUrl: existing.endpoint || prev.baseUrl,
                }));
            } catch (err) {
                console.error('Error loading existing WordPress connection:', err);
            }
        };

        loadExistingConnection();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const username = formData.username.trim();
        const applicationPassword = formData.applicationPassword.trim();
        const hasPartialCredentials = Boolean(username) !== Boolean(applicationPassword);
        if (hasPartialCredentials) {
            setError('Per aggiornare le credenziali devi compilare sia username che Application Password.');
            setLoading(false);
            return;
        }

        try {
            const payload: Record<string, unknown> = {
                name: formData.name,
                endpoint: formData.baseUrl,
            };

            if (!existingConnection) {
                payload.projectId = projectId;
                payload.type = 'WORDPRESS';
            }

            if (username && applicationPassword) {
                payload.credentials = {
                    username,
                    applicationPassword,
                };
            }

            const url = existingConnection
                ? `/api/integrations/mcp/connections/${existingConnection.id}`
                : '/api/integrations/mcp/connections';
            const method = existingConnection ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                showToast(
                    existingConnection
                        ? 'Connessione WordPress aggiornata con successo'
                        : 'Connessione WordPress creata con successo'
                );
                router.push(`/dashboard/projects/${projectId}/integrations`);
            } else {
                const data = await res.json().catch(() => null) as { error?: string } | null;
                setError(data?.error || 'Errore durante il salvataggio della connessione');
            }
        } catch {
            setError('Errore di rete');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Torna alle integrazioni
            </button>

            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl">
                        📝
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Connetti WordPress</h1>
                        <p className="text-gray-500">
                            Collega il tuo sito WordPress per pubblicare contenuti e gestire il blog
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome Sito</Label>
                    <Input
                        id="name"
                        placeholder="es. Mio Blog Aziendale"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="baseUrl">URL Sito WordPress</Label>
                    <Input
                        id="baseUrl"
                        placeholder="https://tuosito.it oppure endpoint MCP completo"
                        type="url"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Se inserisci solo il dominio, verrà usato automaticamente <code>/wp-json/mcp/v1</code>.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username WordPress</Label>
                        <Input
                            id="username"
                            placeholder="admin"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required={!existingConnection}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="applicationPassword">Application Password</Label>
                        <Input
                            id="applicationPassword"
                            type="password"
                            placeholder="xxxx xxxx xxxx xxxx"
                            value={formData.applicationPassword}
                            onChange={(e) => setFormData({ ...formData, applicationPassword: e.target.value })}
                            required={!existingConnection}
                        />
                    </div>
                </div>

                {existingConnection && (
                    <p className="text-xs text-gray-500 -mt-2">
                        Lascia username e password vuoti per mantenere le credenziali già salvate.
                    </p>
                )}

                <div className="pt-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Come ottenere la Password Applicativa?
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                            1. Vai nel tuo pannello WordPress {'>'} Utenti {'>'} Profilo.<br />
                            2. Scorri fino alla sezione &quot;Password applicative&quot;.<br />
                            3. Inserisci un nome (es. &quot;Business Tuner&quot;) e clicca su &quot;Aggiungi nuova&quot;.<br />
                            4. Copia il codice generato e incollalo qui sopra.
                        </p>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                Connessione in corso...
                            </>
                        ) : (
                            <>
                                <Link2 className="w-4 h-4 mr-2" />
                                {existingConnection ? 'Aggiorna WordPress' : 'Connetti WordPress'}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

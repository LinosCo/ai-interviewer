'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link2, AlertCircle, ShoppingCart } from 'lucide-react';
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

export default function ConnectWooCommercePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        baseUrl: '',
        consumerKey: '',
        consumerSecret: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [existingConnection, setExistingConnection] = useState<ExistingConnection | null>(null);

    useEffect(() => {
        const loadExistingConnection = async () => {
            try {
                const res = await fetch(`/api/integrations/mcp/connections?projectId=${projectId}`);
                if (!res.ok) return;

                const data = await res.json() as MCPConnectionsResponse;
                const existing = data.connections?.find((c) => c.type === 'WOOCOMMERCE');
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
                console.error('Error loading existing WooCommerce connection:', err);
            }
        };

        loadExistingConnection();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const consumerKey = formData.consumerKey.trim();
        const consumerSecret = formData.consumerSecret.trim();
        const hasPartialCredentials = Boolean(consumerKey) !== Boolean(consumerSecret);
        if (hasPartialCredentials) {
            setError('Per aggiornare le credenziali devi compilare sia Consumer Key che Consumer Secret.');
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
                payload.type = 'WOOCOMMERCE';
            }

            if (consumerKey && consumerSecret) {
                payload.credentials = {
                    consumerKey,
                    consumerSecret,
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
                        ? 'Connessione WooCommerce aggiornata con successo'
                        : 'Connessione WooCommerce creata con successo'
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-2xl">
                        🛒
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Connetti WooCommerce</h1>
                        <p className="text-gray-500">
                            Collega il tuo store eCommerce per gestire prodotti e ordini
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
                    <Label htmlFor="name">Nome Store</Label>
                    <Input
                        id="name"
                        placeholder="es. Mio Store Online"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="baseUrl">URL Store WooCommerce</Label>
                    <Input
                        id="baseUrl"
                        placeholder="https://tuostore.it oppure endpoint MCP completo"
                        type="url"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Se inserisci solo il dominio, verrà usato automaticamente <code>/wp-json/mcp/v1</code>.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="consumerKey">Consumer Key (ck_...)</Label>
                        <Input
                            id="consumerKey"
                            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={formData.consumerKey}
                            onChange={(e) => setFormData({ ...formData, consumerKey: e.target.value })}
                            required={!existingConnection}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="consumerSecret">Consumer Secret (cs_...)</Label>
                        <Input
                            id="consumerSecret"
                            type="password"
                            placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={formData.consumerSecret}
                            onChange={(e) => setFormData({ ...formData, consumerSecret: e.target.value })}
                            required={!existingConnection}
                        />
                    </div>
                </div>

                {existingConnection && (
                    <p className="text-xs text-gray-500 -mt-2">
                        Lascia le API key vuote per mantenere le credenziali già salvate.
                    </p>
                )}

                <div className="pt-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4" />
                            Come ottenere le API Key?
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                            1. Vai nel tuo pannello WordPress {'>'} WooCommerce {'>'} Impostazioni.<br />
                            2. Clicca sulla scheda &quot;Avanzate&quot; e poi su &quot;REST API&quot;.<br />
                            3. Clicca su &quot;Aggiungi chiave&quot;. Inserisci una descrizione e imposta i permessi su &quot;Lettura/Scrittura&quot;.<br />
                            4. Copia la Consumer Key e la Consumer Secret generate.
                        </p>
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 h-11" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                Connessione in corso...
                            </>
                        ) : (
                            <>
                                <Link2 className="w-4 h-4 mr-2" />
                                {existingConnection ? 'Aggiorna WooCommerce' : 'Connetti WooCommerce'}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

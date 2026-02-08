'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { showToast } from '@/components/toast';

export default function ConnectGooglePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        serviceAccountJson: '',
        ga4Enabled: true,
        ga4PropertyId: '',
        gscEnabled: true,
        gscSiteUrl: '',
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/integrations/google/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    serviceAccountJson: formData.serviceAccountJson,
                    ga4PropertyId: formData.ga4Enabled ? formData.ga4PropertyId : undefined,
                    gscSiteUrl: formData.gscEnabled ? formData.gscSiteUrl : undefined,
                }),
            });

            if (res.ok) {
                showToast('Connessione Google configurata con successo');
                router.push(`/dashboard/projects/${projectId}/integrations`);
            } else {
                const data = await res.json();
                setError(data.error || 'Errore durante la configurazione della connessione');
            }
        } catch (err) {
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center text-2xl">
                        🔍
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Connetti Google</h1>
                        <p className="text-gray-500">
                            Configura Google Analytics e Search Console con il tuo Service Account
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
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Configurazione</h3>

                    <div className="space-y-2">
                        <Label htmlFor="json">Service Account JSON</Label>
                        <textarea
                            id="json"
                            rows={8}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 font-mono"
                            placeholder='{ "type": "service_account", ... }'
                            value={formData.serviceAccountJson}
                            onChange={(e) => setFormData({ ...formData, serviceAccountJson: e.target.value })}
                            required
                        />
                        <p className="text-xs text-gray-500">
                            Incolla qui l'intero contenuto del file JSON scaricato dalla Google Cloud Console.
                        </p>
                    </div>
                </div>

                <div className="space-y-6 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Google Analytics 4</Label>
                            <p className="text-xs text-gray-500">Abilita il tracciamento delle visite</p>
                        </div>
                        <Switch
                            checked={formData.ga4Enabled}
                            onCheckedChange={(val) => setFormData({ ...formData, ga4Enabled: val })}
                        />
                    </div>

                    {formData.ga4Enabled && (
                        <div className="space-y-2 pl-4 border-l-2 border-amber-100">
                            <Label htmlFor="ga4">Property ID GA4</Label>
                            <Input
                                id="ga4"
                                placeholder="es. 123456789"
                                value={formData.ga4PropertyId}
                                onChange={(e) => setFormData({ ...formData, ga4PropertyId: e.target.value })}
                                required={formData.ga4Enabled}
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Google Search Console</Label>
                            <p className="text-xs text-gray-500">Abilita l'analisi del posizionamento</p>
                        </div>
                        <Switch
                            checked={formData.gscEnabled}
                            onCheckedChange={(val) => setFormData({ ...formData, gscEnabled: val })}
                        />
                    </div>

                    {formData.gscEnabled && (
                        <div className="space-y-2 pl-4 border-l-2 border-amber-100">
                            <Label htmlFor="gsc">URL Sito (GSC)</Label>
                            <Input
                                id="gsc"
                                placeholder="https://tuosito.it"
                                value={formData.gscSiteUrl}
                                onChange={(e) => setFormData({ ...formData, gscSiteUrl: e.target.value })}
                                required={formData.gscEnabled}
                            />
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Istruzioni Importanti
                        </h4>
                        <div className="text-xs text-amber-800 space-y-2 leading-relaxed">
                            <p>1. Assicurati che l'email del Service Account (presente nel JSON) abbia accesso come <strong>Visualizzatore</strong> nella proprietà GA4.</p>
                            <p>2. Aggiungi lo stesso account come utente su Search Console per l'URL indicato.</p>
                            <p>3. Le API di Analytics e Search Console devono essere attive nel progetto Google Cloud.</p>
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 h-11 shadow-md" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                Configurazione in corso...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                Salva Configurazione Google
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

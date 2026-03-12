'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { showToast } from '@/components/toast';

interface ExistingGoogleConnection {
    id: string;
    serviceAccountEmail: string;
    ga4Enabled: boolean;
    ga4PropertyId: string | null;
    gscEnabled: boolean;
    gscSiteUrl: string | null;
}

export default function ConnectGooglePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [initialLoading, setInitialLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [existingConnection, setExistingConnection] = useState<ExistingGoogleConnection | null>(null);
    const [formData, setFormData] = useState({
        serviceAccountJson: '',
        ga4Enabled: true,
        ga4PropertyId: '',
        gscEnabled: true,
        gscSiteUrl: '',
    });
    const [error, setError] = useState<string | null>(null);

    const docs = {
        serviceAccountsConsole: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
        serviceAccountCreate: 'https://cloud.google.com/iam/docs/service-accounts-create',
        serviceAccountKey: 'https://cloud.google.com/iam/docs/keys-create-delete',
        serviceAccountPolicy: 'https://cloud.google.com/iam/docs/keys-create-delete#allow_sa_key_creation',
        ga4Permissions: 'https://support.google.com/analytics/answer/9305788?hl=it',
        gscPermissions: 'https://support.google.com/webmasters/answer/7687615?hl=it',
        analyticsDataApi: 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com',
        searchConsoleApi: 'https://console.cloud.google.com/apis/library/searchconsole.googleapis.com',
    };

    useEffect(() => {
        let cancelled = false;

        const loadExistingConnection = async () => {
            setInitialLoading(true);
            try {
                const res = await fetch(`/api/integrations/google/connections?projectId=${projectId}`);
                if (!res.ok) {
                    if (!cancelled) {
                        setError('Impossibile leggere la configurazione Google esistente');
                    }
                    return;
                }

                const data = await res.json();
                const connection = data.connection as ExistingGoogleConnection | null;
                if (cancelled) return;

                if (connection) {
                    setExistingConnection(connection);
                    setFormData((prev) => ({
                        ...prev,
                        serviceAccountJson: '',
                        ga4Enabled: connection.ga4Enabled,
                        ga4PropertyId: connection.ga4PropertyId || '',
                        gscEnabled: connection.gscEnabled,
                        gscSiteUrl: connection.gscSiteUrl || '',
                    }));
                }
            } catch {
                if (!cancelled) {
                    setError('Errore di rete durante il caricamento configurazione');
                }
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        };

        loadExistingConnection();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const serviceAccountJson = formData.serviceAccountJson.trim();
            const ga4PropertyId = formData.ga4Enabled ? formData.ga4PropertyId.trim() : '';
            const gscSiteUrl = formData.gscEnabled ? formData.gscSiteUrl.trim() : '';

            if (!existingConnection && !serviceAccountJson) {
                setError('Il Service Account JSON è obbligatorio alla prima configurazione');
                return;
            }

            const res = await fetch(
                existingConnection
                    ? `/api/integrations/google/connections/${existingConnection.id}`
                    : `/api/integrations/google/connections`,
                {
                method: existingConnection ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    ...(serviceAccountJson ? { serviceAccountJson } : {}),
                    ga4PropertyId,
                    gscSiteUrl,
                }),
            });

            if (res.ok) {
                showToast(existingConnection ? 'Connessione Google aggiornata con successo' : 'Connessione Google configurata con successo');
                router.push(`/dashboard/projects/${projectId}/integrations`);
            } else {
                const data = await res.json();
                setError(data.error || 'Errore durante la configurazione della connessione');
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center text-2xl">
                        🔍
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Connetti Google</h1>
                        <p className="text-gray-500">
                            Configura Google Analytics e Search Console con Service Account (JSON richiesto in questa modalità)
                        </p>
                        {existingConnection && (
                            <p className="text-xs text-gray-500 mt-1">
                                Connessione già presente: <span className="font-medium text-gray-700">{existingConnection.serviceAccountEmail}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {initialLoading && (
                <div className="mb-6 bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-lg text-sm">
                    Caricamento configurazione esistente...
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Configurazione</h3>

                    <div className="space-y-2">
                        <Label htmlFor="json">
                            Service Account JSON
                            {existingConnection ? ' (opzionale, solo se vuoi sostituire le credenziali)' : ''}
                        </Label>
                        <textarea
                            id="json"
                            rows={8}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 font-mono"
                            placeholder='{ "type": "service_account", ... }'
                            value={formData.serviceAccountJson}
                            onChange={(e) => setFormData({ ...formData, serviceAccountJson: e.target.value })}
                            required={!existingConnection}
                        />
                        <p className="text-xs text-gray-500">
                            {existingConnection
                                ? 'Per sicurezza il JSON salvato non viene mostrato. Lascia vuoto per mantenerlo, oppure incolla un nuovo JSON per ruotare le credenziali.'
                                : 'Incolla qui l&apos;intero contenuto del file JSON scaricato dalla Google Cloud Console.'}
                        </p>
                        <div className="text-xs text-gray-600 space-y-1">
                            <p>
                                Setup guidato:
                                {' '}
                                <a
                                    href={docs.serviceAccountCreate}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-700 hover:underline inline-flex items-center gap-1"
                                >
                                    crea Service Account
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                {' '}
                                e
                                {' '}
                                <a
                                    href={docs.serviceAccountKey}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-amber-700 hover:underline inline-flex items-center gap-1"
                                >
                                    genera chiave JSON
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                .
                            </p>
                        </div>
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
                            <p className="text-xs text-gray-500">
                                Usa il <strong>Property ID numerico</strong> (es. 123456789), non il Measurement ID (es. G-XXXXXXX).
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Google Search Console</Label>
                            <p className="text-xs text-gray-500">Abilita l&apos;analisi del posizionamento</p>
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
                                placeholder="https://tuosito.it/"
                                value={formData.gscSiteUrl}
                                onChange={(e) => setFormData({ ...formData, gscSiteUrl: e.target.value })}
                                required={formData.gscEnabled}
                            />
                            <p className="text-xs text-gray-500">
                                Formato: <strong>https://dominio.tld/</strong> per URL-prefix (slash finale) oppure <strong>sc-domain:dominio.tld</strong> per proprietà dominio.
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Come creare il JSON (passo-passo)
                        </h4>
                        <div className="text-xs text-blue-900 space-y-2 leading-relaxed">
                            <p>
                                1. Apri
                                {' '}
                                <a
                                    href={docs.serviceAccountsConsole}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    Service Accounts
                                </a>
                                {' '}
                                e seleziona il progetto Google Cloud corretto.
                            </p>
                            <p>
                                2. Se non esiste, crea un Service Account (
                                <a
                                    href={docs.serviceAccountCreate}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    guida ufficiale
                                </a>
                                ).
                            </p>
                            <p>3. Clicca sull&apos;email del Service Account.</p>
                            <p>4. Vai nella tab <strong>Keys</strong> e clicca <strong>Add key</strong> → <strong>Create new key</strong>.</p>
                            <p>5. Seleziona <strong>JSON</strong> e clicca <strong>Create</strong>: il file viene scaricato automaticamente.</p>
                            <p>6. Apri il file `.json`, copia tutto il contenuto e incollalo nel campo qui sopra.</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            Istruzioni Importanti
                        </h4>
                        <div className="text-xs text-amber-800 space-y-2 leading-relaxed">
                            <p>
                                1. Assicurati che l&apos;email del Service Account (presente nel JSON) abbia accesso come <strong>Visualizzatore</strong> nella proprietà GA4.
                                {' '}
                                <a
                                    href={docs.ga4Permissions}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    Guida GA4
                                </a>
                            </p>
                            <p>
                                2. Aggiungi lo stesso account come utente su Search Console per l&apos;URL indicato.
                                {' '}
                                <a
                                    href={docs.gscPermissions}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    Guida GSC
                                </a>
                            </p>
                            <p>
                                3. Le API devono essere attive nel progetto Google Cloud:
                                {' '}
                                <a
                                    href={docs.analyticsDataApi}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    Analytics Data API
                                </a>
                                {' '}
                                e
                                {' '}
                                <a
                                    href={docs.searchConsoleApi}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    Search Console API
                                </a>
                                .
                            </p>
                            <p>
                                4. Se il tasto per creare la chiave è bloccato, verifica la policy
                                {' '}
                                <code>iam.disableServiceAccountKeyCreation</code>
                                {' '}
                                (
                                <a
                                    href={docs.serviceAccountPolicy}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline font-semibold"
                                >
                                    dettagli ufficiali
                                </a>
                                ).
                            </p>
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 h-11 shadow-md" disabled={loading || initialLoading}>
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                Configurazione in corso...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                {existingConnection ? 'Aggiorna Configurazione Google' : 'Salva Configurazione Google'}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

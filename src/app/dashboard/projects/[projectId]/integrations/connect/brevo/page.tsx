'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link2, AlertCircle, Mail, ExternalLink } from 'lucide-react';
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
  type: 'WORDPRESS' | 'WOOCOMMERCE' | 'BREVO';
  name: string;
  endpoint: string;
}

interface MCPConnectionsResponse {
  connections?: MCPConnectionSummary[];
}

export default function ConnectBrevoPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    endpoint: '',
    apiKey: '',
    partnerKey: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [existingConnection, setExistingConnection] = useState<ExistingConnection | null>(null);

  const docs = {
    brevoApi: 'https://developers.brevo.com/docs/getting-started',
    brevoApiKeys: 'https://app.brevo.com/settings/keys/api',
    mcpSpec: 'https://modelcontextprotocol.io/specification',
  };

  useEffect(() => {
    const loadExistingConnection = async () => {
      try {
        const res = await fetch(`/api/integrations/mcp/connections?projectId=${projectId}`);
        if (!res.ok) return;

        const data = await res.json() as MCPConnectionsResponse;
        const existing = data.connections?.find((c) => c.type === 'BREVO');
        if (!existing) return;

        setExistingConnection({
          id: existing.id,
          name: existing.name,
          endpoint: existing.endpoint,
        });

        setFormData((prev) => ({
          ...prev,
          name: existing.name || prev.name,
          endpoint: existing.endpoint || prev.endpoint,
        }));
      } catch (err) {
        console.error('Error loading existing Brevo connection:', err);
      }
    };

    loadExistingConnection();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const apiKey = formData.apiKey.trim();
    const partnerKey = formData.partnerKey.trim();

    const hasAnyCredentialInput = Boolean(apiKey) || Boolean(partnerKey);
    if (!existingConnection && !apiKey) {
      setError('Per creare la connessione Brevo devi inserire una API Key.');
      setLoading(false);
      return;
    }
    if (hasAnyCredentialInput && !apiKey) {
      setError('Se aggiorni le credenziali devi inserire almeno la API Key.');
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        endpoint: formData.endpoint,
      };

      if (!existingConnection) {
        payload.projectId = projectId;
        payload.type = 'BREVO';
      }

      if (hasAnyCredentialInput) {
        payload.credentials = {
          apiKey,
          ...(partnerKey ? { partnerKey } : {}),
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
            ? 'Connessione Brevo aggiornata con successo'
            : 'Connessione Brevo creata con successo'
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connetti Brevo</h1>
            <p className="text-gray-500">
              Collega Brevo via server MCP per email marketing e automazioni
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
          <Label htmlFor="name">Nome Integrazione</Label>
          <Input
            id="name"
            placeholder="es. Brevo Marketing"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endpoint">Endpoint MCP Brevo</Label>
          <Input
            id="endpoint"
            placeholder="https://mcp.example.com/brevo"
            type="url"
            value={formData.endpoint}
            onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Inserisci l&apos;endpoint MCP completo (non la root del sito).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">Brevo API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="xkeysib-..."
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            required={!existingConnection}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partnerKey">Brevo Partner Key (opzionale)</Label>
          <Input
            id="partnerKey"
            type="password"
            placeholder="partner-key opzionale"
            value={formData.partnerKey}
            onChange={(e) => setFormData({ ...formData, partnerKey: e.target.value })}
          />
        </div>

        {existingConnection && (
          <p className="text-xs text-gray-500 -mt-2">
            Lascia API Key e Partner Key vuote per mantenere le credenziali gia salvate.
          </p>
        )}

        <div className="pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Prerequisiti
            </h4>
            <div className="text-xs text-blue-900 leading-relaxed space-y-2">
              <p>
                1. Prepara un server MCP compatibile che esponga tool Brevo.
              </p>
              <p>
                2. Genera una API Key da Brevo e assegnale i permessi necessari.
                {' '}
                <a
                  href={docs.brevoApi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Brevo API Docs
                </a>
                {' '}
                |
                {' '}
                <a
                  href={docs.brevoApiKeys}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Gestione API Key
                </a>
              </p>
              <p>
                3. Verifica che l&apos;endpoint MCP risponda correttamente al protocollo JSON-RPC.
              </p>
            </div>
          </div>

          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-cyan-900 mb-2">
              Guida rapida (step-by-step)
            </h4>
            <div className="text-xs text-cyan-900 leading-relaxed space-y-2">
              <p>
                1. Crea una API key Brevo da <a href={docs.brevoApiKeys} target="_blank" rel="noopener noreferrer" className="underline font-semibold">Settings {'>'} API keys</a>.
              </p>
              <p>
                2. Inserisci un nome connessione chiaro (es. <code>Brevo Marketing IT</code>).
              </p>
              <p>
                3. Inserisci l&apos;URL MCP completo. Esempio valido: <code>https://mcp.tuodominio.it/brevo</code>.
              </p>
              <p>
                4. Incolla la API key nel campo <code>Brevo API Key</code> (formato tipico: <code>xkeysib-...</code>).
              </p>
              <p>
                5. Salva la connessione e poi usa il pulsante <code>Testa</code> dalla schermata integrazioni.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-amber-900 mb-2">
              Troubleshooting rapido
            </h4>
            <div className="text-xs text-amber-900 leading-relaxed space-y-2">
              <p>
                <strong>Errore 401/403:</strong> API key non valida o senza permessi sufficienti. Rigenera la key in Brevo.
              </p>
              <p>
                <strong>Errore endpoint HTML/non JSON:</strong> hai inserito la root del sito e non l&apos;endpoint MCP reale.
              </p>
              <p>
                <strong>Timeout/rete:</strong> verifica DNS, firewall e TLS del server MCP.
              </p>
              <p>
                Riferimento protocollo MCP:
                {' '}
                <a
                  href={docs.mcpSpec}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  specifica ufficiale
                </a>
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 h-11" disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Connessione in corso...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 mr-2" />
                {existingConnection ? 'Aggiorna Brevo' : 'Connetti Brevo'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

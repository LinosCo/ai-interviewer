'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface N8NConnection {
  id: string;
  name: string;
  webhookUrl: string;
  status: 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  lastTriggerAt?: string | null;
  lastError?: string | null;
  triggerOnTips: boolean;
}

interface N8NConnectionResponse {
  connection?: N8NConnection | null;
  error?: string;
  unavailableReason?: string;
  success?: boolean;
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function ConnectN8NPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [webhookUrl, setWebhookUrl] = useState('');
  const [name, setName] = useState('n8n Automation');
  const [triggerOnTips, setTriggerOnTips] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingConnection, setExistingConnection] = useState<N8NConnection | null>(null);

  useEffect(() => {
    const loadExistingConnection = async () => {
      try {
        const res = await fetch(`/api/integrations/n8n/connections?projectId=${projectId}`);
        const data = await readJsonSafely<N8NConnectionResponse>(res);
        if (!res.ok) {
          setError(data?.error || 'Impossibile caricare la configurazione n8n');
          return;
        }
        if (data?.unavailableReason) {
          setError('n8n non è disponibile su questo database finché non vengono applicate le migration.');
          return;
        }
        if (data?.connection) {
          setExistingConnection(data.connection);
          setWebhookUrl(data.connection.webhookUrl);
          setName(data.connection.name);
          setTriggerOnTips(data.connection.triggerOnTips);
        }
      } catch {
        setError('Impossibile caricare la configurazione n8n');
      }
    };

    loadExistingConnection();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/integrations/n8n/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name,
          webhookUrl,
          triggerOnTips,
        }),
      });

      const data = await readJsonSafely<N8NConnectionResponse>(res);
      if (!res.ok) {
        throw new Error(data?.error || 'Errore durante il salvataggio');
      }

      if (!data?.connection) {
        throw new Error('Risposta non valida dal server n8n');
      }

      setExistingConnection(data.connection);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!existingConnection) return;

    setTesting(true);
    setError(null);

    try {
      const res = await fetch(`/api/integrations/n8n/connections/${existingConnection.id}/test`, {
        method: 'POST',
      });

      const data = await readJsonSafely<N8NConnectionResponse>(res);

      if (!res.ok) {
        setError(data?.error || 'Test fallito');
        return;
      }
      if (!data) {
        setError('Risposta non valida durante il test');
        return;
      }

      if (data.success) {
        setSuccess(true);
        // Refresh connection status
        const refreshRes = await fetch(`/api/integrations/n8n/connections?projectId=${projectId}`);
        const refreshData = await readJsonSafely<N8NConnectionResponse>(refreshRes);
        setExistingConnection(refreshData?.connection || null);
      } else {
        setError(data.error || 'Test fallito');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante il test');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alle integrazioni
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-3xl">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connetti n8n</h1>
            <p className="text-gray-500">Automatizza la pubblicazione dei contenuti sui social</p>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-teal-900 mb-2">Come funziona</h3>
          <ol className="list-decimal list-inside text-sm text-teal-800 space-y-1">
            <li>Crea un workflow in n8n con un trigger Webhook</li>
            <li>Copia l&apos;URL del webhook qui sotto</li>
            <li>Configura le azioni nel workflow (es. pubblica su LinkedIn, Twitter, ecc.)</li>
            <li>Quando vengono generate AI Tips, il webhook viene chiamato automaticamente</li>
          </ol>
          <a
            href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800 mt-3"
          >
            Documentazione n8n Webhook
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Connessione salvata!</p>
              <p className="text-sm text-green-700">Prova il webhook per verificare che funzioni correttamente.</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Errore</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nome connessione
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Social Media Automation"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL *
            </label>
            <input
              type="url"
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://n8n.example.com/webhook/..."
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              L&apos;URL del webhook n8n che riceverà le notifiche
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="triggerOnTips"
              checked={triggerOnTips}
              onChange={(e) => setTriggerOnTips(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="triggerOnTips" className="text-sm text-gray-700">
              Attiva automaticamente quando vengono generate nuove AI Tips
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !webhookUrl}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvataggio...' : existingConnection ? 'Aggiorna connessione' : 'Salva connessione'}
            </button>

            {existingConnection && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {testing ? 'Test in corso...' : 'Testa webhook'}
              </button>
            )}
          </div>
        </form>

        {/* Connection status */}
        {existingConnection && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Stato connessione</h3>
            <div className="flex items-center gap-2">
              {existingConnection.status === 'ACTIVE' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-700">Connesso e funzionante</span>
                </>
              )}
              {existingConnection.status === 'PENDING' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-sm text-yellow-700">In attesa di test</span>
                </>
              )}
              {existingConnection.status === 'ERROR' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm text-red-700">Errore: {existingConnection.lastError}</span>
                </>
              )}
            </div>
            {existingConnection.lastTriggerAt && (
              <p className="mt-2 text-xs text-gray-500">
                Ultimo trigger: {new Date(existingConnection.lastTriggerAt).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        )}

        {/* Payload example */}
        <div className="mt-8 bg-gray-900 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Esempio payload inviato al webhook</h3>
          <pre className="text-xs text-green-400 overflow-x-auto">
{`{
  "event": "ai_tips_generated",
  "timestamp": "2024-01-15T10:30:00Z",
  "project": {
    "id": "clx...",
    "name": "My Project"
  },
  "tips": [
    {
      "id": "tip_123",
      "title": "Titolo del tip",
      "content": "Contenuto da pubblicare...",
      "platform": "linkedin",
      "suggestedHashtags": ["#AI", "#Marketing"]
    }
  ]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

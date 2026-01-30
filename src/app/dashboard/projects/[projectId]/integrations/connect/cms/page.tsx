'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Check, AlertCircle, Building2 } from 'lucide-react';

interface CMSConnection {
  id: string;
  name: string;
  status: string;
  cmsApiUrl: string;
  cmsDashboardUrl?: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
  };
}

export default function ConnectCMSPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [associating, setAssociating] = useState(false);
  const [availableConnections, setAvailableConnections] = useState<CMSConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [projectOrg, setProjectOrg] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      // Fetch project info to get organization
      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        if (projectData.project?.organization) {
          setProjectOrg(projectData.project.organization);

          // Fetch available CMS connections for this organization
          const connectionsRes = await fetch(`/api/cms/available?organizationId=${projectData.project.organization.id}`);
          if (connectionsRes.ok) {
            const connectionsData = await connectionsRes.json();
            setAvailableConnections(connectionsData.connections || []);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleAssociate = async () => {
    if (!selectedConnectionId) {
      setError('Seleziona una connessione');
      return;
    }

    setAssociating(true);
    setError(null);

    try {
      const res = await fetch(`/api/cms/${selectedConnectionId}/projects/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          role: 'OWNER',
        }),
      });

      if (res.ok) {
        router.push(`/dashboard/projects/${projectId}/integrations`);
      } else {
        const data = await res.json();
        setError(data.error || 'Errore durante l\'associazione');
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setAssociating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna alle integrazioni
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl">
            🚀
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connetti CMS Voler.ai</h1>
            <p className="text-gray-500">
              Associa una connessione CMS esistente a questo progetto
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Organization Info */}
      {projectOrg && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-gray-500" />
          <div>
            <p className="text-sm text-gray-500">Organizzazione</p>
            <p className="font-medium text-gray-900">{projectOrg.name}</p>
          </div>
        </div>
      )}

      {/* Available Connections */}
      {availableConnections.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Connessioni disponibili</h2>

          <div className="space-y-3">
            {availableConnections.map((conn) => (
              <label
                key={conn.id}
                className={`block border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedConnectionId === conn.id
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="connection"
                    value={conn.id}
                    checked={selectedConnectionId === conn.id}
                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                    className="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{conn.name}</p>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          conn.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {conn.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{conn.cmsApiUrl}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleAssociate}
            disabled={!selectedConnectionId || associating}
            className="w-full mt-6 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {associating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Associazione in corso...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Associa al progetto
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Link2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nessuna connessione disponibile
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Non ci sono connessioni CMS disponibili per questa organizzazione.
            Contatta il supporto per configurare una nuova connessione CMS.
          </p>
        </div>
      )}
    </div>
  );
}

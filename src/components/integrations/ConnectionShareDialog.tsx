'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users, AlertCircle, Check } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  organizationId?: string;
}

interface AssociatedProject {
  projectId: string;
  projectName: string;
  role: string;
  associatedAt: Date;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface ConnectionShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
  connectionType: 'CMS' | 'MCP';
  currentProjectId: string;
  availableProjects: Project[];
  onRefresh: () => void;
}

export function ConnectionShareDialog({
  isOpen,
  onClose,
  connectionId,
  connectionName,
  connectionType,
  currentProjectId,
  availableProjects,
  onRefresh,
}: ConnectionShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [associatedProjects, setAssociatedProjects] = useState<AssociatedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'EDITOR' | 'OWNER'>('VIEWER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiBase = connectionType === 'CMS'
    ? `/api/cms/${connectionId}`
    : `/api/integrations/mcp/${connectionId}`;

  useEffect(() => {
    if (isOpen) {
      fetchAssociatedProjects();
    }
  }, [isOpen]);

  const fetchAssociatedProjects = async () => {
    try {
      const res = await fetch(`${apiBase}/projects`);
      if (res.ok) {
        const data = await res.json();
        setAssociatedProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching associated projects:', err);
    }
  };

  const handleAssociate = async () => {
    if (!selectedProjectId) {
      setError('Seleziona un progetto');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/projects/associate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          role: selectedRole,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Progetto associato con successo!');
        setSelectedProjectId('');
        setSelectedRole('VIEWER');
        await fetchAssociatedProjects();
        onRefresh();

        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Errore durante l\'associazione');
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleDissociate = async (projectId: string) => {
    if (!confirm('Sei sicuro di voler dissociare questo progetto?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${apiBase}/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSuccess('Progetto dissociato con successo!');
        await fetchAssociatedProjects();
        onRefresh();

        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Errore durante la dissociazione');
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  // Filter out already associated projects
  const availableToAssociate = availableProjects.filter(
    (p) => !associatedProjects.some((ap) => ap.projectId === p.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6" />
                Gestisci Condivisione
              </h2>
              <p className="text-indigo-100 mt-1">
                {connectionName} ({connectionType})
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5" />
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Add New Association */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Associa Nuovo Progetto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Progetto
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading || availableToAssociate.length === 0}
                >
                  <option value="">Seleziona progetto...</option>
                  {availableToAssociate.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ruolo
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="VIEWER">Viewer (Solo lettura)</option>
                  <option value="EDITOR">Editor (Lettura e scrittura)</option>
                  <option value="OWNER">Owner (Controllo completo)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAssociate}
              disabled={loading || !selectedProjectId || availableToAssociate.length === 0}
              className="mt-3 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Associa Progetto
            </button>

            {availableToAssociate.length === 0 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                Tutti i progetti disponibili sono già associati
              </p>
            )}
          </div>

          {/* Associated Projects List */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Progetti Associati ({associatedProjects.length})
            </h3>

            {associatedProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nessun progetto associato</p>
                <p className="text-sm mt-1">
                  Aggiungi il primo progetto qui sopra
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {associatedProjects.map((ap) => {
                  const isCurrent = ap.projectId === currentProjectId;

                  return (
                    <div
                      key={ap.projectId}
                      className={`border rounded-lg p-4 flex items-center justify-between ${
                        isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {ap.projectName}
                          </p>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                              Corrente
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                            {ap.role}
                          </span>
                          {ap.organization && (
                            <span className="text-xs">
                              Org: {ap.organization.name}
                            </span>
                          )}
                          <span className="text-xs">
                            {new Date(ap.associatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDissociate(ap.projectId)}
                        disabled={loading}
                        className="ml-4 text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title="Dissoccia progetto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

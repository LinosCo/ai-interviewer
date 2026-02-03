'use client';

import { useState } from 'react';
import { X, ArrowRight, Building2, AlertTriangle, Check } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface ConnectionTransferOrgDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
  connectionType: 'CMS' | 'MCP';
  currentOrgId: string;
  currentOrgName: string;
  availableOrganizations: Organization[];
  onSuccess: () => void;
}

export function ConnectionTransferOrgDialog({
  isOpen,
  onClose,
  connectionId,
  connectionName,
  connectionType,
  currentOrgId,
  currentOrgName,
  availableOrganizations,
  onSuccess,
}: ConnectionTransferOrgDialogProps) {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const apiBase = connectionType === 'CMS'
    ? `/api/cms/${connectionId}`
    : `/api/integrations/mcp/${connectionId}`;

  const targetOrg = availableOrganizations.find((o) => o.id === selectedOrgId);

  const handleTransfer = async () => {
    if (!selectedOrgId || !confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/transfer-organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetOrganizationId: selectedOrgId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Errore durante il trasferimento');
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedOrgId('');
    setConfirmed(false);
    setError(null);
    onClose();
  };

  // Filter out current org
  const availableTargetOrgs = availableOrganizations.filter(
    (o) => o.id !== currentOrgId
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                Trasferisci Organizzazione
              </h2>
              <p className="text-orange-100 mt-1">
                {connectionName} ({connectionType})
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Attenzione</p>
              <p>
                Il trasferimento rimuoverà tutte le associazioni progetti esistenti
                e trasferirà la connessione all&apos;organizzazione selezionata.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Transfer Flow */}
          <div className="space-y-4">
            {/* Current Org */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organizzazione Attuale
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-900">{currentOrgName}</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>

            {/* Target Org */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organizzazione Destinazione *
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => {
                  setSelectedOrgId(e.target.value);
                  setConfirmed(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading || availableTargetOrgs.length === 0}
              >
                <option value="">Seleziona organizzazione...</option>
                {availableTargetOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {availableTargetOrgs.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Non ci sono altre organizzazioni disponibili
                </p>
              )}
            </div>
          </div>

          {/* Confirmation */}
          {selectedOrgId && targetOrg && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Confermo di voler trasferire questa connessione da{' '}
                  <strong>{currentOrgName}</strong> a{' '}
                  <strong>{targetOrg.name}</strong>. Le associazioni progetti
                  attuali verranno rimosse.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedOrgId || !confirmed || loading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Trasferimento...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Conferma Trasferimento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

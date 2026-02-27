'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import { CONTENT_KIND_LABELS, ALL_CONTENT_KINDS, type ContentKind } from '@/lib/cms/content-kinds';

interface TipRoutingRule {
  id: string;
  contentKind: string;
  behavior: string;
  mcpTool?: string | null;
  label?: string | null;
  enabled: boolean;
  priority: number;
  mcpConnection?: { id: string; name: string; type: string; status: string } | null;
  cmsConnection?: { id: string; name: string; status: string } | null;
  n8nConnection?: { id: string; name: string; status: string } | null;
}

interface Connection {
  id: string;
  name: string;
  type?: string;
  status: string;
}

interface AiRoutingTabProps {
  projectId: string;
  mcpConnections: Connection[];
  cmsConnection: Connection | null;
  n8nConnection: Connection | null;
}

const DEFAULT_FORM = {
  contentKind: '' as ContentKind | '',
  behavior: 'create_post',
  mcpTool: '',
  label: '',
  selectedConnectionId: '',
  destinationType: '' as 'mcp' | 'cms' | 'n8n' | '',
};

export function AiRoutingTab({
  projectId,
  mcpConnections,
  cmsConnection,
  n8nConnection,
}: AiRoutingTabProps) {
  const [rules, setRules] = useState<TipRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // All active connections for destination picker
  const availableDestinations = [
    ...mcpConnections
      .filter(c => c.status === 'ACTIVE')
      .map(c => ({ id: c.id, name: c.name, destType: 'mcp' as const, badge: c.type || 'MCP' })),
    ...(cmsConnection?.status === 'ACTIVE'
      ? [{ id: cmsConnection.id, name: cmsConnection.name, destType: 'cms' as const, badge: 'CMS' }]
      : []),
    ...(n8nConnection?.status === 'ACTIVE'
      ? [{ id: n8nConnection.id, name: n8nConnection.name, destType: 'n8n' as const, badge: 'n8n' }]
      : []),
  ];

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tip-routing-rules`);
      const data = await res.json();
      setRules(data.rules || []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (rule: TipRoutingRule) => {
    // Optimistic update
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    await fetch(`/api/projects/${projectId}/tip-routing-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
  };

  const handleDelete = async (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    await fetch(`/api/projects/${projectId}/tip-routing-rules/${ruleId}`, { method: 'DELETE' });
  };

  const handleSave = async () => {
    if (!formData.contentKind || !formData.selectedConnectionId || !formData.destinationType) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        contentKind: formData.contentKind,
        behavior: formData.behavior,
        label: formData.label || null,
      };
      if (formData.destinationType === 'mcp') {
        body.mcpConnectionId = formData.selectedConnectionId;
        body.mcpTool = formData.mcpTool || null;
      } else if (formData.destinationType === 'cms') {
        body.cmsConnectionId = formData.selectedConnectionId;
      } else if (formData.destinationType === 'n8n') {
        body.n8nConnectionId = formData.selectedConnectionId;
      }

      const res = await fetch(`/api/projects/${projectId}/tip-routing-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setRules(prev => [...prev, data.rule]);
        setShowForm(false);
        setFormData(DEFAULT_FORM);
      }
    } finally {
      setSaving(false);
    }
  };

  const getDestLabel = (rule: TipRoutingRule) => {
    if (rule.mcpConnection) return `${rule.mcpConnection.name} (${rule.mcpConnection.type || 'MCP'})`;
    if (rule.cmsConnection) return `${rule.cmsConnection.name} (CMS)`;
    if (rule.n8nConnection) return `${rule.n8nConnection.name} (n8n)`;
    return '—';
  };

  const canSave = Boolean(formData.contentKind && formData.selectedConnectionId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto pt-6 pb-8 space-y-6"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
            Regole di distribuzione AI
          </p>
          <p className="text-sm text-gray-500">
            Instrada automaticamente i contenuti AI generati verso le tue integrazioni attive.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Plus size={15} />
            Nuova regola
          </button>
        )}
      </div>

      {/* Empty state */}
      {!loading && rules.length === 0 && !showForm && (
        <div className="p-12 text-center bg-white border border-gray-100 rounded-[2.5rem]">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={22} className="text-blue-500" />
          </div>
          <p className="font-semibold text-gray-700 mb-1">Nessuna regola configurata</p>
          <p className="text-sm text-gray-400 mb-5 max-w-xs mx-auto">
            Crea regole per distribuire automaticamente i tip AI verso WordPress, il tuo CMS o n8n.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Crea la prima regola →
          </button>
        </div>
      )}

      {/* Rules list */}
      {!loading && rules.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Regole attive ({rules.filter(r => r.enabled).length}/{rules.length})
          </p>
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`p-5 bg-white border rounded-[2rem] flex items-center gap-4 transition-all duration-200
                ${rule.enabled ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-40'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {CONTENT_KIND_LABELS[rule.contentKind as ContentKind] || rule.contentKind}
                  </span>
                  {rule.label && (
                    <span className="text-xs text-gray-400">{rule.label}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  → {getDestLabel(rule)}
                  {rule.mcpTool && (
                    <span className="text-gray-400 ml-1 text-xs">· {rule.mcpTool}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggle(rule)}
                  className={`p-1 rounded-lg transition-colors ${rule.enabled ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}
                  title={rule.enabled ? 'Disabilita' : 'Abilita'}
                >
                  {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1 rounded-lg text-gray-300 hover:text-red-400 transition-colors"
                  title="Elimina regola"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add rule form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-8 bg-white border border-blue-100 rounded-[2.5rem] shadow-sm space-y-5"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Nuova regola
            </p>

            {/* Content kind */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Tipo di contenuto AI
              </label>
              <select
                value={formData.contentKind}
                onChange={e => setFormData(prev => ({ ...prev, contentKind: e.target.value as ContentKind }))}
                className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona tipo…</option>
                {ALL_CONTENT_KINDS.map(kind => (
                  <option key={kind} value={kind}>
                    {CONTENT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Destinazione
              </label>
              {availableDestinations.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 border border-amber-100">
                  Nessuna integrazione attiva. Configura prima una connessione nel tab Connessioni.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableDestinations.map(dest => (
                    <label
                      key={dest.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors
                        ${formData.selectedConnectionId === dest.id
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <input
                        type="radio"
                        name="destination"
                        value={dest.id}
                        checked={formData.selectedConnectionId === dest.id}
                        onChange={() => setFormData(prev => ({
                          ...prev,
                          selectedConnectionId: dest.id,
                          destinationType: dest.destType,
                        }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">{dest.name}</span>
                      <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                        {dest.badge}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* MCP tool — only for MCP destinations */}
            {formData.destinationType === 'mcp' && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                  Nome tool MCP
                </label>
                <input
                  type="text"
                  placeholder="es. wordpress_create_post"
                  value={formData.mcpTool}
                  onChange={e => setFormData(prev => ({ ...prev, mcpTool: e.target.value }))}
                  className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Il nome esatto del tool esposto dal server MCP (visible in Configura → Strumenti disponibili).
                </p>
              </div>
            )}

            {/* Optional label */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Etichetta <span className="text-gray-300 font-normal normal-case">(opzionale)</span>
              </label>
              <input
                type="text"
                placeholder="es. Blog WordPress produzione"
                value={formData.label}
                onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))}
                className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvataggio…' : 'Salva regola'}
              </button>
              <button
                onClick={() => { setShowForm(false); setFormData(DEFAULT_FORM); }}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2.5 transition-colors"
              >
                Annulla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

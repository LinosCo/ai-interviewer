'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, Pencil, FlaskConical, Loader2 } from 'lucide-react';
import { CONTENT_KIND_LABELS, ALL_CONTENT_KINDS, type ContentKind } from '@/lib/cms/content-kinds';
import {
  ROUTING_TIP_CATEGORY_LABELS,
  ROUTING_TIP_CATEGORY_ORDER,
  getContentKindCategory,
  getContentKindRoutingDisplayLabel,
  getContentKindSuggestedConnectionsLabel,
} from '@/lib/cms/tip-routing-taxonomy';

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

interface RoutingCoverageItem {
  category: string;
  label: string;
  tipCount: number;
  mappedContentKinds: string[];
  coveredKinds: string[];
  isCovered: boolean;
}

interface RoutingHistoryItem {
  contentKind: string;
  category: string | null;
  draftReady: number;
  sent: number;
  discarded: number;
  total: number;
  latestAt: string | null;
}

interface SentContentHistoryItem {
  id: string;
  title: string;
  contentKind: string;
  category: string | null;
  status: 'PUSHED' | 'PUBLISHED';
  cmsContentId: string | null;
  previewUrl: string | null;
  sentAt: string;
}

interface ActionHistoryItem {
  id: string;
  at: string;
  action: string;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  ruleId: string | null;
  contentKind: string | null;
  destination: 'mcp' | 'cms' | 'n8n' | null;
}

type DestinationType = 'mcp' | 'cms' | 'n8n';

interface DestinationOption {
  id: string;
  name: string;
  destType: DestinationType;
  badge: string;
}

interface ContentKindOptionGroup {
  category: string;
  label: string;
  kinds: ContentKind[];
}

const DEFAULT_FORM = {
  contentKind: '' as ContentKind | '',
  behavior: 'create_post',
  mcpTool: '',
  label: '',
  selectedConnectionId: '',
  destinationType: '' as DestinationType | '',
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
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverage, setCoverage] = useState<RoutingCoverageItem[]>([]);
  const [historyByKind, setHistoryByKind] = useState<RoutingHistoryItem[]>([]);
  const [sentContentHistory, setSentContentHistory] = useState<SentContentHistoryItem[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [testFeedbackByRule, setTestFeedbackByRule] = useState<Record<string, { success: boolean; message: string }>>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  // All active connections for destination picker
  const availableDestinations = useMemo<DestinationOption[]>(() => ([
    ...mcpConnections
      .filter(c => c.status === 'ACTIVE')
      .map(c => ({ id: c.id, name: c.name, destType: 'mcp' as const, badge: c.type || 'MCP' })),
    ...(cmsConnection?.status === 'ACTIVE'
      ? [{ id: cmsConnection.id, name: cmsConnection.name, destType: 'cms' as const, badge: 'CMS' }]
      : []),
    ...(n8nConnection?.status === 'ACTIVE'
      ? [{ id: n8nConnection.id, name: n8nConnection.name, destType: 'n8n' as const, badge: 'n8n' }]
      : []),
  ]), [mcpConnections, cmsConnection, n8nConnection]);

  const activeEditingRule = editingRuleId
    ? rules.find((rule) => rule.id === editingRuleId) || null
    : null;

  const contentKindOptionGroups = useMemo<ContentKindOptionGroup[]>(() => {
    const byCategory = new Map<string, ContentKind[]>();
    for (const kind of ALL_CONTENT_KINDS) {
      const category = getContentKindCategory(kind);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(kind);
    }

    return ROUTING_TIP_CATEGORY_ORDER
      .map((category) => ({
        category,
        label: ROUTING_TIP_CATEGORY_LABELS[category] || category,
        kinds: byCategory.get(category) || [],
      }))
      .filter((group) => group.kinds.length > 0);
  }, []);

  const formDestinations = useMemo<DestinationOption[]>(() => {
    const items = [...availableDestinations];
    if (!activeEditingRule || !formData.selectedConnectionId || formData.destinationType === '') {
      return items;
    }
    const exists = items.some((dest) => dest.id === formData.selectedConnectionId);
    if (exists) return items;

    const inferredName = activeEditingRule.mcpConnection?.name
      || activeEditingRule.cmsConnection?.name
      || activeEditingRule.n8nConnection?.name
      || 'Destinazione corrente';

    items.push({
      id: formData.selectedConnectionId,
      name: inferredName,
      destType: formData.destinationType as DestinationType,
      badge: 'non attiva',
    });
    return items;
  }, [availableDestinations, activeEditingRule, formData.selectedConnectionId, formData.destinationType]);

  const fetchRules = useCallback(async () => {
    try {
      const [rulesRes, overviewRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tip-routing-rules`),
        fetch(`/api/projects/${projectId}/tip-routing-overview`),
      ]);
      const rulesData = await rulesRes.json();
      setRules(rulesData.rules || []);
      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setCoverage(overviewData.coverage || []);
        setHistoryByKind(overviewData.historyByContentKind || []);
        setSentContentHistory(overviewData.sentContentHistory || []);
        setActionHistory(overviewData.actionHistory || []);
      } else {
        setCoverage([]);
        setHistoryByKind([]);
        setSentContentHistory([]);
        setActionHistory([]);
      }
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
    await fetchRules();
  };

  const handleDelete = async (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    await fetch(`/api/projects/${projectId}/tip-routing-rules/${ruleId}`, { method: 'DELETE' });
    await fetchRules();
  };

  const revealForm = () => {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setFormData(DEFAULT_FORM);
    setFormError(null);
    setShowForm(true);
    revealForm();
  };

  const handleOpenEdit = (rule: TipRoutingRule) => {
    const destinationType: DestinationType | '' = rule.mcpConnection
      ? 'mcp'
      : rule.cmsConnection
        ? 'cms'
        : rule.n8nConnection
          ? 'n8n'
          : '';
    const selectedConnectionId = rule.mcpConnection?.id
      || rule.cmsConnection?.id
      || rule.n8nConnection?.id
      || '';

    setEditingRuleId(rule.id);
    setFormData({
      contentKind: rule.contentKind as ContentKind,
      behavior: rule.behavior || 'create_post',
      mcpTool: rule.mcpTool || '',
      label: rule.label || '',
      selectedConnectionId,
      destinationType,
    });
    setFormError(null);
    setShowForm(true);
    revealForm();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRuleId(null);
    setFormError(null);
    setFormData(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!formData.contentKind || !formData.selectedConnectionId || !formData.destinationType) return;
    setSaving(true);
    setFormError(null);
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

      const isEditing = Boolean(editingRuleId);
      const endpoint = isEditing
        ? `/api/projects/${projectId}/tip-routing-rules/${editingRuleId}`
        : `/api/projects/${projectId}/tip-routing-rules`;
      const res = await fetch(endpoint, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await res.json();
        await fetchRules();
        handleCloseForm();
        return;
      }
      const data = await res.json().catch(() => null);
      setFormError(data?.error || 'Salvataggio non riuscito');
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

  const canSave = Boolean(formData.contentKind && formData.selectedConnectionId && formData.destinationType);

  const handleTestRule = async (rule: TipRoutingRule) => {
    setTestingRuleId(rule.id);
    setTestFeedbackByRule((prev) => {
      const next = { ...prev };
      delete next[rule.id];
      return next;
    });
    try {
      const res = await fetch(`/api/projects/${projectId}/tip-routing-rules/${rule.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => null);
      const message = data?.result?.error || data?.error || (res.ok ? 'Test completato con successo' : 'Test fallito');
      setTestFeedbackByRule((prev) => ({
        ...prev,
        [rule.id]: {
          success: res.ok && Boolean(data?.success),
          message,
        },
      }));
      await fetchRules();
    } finally {
      setTestingRuleId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="pt-6 pb-8 space-y-6"
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
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Plus size={15} />
            Nuova regola
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">
          Suggerimento operativo
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Per velocizzare: chiedi al Strategy Copilot di creare o aggiornare le regole AI Routing, mappare le tipologie contenuto e verificare le connessioni esterne passo passo.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ricette guidate</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Bozza articolo SEO su WordPress</p>
            <p className="mt-1 text-xs text-slate-600">Prerequisiti: WordPress attivo, regola con destinazione WordPress.</p>
            <p className="mt-1 text-xs text-slate-600">Accetta: SEO on-page, content strategy.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Intervento schema/GEO verso CMS o MCP</p>
            <p className="mt-1 text-xs text-slate-600">Prerequisiti: CMS voler.ai o MCP attivo, policy approvazione definita.</p>
            <p className="mt-1 text-xs text-slate-600">Accetta: llmo_schema, geo_visibility.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Contenuti social verso n8n</p>
            <p className="mt-1 text-xs text-slate-600">Prerequisiti: webhook n8n attivo e template downstream pronto.</p>
            <p className="mt-1 text-xs text-slate-600">Accetta: content strategy, llmo_content.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Payload monitoraggio/report su webhook</p>
            <p className="mt-1 text-xs text-slate-600">Prerequisiti: n8n o destinazione webhook configurata.</p>
            <p className="mt-1 text-xs text-slate-600">Accetta: gsc_performance, seo_technical.</p>
          </div>
        </div>
      </div>

      {/* Add/Edit rule form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            ref={formRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-8 bg-white border border-blue-100 rounded-[2.5rem] shadow-sm space-y-5"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {editingRuleId ? 'Modifica regola' : 'Nuova regola'}
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
                {contentKindOptionGroups.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {getContentKindRoutingDisplayLabel(kind)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {formData.contentKind && (
                <p className="text-xs text-gray-500 mt-2">
                  Categoria AI Tips: <span className="font-semibold text-gray-700">
                    {ROUTING_TIP_CATEGORY_LABELS[getContentKindCategory(formData.contentKind as ContentKind)]}
                  </span>
                  {' · '}Connessione consigliata: <span className="font-semibold text-gray-700">
                    {getContentKindSuggestedConnectionsLabel(formData.contentKind as ContentKind)}
                  </span>
                </p>
              )}
            </div>

            {/* Destination */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Destinazione
              </label>
              {formDestinations.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-2xl px-4 py-3 border border-amber-100">
                  Nessuna integrazione attiva. Configura prima una connessione nel tab Connessioni.
                </p>
              ) : (
                <div className="space-y-2">
                  {formDestinations.map(dest => (
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

            {formError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvataggio…' : editingRuleId ? 'Salva modifiche' : 'Salva regola'}
              </button>
              <button
                onClick={handleCloseForm}
                className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2.5 transition-colors"
              >
                Annulla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            onClick={handleOpenCreate}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Crea la prima regola →
          </button>
        </div>
      )}

      {/* Rules list */}
      {!loading && coverage.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Copertura AI Tips per categoria
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Tips</th>
                  <th className="px-4 py-3">Copertura routing</th>
                  <th className="px-4 py-3">Tipologie collegate</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map(item => (
                  <tr key={item.category} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {ROUTING_TIP_CATEGORY_LABELS[item.category as keyof typeof ROUTING_TIP_CATEGORY_LABELS] || item.label}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.tipCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.isCovered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.isCovered ? 'Coperta' : 'Da configurare'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.mappedContentKinds
                        .map((kind) => CONTENT_KIND_LABELS[kind as ContentKind] || kind)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && historyByKind.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Storico tip per tipologia
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Tipologia</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Bozza</th>
                  <th className="px-4 py-3">Inviate</th>
                  <th className="px-4 py-3">Scartate</th>
                  <th className="px-4 py-3">Totale</th>
                </tr>
              </thead>
              <tbody>
                {historyByKind.map(item => (
                  <tr key={item.contentKind} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {CONTENT_KIND_LABELS[item.contentKind as ContentKind] || item.contentKind}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.category
                        ? (ROUTING_TIP_CATEGORY_LABELS[item.category as keyof typeof ROUTING_TIP_CATEGORY_LABELS] || item.category)
                        : 'N/D'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.draftReady}</td>
                    <td className="px-4 py-3 text-gray-600">{item.sent}</td>
                    <td className="px-4 py-3 text-gray-600">{item.discarded}</td>
                    <td className="px-4 py-3 text-gray-800 font-semibold">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && sentContentHistory.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Storico contenuti inviati
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Titolo</th>
                  <th className="px-4 py-3">Tipologia</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3">Data invio</th>
                </tr>
              </thead>
              <tbody>
                {sentContentHistory.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-[360px] truncate">
                      {item.previewUrl ? (
                        <a className="text-blue-600 hover:underline" href={item.previewUrl} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                      ) : item.title}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {CONTENT_KIND_LABELS[item.contentKind as ContentKind] || item.contentKind}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {item.status === 'PUBLISHED' ? 'Pubblicato' : 'Inviato'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(item.sentAt).toLocaleString('it-IT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && actionHistory.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Storico azioni eseguite
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Azione</th>
                  <th className="px-4 py-3">Esito</th>
                  <th className="px-4 py-3">Durata</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {actionHistory.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <span className="font-semibold">{item.action}</span>
                      {item.contentKind && (
                        <span className="text-gray-500 ml-1">
                          · {CONTENT_KIND_LABELS[item.contentKind as ContentKind] || item.contentKind}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {item.success ? 'OK' : 'Errore'}
                      </span>
                      {!item.success && item.errorMessage && (
                        <p className="text-xs text-red-600 mt-1 max-w-[320px] truncate">{item.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.durationMs} ms</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(item.at).toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {ROUTING_TIP_CATEGORY_LABELS[getContentKindCategory(rule.contentKind as ContentKind)] || 'Categoria'}
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
                <p className="text-xs text-gray-400 mt-1">
                  Consigliato: {getContentKindSuggestedConnectionsLabel(rule.contentKind as ContentKind)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleTestRule(rule)}
                  disabled={testingRuleId === rule.id}
                  className="p-1 rounded-lg text-gray-300 hover:text-amber-500 transition-colors disabled:opacity-50"
                  title="Testa matching routing"
                >
                  {testingRuleId === rule.id
                    ? <Loader2 size={16} className="animate-spin" />
                    : <FlaskConical size={16} />}
                </button>
                <button
                  onClick={() => handleOpenEdit(rule)}
                  className="p-1 rounded-lg text-gray-300 hover:text-blue-500 transition-colors"
                  title="Modifica regola"
                >
                  <Pencil size={16} />
                </button>
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
          {Object.entries(testFeedbackByRule).map(([ruleId, feedback]) => (
            <div
              key={ruleId}
              className={`px-4 py-2 rounded-xl text-sm ${
                feedback.success
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              Regola {ruleId.slice(-6)}: {feedback.message}
            </div>
          ))}
        </div>
      )}

    </motion.div>
  );
}

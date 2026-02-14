'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type PublishChannel = 'CMS_API' | 'WORDPRESS_MCP' | 'WOOCOMMERCE_MCP' | 'MANUAL';
type ContentKind =
    | 'STATIC_PAGE'
    | 'BLOG_POST'
    | 'NEWS_ARTICLE'
    | 'FAQ_PAGE'
    | 'SCHEMA_PATCH'
    | 'SEO_PATCH'
    | 'SOCIAL_POST'
    | 'PRODUCT_DESCRIPTION';
type ContentMode = 'STATIC' | 'DYNAMIC';

interface PublishRouting {
    publishChannel: PublishChannel;
    contentKind: ContentKind;
    contentMode: ContentMode;
    wpPostType?: 'page' | 'post';
    targetSection?: string;
    targetEntityType?: 'product';
    targetEntityId?: string;
    targetEntitySlug?: string;
}

interface PublishOption {
    channel: PublishChannel;
    label: string;
    available: boolean;
    reason?: string;
}

interface PublishCapabilities {
    hasCmsApi: boolean;
    hasWordPress: boolean;
    hasWooCommerce: boolean;
    hasGoogleAnalytics: boolean;
    hasSearchConsole: boolean;
}

interface Explainability {
    logic?: string;
    strategicGoal?: string;
    evidence?: string[];
    confidence?: number;
    dataFreshnessDays?: number;
    channelsEvaluated?: string[];
}

interface SourceSignals {
    publishRouting?: Partial<PublishRouting>;
    mediaBrief?: string | null;
    strategyAlignment?: string | null;
    evidencePoints?: string[];
    explainability?: Explainability;
    [key: string]: unknown;
}

interface Suggestion {
    id: string;
    type: string;
    title: string;
    slug: string | null;
    body: string;
    metaDescription: string | null;
    targetSection: string | null;
    reasoning: string;
    sourceSignals: SourceSignals;
    priorityScore: number;
    status: string;
    cmsContentId: string | null;
    cmsPreviewUrl: string | null;
    createdAt: string;
    pushedAt: string | null;
    publishedAt: string | null;
    rejectedAt: string | null;
    rejectedReason: string | null;
}

interface DraftState {
    title: string;
    slug: string;
    body: string;
    metaDescription: string;
    targetSection: string;
    mediaBrief: string;
    publishChannel: PublishChannel;
    contentKind: ContentKind;
    contentMode: ContentMode;
    wpPostType: 'page' | 'post';
    targetEntityId: string;
    targetEntitySlug: string;
}

const DEFAULT_DRAFT: DraftState = {
    title: '',
    slug: '',
    body: '',
    metaDescription: '',
    targetSection: '',
    mediaBrief: '',
    publishChannel: 'CMS_API',
    contentKind: 'STATIC_PAGE',
    contentMode: 'STATIC',
    wpPostType: 'page',
    targetEntityId: '',
    targetEntitySlug: ''
};

const DEFAULT_PUBLISH_OPTIONS: PublishOption[] = [
    { channel: 'CMS_API', label: 'CMS integrato', available: true },
    { channel: 'WORDPRESS_MCP', label: 'WordPress (MCP)', available: true },
    { channel: 'WOOCOMMERCE_MCP', label: 'WooCommerce (MCP)', available: true },
    { channel: 'MANUAL', label: 'Solo bozza manuale', available: true }
];

const CONTENT_KIND_OPTIONS: Array<{ value: ContentKind; label: string }> = [
    { value: 'STATIC_PAGE', label: 'Pagina statica' },
    { value: 'BLOG_POST', label: 'Articolo blog' },
    { value: 'NEWS_ARTICLE', label: 'News' },
    { value: 'FAQ_PAGE', label: 'FAQ' },
    { value: 'SCHEMA_PATCH', label: 'Schema.org patch' },
    { value: 'SEO_PATCH', label: 'SEO patch' },
    { value: 'SOCIAL_POST', label: 'Post social' },
    { value: 'PRODUCT_DESCRIPTION', label: 'Descrizione prodotto' }
];

export default function SuggestionsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('id');

    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectLoading, setProjectLoading] = useState(true);
    const [projectMessage, setProjectMessage] = useState<string | null>(null);

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT);
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const [publishOptions, setPublishOptions] = useState<PublishOption[]>(DEFAULT_PUBLISH_OPTIONS);
    const [publishCapabilities, setPublishCapabilities] = useState<PublishCapabilities | null>(null);

    const isProductDraft = draft.contentKind === 'PRODUCT_DESCRIPTION' || draft.publishChannel === 'WOOCOMMERCE_MCP';

    useEffect(() => {
        resolveProjectContext();
    }, []);

    const loadSuggestions = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);

        try {
            const params = new URLSearchParams({ projectId });
            if (filter) params.set('status', filter);
            const res = await fetch(`/api/cms/suggestions?${params.toString()}`);
            const data = await res.json();
            setSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Error loading suggestions:', err);
        } finally {
            setLoading(false);
        }
    }, [filter, projectId]);

    useEffect(() => {
        if (!projectId) {
            setLoading(false);
            return;
        }
        loadSuggestions();
    }, [projectId, loadSuggestions]);

    useEffect(() => {
        if (selectedId) {
            loadSuggestionDetail(selectedId);
        } else {
            setSelectedSuggestion(null);
        }
    }, [selectedId]);

    useEffect(() => {
        if (!selectedSuggestion) return;

        const sourceSignals = (selectedSuggestion.sourceSignals || {}) as SourceSignals;
        const routing = sourceSignals.publishRouting || {};

        setDraft({
            title: selectedSuggestion.title || '',
            slug: selectedSuggestion.slug || '',
            body: selectedSuggestion.body || '',
            metaDescription: selectedSuggestion.metaDescription || '',
            targetSection: selectedSuggestion.targetSection || routing.targetSection || '',
            mediaBrief: sourceSignals.mediaBrief || '',
            publishChannel: (routing.publishChannel as PublishChannel) || 'CMS_API',
            contentKind: (routing.contentKind as ContentKind) || 'STATIC_PAGE',
            contentMode: (routing.contentMode as ContentMode) || 'STATIC',
            wpPostType: routing.wpPostType === 'post' ? 'post' : 'page',
            targetEntityId: routing.targetEntityId || '',
            targetEntitySlug: routing.targetEntitySlug || ''
        });
        setEditing(false);
        setSaveError(null);
    }, [selectedSuggestion]);

    async function resolveProjectContext() {
        setProjectLoading(true);
        setProjectMessage(null);

        try {
            const connectionRes = await fetch('/api/cms/connection');
            const connectionData = await connectionRes.json();

            if (connectionRes.ok && connectionData?.enabled && connectionData?.projectId) {
                setProjectId(connectionData.projectId);
                return;
            }

            const fallbackRes = await fetch('/api/cms/suggestions');
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                if (fallbackData?.projectId) {
                    setProjectId(fallbackData.projectId);
                    return;
                }
                setProjectMessage(connectionData?.message || fallbackData?.message || 'Nessuna connessione CMS disponibile per i tuoi progetti.');
            } else {
                setProjectMessage(connectionData?.message || 'Impossibile risolvere il progetto collegato al CMS.');
            }
        } catch (err) {
            console.error('Error resolving project context:', err);
            setProjectMessage('Errore nel caricamento del progetto CMS.');
        } finally {
            setProjectLoading(false);
        }
    }

    async function loadSuggestionDetail(id: string) {
        try {
            const res = await fetch(`/api/cms/suggestions/${id}`);
            const data = await res.json();
            setSelectedSuggestion(data.suggestion || null);
            setPublishOptions((data.publish?.options || DEFAULT_PUBLISH_OPTIONS) as PublishOption[]);
            setPublishCapabilities((data.publish?.capabilities || null) as PublishCapabilities | null);
        } catch (err) {
            console.error('Error loading suggestion detail:', err);
        }
    }

    async function handlePush(id: string) {
        if (!confirm('Vuoi inviare questo suggerimento al canale di pubblicazione selezionato?')) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/cms/suggestions/${id}/push`, { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                await loadSuggestions();
                if (selectedId === id) await loadSuggestionDetail(id);
            } else {
                alert(data.error || 'Errore durante l\'invio');
            }
        } catch {
            alert('Errore di rete');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReject(id: string) {
        const reason = prompt('Motivo del rifiuto (opzionale):');
        if (reason === null) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/cms/suggestions/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || undefined })
            });
            const data = await res.json();

            if (data.success) {
                await loadSuggestions();
                setSelectedSuggestion(null);
            }
        } catch {
            alert('Errore di rete');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSaveDraft() {
        if (!selectedSuggestion) return;

        setSaveLoading(true);
        setSaveError(null);
        try {
            const payload = {
                title: draft.title,
                slug: draft.slug,
                body: draft.body,
                metaDescription: draft.metaDescription,
                targetSection: draft.targetSection,
                mediaBrief: draft.mediaBrief || null,
                publishRouting: {
                    publishChannel: draft.publishChannel,
                    contentKind: draft.contentKind,
                    contentMode: draft.contentMode,
                    wpPostType: draft.wpPostType,
                    targetSection: draft.targetSection || undefined,
                    targetEntityType: isProductDraft ? 'product' : undefined,
                    targetEntityId: draft.targetEntityId || undefined,
                    targetEntitySlug: draft.targetEntitySlug || undefined
                }
            };

            const res = await fetch(`/api/cms/suggestions/${selectedSuggestion.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                setSaveError(data.error || 'Errore durante il salvataggio');
                return;
            }

            await loadSuggestionDetail(selectedSuggestion.id);
            setEditing(false);
        } catch {
            setSaveError('Errore di rete');
        } finally {
            setSaveLoading(false);
        }
    }

    async function copyText(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage(`${label} copiato`);
            setTimeout(() => setCopyMessage(null), 1800);
        } catch {
            setCopyMessage('Copia non riuscita');
            setTimeout(() => setCopyMessage(null), 1800);
        }
    }

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        PUSHED: 'bg-blue-100 text-blue-800',
        PUBLISHED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-gray-100 text-gray-500',
        FAILED: 'bg-red-100 text-red-800'
    };

    const strategyAlignment = selectedSuggestion?.sourceSignals?.strategyAlignment;
    const evidencePoints = useMemo(() => {
        const list = selectedSuggestion?.sourceSignals?.evidencePoints;
        return Array.isArray(list) ? list : [];
    }, [selectedSuggestion]);
    const explainability = selectedSuggestion?.sourceSignals?.explainability as Explainability | undefined;

    if (projectLoading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-3">
                    <div className="h-8 bg-gray-200 rounded w-1/3" />
                    <div className="h-24 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="p-8">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900">
                    <h1 className="text-xl font-semibold mb-1">Suggerimenti CMS non disponibili</h1>
                    <p className="text-sm">{projectMessage || 'Collega un progetto a una connessione CMS per gestire le bozze suggerite dall\'AI.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Suggerimenti Contenuto</h1>
                    <p className="text-xs text-gray-500 mt-1">Project ID: {projectId}</p>
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                >
                    <option value="">Tutti</option>
                    <option value="PENDING">In attesa</option>
                    <option value="PUSHED">Inviati</option>
                    <option value="PUBLISHED">Pubblicati</option>
                    <option value="REJECTED">Rifiutati</option>
                    <option value="FAILED">Falliti</option>
                </select>
            </div>

            <div className="flex gap-6">
                <div className="flex-1 space-y-3">
                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
                            ))}
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                            Nessun suggerimento trovato
                        </div>
                    ) : (
                        suggestions.map(s => (
                            <div
                                key={s.id}
                                onClick={() => router.push(`?id=${s.id}`)}
                                className={`bg-white rounded-xl border p-4 cursor-pointer transition ${selectedId === s.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(s.priorityScore)}`}>
                                            {s.priorityScore}
                                        </span>
                                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                            {formatType(s.type)}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded ${statusColors[s.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {s.status}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(s.createdAt).toLocaleDateString('it-IT')}
                                    </span>
                                </div>
                                <h3 className="font-medium">{s.title}</h3>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.reasoning}</p>
                            </div>
                        ))
                    )}
                </div>

                {selectedSuggestion && (
                    <div className="w-1/2 bg-white rounded-xl border border-gray-200 p-6 sticky top-8 max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${statusColors[selectedSuggestion.status] || 'bg-gray-100 text-gray-500'}`}>
                                    {selectedSuggestion.status}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(selectedSuggestion.priorityScore)}`}>
                                    Priorita: {selectedSuggestion.priorityScore}
                                </span>
                            </div>
                            <button
                                onClick={() => router.push(window.location.pathname)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                &times;
                            </button>
                        </div>

                        <h2 className="text-xl font-bold mb-2">{selectedSuggestion.title}</h2>

                        {selectedSuggestion.slug && (
                            <p className="text-sm text-gray-500 mb-4 font-mono">/{selectedSuggestion.slug}</p>
                        )}

                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Perche questo contenuto</h3>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedSuggestion.reasoning}</p>
                        </div>

                        {(strategyAlignment || evidencePoints.length > 0 || explainability?.logic) && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Logica del suggerimento AI</h3>
                                <div className="space-y-2 text-sm bg-indigo-50/50 border border-indigo-100 rounded p-3">
                                    {strategyAlignment && (
                                        <div>
                                            <span className="font-medium text-indigo-900">Coerenza strategica:</span>
                                            <p className="text-indigo-800">{strategyAlignment}</p>
                                        </div>
                                    )}
                                    {explainability?.logic && (
                                        <div>
                                            <span className="font-medium text-indigo-900">Logica:</span>
                                            <p className="text-indigo-800">{explainability.logic}</p>
                                        </div>
                                    )}
                                    {evidencePoints.length > 0 && (
                                        <div>
                                            <span className="font-medium text-indigo-900">Evidenze:</span>
                                            <ul className="list-disc ml-5 text-indigo-800">
                                                {evidencePoints.map((point, idx) => (
                                                    <li key={idx}>{point}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {(explainability?.channelsEvaluated?.length || typeof explainability?.confidence === 'number') && (
                                        <div className="text-indigo-700 text-xs">
                                            {typeof explainability?.confidence === 'number' && (
                                                <span>Confidenza: {(explainability.confidence * 100).toFixed(0)}% </span>
                                            )}
                                            {explainability?.channelsEvaluated?.length ? `| Canali valutati: ${explainability.channelsEvaluated.join(', ')}` : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-700">Bozza Contenuto</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => copyText(editing ? draft.body : selectedSuggestion.body, 'Contenuto')}
                                        className="text-xs text-indigo-600 hover:text-indigo-700"
                                    >
                                        Copia contenuto
                                    </button>
                                    <button
                                        onClick={() => copyText(JSON.stringify({
                                            title: editing ? draft.title : selectedSuggestion.title,
                                            slug: editing ? draft.slug : selectedSuggestion.slug,
                                            body: editing ? draft.body : selectedSuggestion.body,
                                            metaDescription: editing ? draft.metaDescription : selectedSuggestion.metaDescription,
                                            targetSection: editing ? draft.targetSection : selectedSuggestion.targetSection,
                                            publishRouting: selectedSuggestion.sourceSignals?.publishRouting || null,
                                            mediaBrief: editing ? draft.mediaBrief : (selectedSuggestion.sourceSignals?.mediaBrief || null)
                                        }, null, 2), 'JSON suggerimento')}
                                        className="text-xs text-indigo-600 hover:text-indigo-700"
                                    >
                                        Copia JSON
                                    </button>
                                    {selectedSuggestion.status === 'PENDING' && (
                                        <button
                                            onClick={() => setEditing(!editing)}
                                            className="text-xs text-amber-600 hover:text-amber-700"
                                        >
                                            {editing ? 'Annulla' : 'Modifica bozza'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {copyMessage && (
                                <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
                                    {copyMessage}
                                </div>
                            )}
                            {editing ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-600">Titolo</label>
                                        <input
                                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                            value={draft.title}
                                            onChange={(e) => setDraft(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Slug</label>
                                            <input
                                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                                value={draft.slug}
                                                onChange={(e) => setDraft(prev => ({ ...prev, slug: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600">Sezione target</label>
                                            <input
                                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                                value={draft.targetSection}
                                                onChange={(e) => setDraft(prev => ({ ...prev, targetSection: e.target.value }))}
                                                placeholder="faq, pages, blog..."
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-600">Meta Description</label>
                                        <input
                                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                            value={draft.metaDescription}
                                            onChange={(e) => setDraft(prev => ({ ...prev, metaDescription: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-600">Routing pubblicazione</label>
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <select
                                                value={draft.publishChannel}
                                                onChange={(e) => setDraft(prev => ({ ...prev, publishChannel: e.target.value as PublishChannel }))}
                                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                                            >
                                                {publishOptions.map(option => (
                                                    <option key={option.channel} value={option.channel} disabled={!option.available}>
                                                        {option.label}{option.available ? '' : ' (non attivo)'}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={draft.contentKind}
                                                onChange={(e) => setDraft(prev => ({ ...prev, contentKind: e.target.value as ContentKind }))}
                                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                                            >
                                                {CONTENT_KIND_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={draft.contentMode}
                                                onChange={(e) => setDraft(prev => ({ ...prev, contentMode: e.target.value as ContentMode }))}
                                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                                            >
                                                <option value="STATIC">Statico</option>
                                                <option value="DYNAMIC">Dinamico</option>
                                            </select>
                                            <select
                                                value={draft.wpPostType}
                                                onChange={(e) => setDraft(prev => ({ ...prev, wpPostType: e.target.value as 'page' | 'post' }))}
                                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                                            >
                                                <option value="page">WordPress page</option>
                                                <option value="post">WordPress post</option>
                                            </select>
                                        </div>
                                        {publishCapabilities && (
                                            <p className="text-[11px] text-gray-500 mt-1">
                                                Capabilities attive: {publishCapabilities.hasCmsApi ? 'CMS API ' : ''}
                                                {publishCapabilities.hasWordPress ? 'WordPress ' : ''}
                                                {publishCapabilities.hasWooCommerce ? 'WooCommerce ' : ''}
                                                {publishCapabilities.hasGoogleAnalytics ? '| GA ' : ''}
                                                {publishCapabilities.hasSearchConsole ? '| GSC' : ''}
                                            </p>
                                        )}
                                    </div>

                                    {isProductDraft && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600">Product ID (Woo)</label>
                                                <input
                                                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                                    value={draft.targetEntityId}
                                                    onChange={(e) => setDraft(prev => ({ ...prev, targetEntityId: e.target.value }))}
                                                    placeholder="es. 123"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600">Product slug (fallback)</label>
                                                <input
                                                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                                    value={draft.targetEntitySlug}
                                                    onChange={(e) => setDraft(prev => ({ ...prev, targetEntitySlug: e.target.value }))}
                                                    placeholder="nome-prodotto"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-xs font-medium text-gray-600">Media brief (social)</label>
                                        <textarea
                                            className="mt-1 w-full min-h-[80px] rounded border border-gray-300 px-3 py-2 text-sm"
                                            value={draft.mediaBrief}
                                            onChange={(e) => setDraft(prev => ({ ...prev, mediaBrief: e.target.value }))}
                                            placeholder="Descrivi immagine/video consigliato"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-gray-600">Contenuto</label>
                                        <textarea
                                            className="mt-1 w-full min-h-[220px] rounded border border-gray-300 px-3 py-2 text-sm"
                                            value={draft.body}
                                            onChange={(e) => setDraft(prev => ({ ...prev, body: e.target.value }))}
                                        />
                                    </div>

                                    {saveError && (
                                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                                            {saveError}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={saveLoading}
                                        className="px-4 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
                                    >
                                        {saveLoading ? 'Salvataggio...' : 'Salva modifiche'}
                                    </button>
                                </div>
                            ) : (
                                <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded border border-gray-200 max-h-64 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap text-sm">{selectedSuggestion.body}</pre>
                                </div>
                            )}
                        </div>

                        {selectedSuggestion.metaDescription && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Meta Description</h3>
                                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedSuggestion.metaDescription}</p>
                            </div>
                        )}

                        {selectedSuggestion.sourceSignals?.mediaBrief && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">Media brief</h3>
                                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedSuggestion.sourceSignals.mediaBrief}</p>
                            </div>
                        )}

                        {selectedSuggestion.cmsPreviewUrl && (
                            <div className="mb-6">
                                <a
                                    href={selectedSuggestion.cmsPreviewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline text-sm"
                                >
                                    Vedi anteprima nel CMS &rarr;
                                </a>
                            </div>
                        )}

                        {selectedSuggestion.status === 'PENDING' && (
                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <button
                                    onClick={() => handleReject(selectedSuggestion.id)}
                                    disabled={actionLoading}
                                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Rifiuta
                                </button>
                                <button
                                    onClick={() => handlePush(selectedSuggestion.id)}
                                    disabled={actionLoading}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {actionLoading ? 'Invio...' : 'Invia al canale'}
                                </button>
                            </div>
                        )}

                        {selectedSuggestion.status === 'REJECTED' && selectedSuggestion.rejectedReason && (
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-500">
                                    Rifiutato: {selectedSuggestion.rejectedReason}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function getPriorityColor(score: number): string {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
}

function formatType(type: string): string {
    const types: Record<string, string> = {
        CREATE_PAGE: 'Nuova Pagina',
        CREATE_FAQ: 'FAQ',
        CREATE_BLOG_POST: 'Blog Post',
        MODIFY_CONTENT: 'Modifica',
        ADD_SECTION: 'Nuova Sezione'
    };
    return types[type] || type;
}

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Suggestion {
    id: string;
    type: string;
    title: string;
    slug: string | null;
    body: string;
    metaDescription: string | null;
    targetSection: string | null;
    reasoning: string;
    sourceSignals: any;
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

export default function SuggestionsPage() {
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('id');

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [filter, setFilter] = useState<string>('');
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({
        title: '',
        slug: '',
        body: '',
        metaDescription: '',
        targetSection: ''
    });
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        loadSuggestions();
    }, [filter]);

    useEffect(() => {
        if (selectedId) {
            loadSuggestionDetail(selectedId);
        } else {
            setSelectedSuggestion(null);
        }
    }, [selectedId]);

    useEffect(() => {
        if (selectedSuggestion) {
            setDraft({
                title: selectedSuggestion.title || '',
                slug: selectedSuggestion.slug || '',
                body: selectedSuggestion.body || '',
                metaDescription: selectedSuggestion.metaDescription || '',
                targetSection: selectedSuggestion.targetSection || ''
            });
            setEditing(false);
            setSaveError(null);
        }
    }, [selectedSuggestion]);

    async function loadSuggestions() {
        try {
            const url = filter ? `/api/cms/suggestions?status=${filter}` : '/api/cms/suggestions';
            const res = await fetch(url);
            const data = await res.json();
            setSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Error loading suggestions:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadSuggestionDetail(id: string) {
        try {
            const res = await fetch(`/api/cms/suggestions/${id}`);
            const data = await res.json();
            setSelectedSuggestion(data.suggestion);
        } catch (err) {
            console.error('Error loading suggestion detail:', err);
        }
    }

    async function handlePush(id: string) {
        if (!confirm('Vuoi inviare questo suggerimento al CMS come bozza?')) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/cms/suggestions/${id}/push`, { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                loadSuggestions();
                if (selectedId === id) loadSuggestionDetail(id);
            } else {
                alert(data.error || 'Errore durante l\'invio');
            }
        } catch (err) {
            alert('Errore di rete');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReject(id: string) {
        const reason = prompt('Motivo del rifiuto (opzionale):');
        if (reason === null) return; // Cancelled

        setActionLoading(true);
        try {
            const res = await fetch(`/api/cms/suggestions/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason || undefined })
            });
            const data = await res.json();

            if (data.success) {
                loadSuggestions();
                setSelectedSuggestion(null);
            }
        } catch (err) {
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
            const res = await fetch(`/api/cms/suggestions/${selectedSuggestion.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: draft.title,
                    slug: draft.slug,
                    body: draft.body,
                    metaDescription: draft.metaDescription,
                    targetSection: draft.targetSection
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setSaveError(data.error || 'Errore durante il salvataggio');
                return;
            }
            await loadSuggestionDetail(selectedSuggestion.id);
            setEditing(false);
        } catch (err) {
            setSaveError('Errore di rete');
        } finally {
            setSaveLoading(false);
        }
    }

    const statusColors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        PUSHED: 'bg-blue-100 text-blue-800',
        PUBLISHED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-gray-100 text-gray-500',
        FAILED: 'bg-red-100 text-red-800'
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Suggerimenti Contenuto</h1>
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
                </select>
            </div>

            <div className="flex gap-6">
                {/* List */}
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
                                onClick={() => window.history.pushState({}, '', `?id=${s.id}`)}
                                className={`bg-white rounded-xl border p-4 cursor-pointer transition ${selectedId === s.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(s.priorityScore)}`}>
                                            {s.priorityScore}
                                        </span>
                                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                            {formatType(s.type)}
                                        </span>
                                        <span className={`text-xs px-2 py-1 rounded ${statusColors[s.status]}`}>
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

                {/* Detail Panel */}
                {selectedSuggestion && (
                    <div className="w-1/2 bg-white rounded-xl border border-gray-200 p-6 sticky top-8 max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${statusColors[selectedSuggestion.status]}`}>
                                    {selectedSuggestion.status}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(selectedSuggestion.priorityScore)}`}>
                                    Priorita: {selectedSuggestion.priorityScore}
                                </span>
                            </div>
                            <button
                                onClick={() => window.history.pushState({}, '', window.location.pathname)}
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

                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-700">Bozza Contenuto</h3>
                                {selectedSuggestion.status === 'PENDING' && (
                                    <button
                                        onClick={() => setEditing(!editing)}
                                        className="text-xs text-amber-600 hover:text-amber-700"
                                    >
                                        {editing ? 'Annulla' : 'Modifica bozza'}
                                    </button>
                                )}
                            </div>
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
                                            <label className="text-xs font-medium text-gray-600">Sezione</label>
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

                        {/* Actions */}
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
                                    {actionLoading ? 'Invio...' : 'Invia al Sito'}
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

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Bot, FileText, Globe, Loader2, Trash2 } from 'lucide-react';
import { colors } from '@/lib/design-system';

interface KnowledgeSource {
    id: string;
    title: string | null;
    type: string;
    createdAt: Date;
}

interface KnowledgeManagerProps {
    botId: string;
    initialSources?: KnowledgeSource[];
    onSourceAdded?: (source: KnowledgeSource) => void;
}

export function KnowledgeManager({ botId, initialSources = [], onSourceAdded }: KnowledgeManagerProps) {
    const [sources, setSources] = useState<KnowledgeSource[]>(initialSources);
    const [url, setUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleScrape = async () => {
        if (!url) return;
        setIsScraping(true);
        setError(null);

        try {
            const res = await fetch('/api/knowledge/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, url })
            });

            if (!res.ok) throw new Error('Errore durante lo scraping');

            const newSource = await res.json();
            setSources(prev => [newSource, ...prev]);
            setUrl('');
            if (onSourceAdded) onSourceAdded(newSource);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsScraping(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('botId', botId);

        try {
            const res = await fetch('/api/knowledge/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Errore durante l\'upload');

            const newSource = await res.json();
            setSources(prev => [newSource, ...prev]);
            if (onSourceAdded) onSourceAdded(newSource);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        // Optimistic update
        setSources(prev => prev.filter(s => s.id !== id));

        // TODO: Call API to delete source
        try {
            await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error(err);
            // Revert on error? For MVP keep simple.
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                {/* URL Input */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        Aggiungi da URL
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://tiosito.com/pricing"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <Button
                            onClick={handleScrape}
                            disabled={!url || isScraping}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importa'}
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Scansioneremo la pagina per estrarre il testo principale.
                    </p>
                </div>

                {/* File Upload */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Carica File
                    </h3>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".txt,.md,.json"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-600" />
                            ) : (
                                <div className="text-sm text-gray-600">
                                    <span className="text-purple-600 font-medium">Clicca per caricare</span> o trascina qui
                                    <p className="text-xs text-gray-400 mt-1">
                                        Supportati: .txt, .md, .json
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                    <Icons.AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Sources List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-medium text-gray-700 text-sm">Fonti di Conoscenza ({sources.length})</h3>
                </div>
                {sources.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">Nessuna fonte aggiunta.</p>
                        <p className="text-xs">Il bot userà solo le sue conoscenze generali.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sources.map((source) => (
                            <div key={source.id} className="p-4 flex items-center justify-between group hover:bg-gray-50">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`p-2 rounded-lg ${source.type === 'url' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {source.type === 'url' ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{source.title || 'Senza titolo'}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(source.createdAt).toLocaleDateString()} • {source.type.toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(source.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

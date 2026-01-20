'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Bot, FileText, Globe, Loader2, Trash2, Map, CheckCircle2, AlertCircle } from 'lucide-react';

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
    const [isSitemapProcessing, setIsSitemapProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleScrape = async () => {
        if (!url) return;

        // Detect if it's a sitemap
        const isSitemap = url.toLowerCase().includes('sitemap') && url.endsWith('.xml');

        if (isSitemap) {
            handleSitemap(url);
            return;
        }

        setIsScraping(true);
        setError(null);
        setSuccessMessage(null);

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
            setSuccessMessage("Pagina importata con successo!");
            if (onSourceAdded) onSourceAdded(newSource);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsScraping(false);
        }
    };

    const handleSitemap = async (sitemapUrl: string) => {
        setIsSitemapProcessing(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await fetch('/api/knowledge/sitemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, url: sitemapUrl })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Errore durante l\'elaborazione della sitemap');
            }

            const data = await res.json();
            setSuccessMessage(`Sitemap elaborata! ${data.count} pagine aggiunte alla coda di indicizzazione.`);
            setUrl('');
            // Refresh sources after a short delay
            setTimeout(async () => {
                const refreshRes = await fetch(`/api/knowledge/sources?botId=${botId}`);
                if (refreshRes.ok) {
                    const freshSources = await refreshRes.json();
                    setSources(freshSources);
                }
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSitemapProcessing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setSuccessMessage(null);

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
            setSuccessMessage("File caricato correttamente!");
            if (onSourceAdded) onSourceAdded(newSource);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
        try {
            await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                {/* URL / Sitemap Input */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        URL o Sitemap
                    </h3>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://sito.it/sitemap.xml o pagina"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none pr-8"
                            />
                            {url.toLowerCase().includes('sitemap') && (
                                <Map className="absolute right-2.5 top-2.5 w-4 h-4 text-amber-500" />
                            )}
                        </div>
                        <Button
                            onClick={handleScrape}
                            disabled={!url || isScraping || isSitemapProcessing}
                            className="bg-purple-600 hover:bg-purple-700 text-white min-w-[100px]"
                        >
                            {isScraping || isSitemapProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                url.toLowerCase().includes('sitemap') ? 'Indicizza' : 'Importa'
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Inserisci un URL singolo o il link alla tua <span className="font-medium">sitemap.xml</span> per indicizzare l'intero sito.
                    </p>
                </div>

                {/* File Upload */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Carica Documenti
                    </h3>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".txt,.md,.json,.pdf"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:bg-purple-50/30 transition-colors">
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-600" />
                            ) : (
                                <div className="text-sm text-gray-600">
                                    <span className="text-purple-600 font-medium">Scegli un file</span> o trascina qui
                                    <p className="text-xs text-gray-400 mt-1">
                                        Supportati: .txt, .md, .json, .pdf
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    {successMessage}
                </div>
            )}

            {/* Sources List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Fonti di Conoscenza ({sources.length})</h3>
                </div>
                {sources.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-medium">Nessuna fonte aggiunta</p>
                        <p className="text-xs mt-1 max-w-[200px] mx-auto">Importa dati per rendere il tuo chatbot e gli insight più precisi.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                        {sources.map((source) => (
                            <div key={source.id} className="p-4 flex items-center justify-between group hover:bg-purple-50/20 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`p-2 rounded-lg ${source.type === 'url' ? 'bg-blue-50 text-blue-600' :
                                            source.type === 'file' ? 'bg-orange-50 text-orange-600' :
                                                'bg-amber-50 text-amber-600'
                                        }`}>
                                        {source.type === 'url' ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{source.title || 'Senza titolo'}</p>
                                        <p className="text-[10px] font-medium text-gray-500 uppercase flex items-center gap-2">
                                            {source.type} • {new Date(source.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(source.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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

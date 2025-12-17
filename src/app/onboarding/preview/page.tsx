'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    Edit2,
    Eye,
    Link2,
    Play,
    QrCode,
    Share2,
    Sparkles,
    X
} from 'lucide-react';

interface TopicConfig {
    label: string;
    description: string;
    subGoals: string[];
    maxTurns: number;
}

interface GeneratedConfig {
    name?: string;
    researchGoal: string;
    targetAudience: string;
    language: string;
    tone: string;
    maxDurationMins: number;
    introMessage: string;
    topics: TopicConfig[];
    fromTemplate?: string;
}

export default function PreviewPage() {
    const router = useRouter();
    const [config, setConfig] = useState<GeneratedConfig | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set([0]));
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
    const [showSimulator, setShowSimulator] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('generatedConfig');
        if (stored) {
            setConfig(JSON.parse(stored));
        } else {
            router.push('/onboarding');
        }
    }, [router]);

    const toggleTopic = (index: number) => {
        const newExpanded = new Set(expandedTopics);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedTopics(newExpanded);
    };

    const handlePublish = async () => {
        if (!config) return;
        setIsPublishing(true);

        try {
            const response = await fetch('/api/bots/create-from-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                throw new Error('Errore nella pubblicazione');
            }

            const result = await response.json();
            setPublishedSlug(result.slug);
            sessionStorage.removeItem('generatedConfig');
        } catch (err) {
            console.error(err);
            alert('Errore nella pubblicazione');
        } finally {
            setIsPublishing(false);
        }
    };

    const copyLink = () => {
        if (!publishedSlug) return;
        const link = `${window.location.origin}/i/${publishedSlug}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!config) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white">Caricamento...</div>
            </div>
        );
    }

    // Published Success View
    if (publishedSlug) {
        const interviewLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/i/${publishedSlug}`;

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
                <div className="max-w-lg w-full bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center space-y-8">
                    <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                        <Check className="w-10 h-10 text-green-400" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-white">Intervista pubblicata!</h2>
                        <p className="text-slate-300">La tua intervista è pronta. Condividi il link per iniziare a raccogliere risposte.</p>
                    </div>

                    {/* Link Copy */}
                    <div className="bg-white/5 rounded-xl p-4 flex items-center gap-3">
                        <Link2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <span className="text-white truncate flex-1 text-left">{interviewLink}</span>
                        <button
                            onClick={copyLink}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiato!' : 'Copia'}
                        </button>
                    </div>

                    {/* Share Options */}
                    <div className="flex justify-center gap-4">
                        <button className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group">
                            <QrCode className="w-6 h-6 text-slate-400 group-hover:text-white" />
                        </button>
                        <button className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group">
                            <Share2 className="w-6 h-6 text-slate-400 group-hover:text-white" />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                        >
                            Vai alla dashboard
                        </button>
                        <button
                            onClick={() => router.push('/onboarding')}
                            className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
                        >
                            Crea un'altra
                        </button>
                    </div>

                    <p className="text-sm text-slate-400">
                        Riceverai una notifica quando arrivano le prime risposte 📬
                    </p>
                </div>
            </div>
        );
    }

    // Preview & Edit View
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="p-6 flex items-center justify-between border-b border-white/10">
                <h1 className="text-2xl font-bold text-white">voler.AI</h1>
                <button
                    onClick={() => router.push('/onboarding')}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    ← Modifica obiettivo
                </button>
            </header>

            <main className="max-w-3xl mx-auto p-6 space-y-8">
                {/* Name */}
                <div className="space-y-2">
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={config.name || 'La mia intervista'}
                                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                className="text-3xl font-bold bg-transparent text-white border-b-2 border-purple-500 focus:outline-none"
                                autoFocus
                                onBlur={() => setEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setEditingName(true)}
                            className="text-3xl font-bold text-white flex items-center gap-2 hover:text-purple-300 transition-colors"
                        >
                            {config.name || 'La mia intervista'}
                            <Edit2 className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Research Goal */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-3">
                    <div className="flex items-center gap-2 text-purple-400">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-medium">Obiettivo della ricerca</span>
                    </div>
                    <p className="text-white">{config.researchGoal}</p>
                </div>

                {/* Intro Message */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-3">
                    <span className="text-sm text-slate-400">Messaggio di benvenuto</span>
                    <p className="text-slate-300 italic">"{config.introMessage}"</p>
                </div>

                {/* Topics */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white">Topic dell'intervista</h3>
                    {config.topics.map((topic, index) => (
                        <div
                            key={index}
                            className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                        >
                            <button
                                onClick={() => toggleTopic(index)}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 text-sm font-medium">
                                        {index + 1}
                                    </span>
                                    <span className="text-white font-medium">{topic.label}</span>
                                </div>
                                {expandedTopics.has(index) ? (
                                    <ChevronUp className="w-5 h-5 text-slate-400" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                )}
                            </button>
                            {expandedTopics.has(index) && (
                                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                                    <p className="text-slate-400 text-sm">{topic.description}</p>
                                    <div className="space-y-2">
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Sub-goals</span>
                                        <ul className="space-y-1">
                                            {topic.subGoals.map((goal, i) => (
                                                <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                                                    <span className="text-purple-400">•</span>
                                                    {goal}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <button
                        onClick={() => setShowSimulator(true)}
                        className="flex-1 px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        <Play className="w-5 h-5" />
                        Prova l'intervista
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="flex-1 px-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        {isPublishing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Pubblicazione...
                            </>
                        ) : (
                            <>
                                <Share2 className="w-5 h-5" />
                                Pubblica e condividi
                            </>
                        )}
                    </button>
                </div>
            </main>

            {/* Simulator Modal Placeholder */}
            {showSimulator && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-lg w-full bg-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-purple-400" />
                                <span className="text-white font-medium">Anteprima intervista</span>
                            </div>
                            <button
                                onClick={() => setShowSimulator(false)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 text-center text-slate-400">
                            <p>Il simulatore sarà disponibile a breve.</p>
                            <p className="mt-2 text-sm">Per ora, puoi pubblicare l'intervista e testarla direttamente.</p>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowSimulator(false)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            >
                                Chiudi
                            </button>
                            <button
                                onClick={() => {
                                    setShowSimulator(false);
                                    handlePublish();
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                            >
                                Pubblica direttamente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

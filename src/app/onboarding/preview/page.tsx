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
    Plus,
    Play,
    QrCode,
    Save,
    Share2,
    Sparkles,
    Trash2,
    X
} from 'lucide-react';
import SimulatorChat from '@/components/simulator/simulator-chat';
import { checkUserSession } from '@/app/actions/session';

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
    const [editingGoal, setEditingGoal] = useState(false);
    const [editingIntro, setEditingIntro] = useState(false);
    const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
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

    const updateConfig = (updates: Partial<GeneratedConfig>) => {
        if (!config) return;
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        sessionStorage.setItem('generatedConfig', JSON.stringify(newConfig));
    };

    const updateTopic = (index: number, updates: Partial<TopicConfig>) => {
        if (!config) return;
        const newTopics = [...config.topics];
        newTopics[index] = { ...newTopics[index], ...updates };
        updateConfig({ topics: newTopics });
    };

    const addTopic = () => {
        if (!config) return;
        const newTopic: TopicConfig = {
            label: 'Nuovo topic',
            description: 'Descrizione del topic',
            subGoals: ['Sotto-obiettivo 1'],
            maxTurns: 4
        };
        const newTopics = [...config.topics, newTopic];
        updateConfig({ topics: newTopics });
        setExpandedTopics(new Set([...expandedTopics, newTopics.length - 1]));
        setEditingTopicIndex(newTopics.length - 1);
    };

    const removeTopic = (index: number) => {
        if (!config || config.topics.length <= 1) return;
        const newTopics = config.topics.filter((_, i) => i !== index);
        updateConfig({ topics: newTopics });
        setEditingTopicIndex(null);
    };

    const addSubGoal = (topicIndex: number) => {
        if (!config) return;
        const topic = config.topics[topicIndex];
        const newSubGoals = [...topic.subGoals, 'Nuovo sotto-obiettivo'];
        updateTopic(topicIndex, { subGoals: newSubGoals });
    };

    const updateSubGoal = (topicIndex: number, goalIndex: number, value: string) => {
        if (!config) return;
        const topic = config.topics[topicIndex];
        const newSubGoals = [...topic.subGoals];
        newSubGoals[goalIndex] = value;
        updateTopic(topicIndex, { subGoals: newSubGoals });
    };

    const removeSubGoal = (topicIndex: number, goalIndex: number) => {
        if (!config) return;
        const topic = config.topics[topicIndex];
        if (topic.subGoals.length <= 1) return;
        const newSubGoals = topic.subGoals.filter((_, i) => i !== goalIndex);
        updateTopic(topicIndex, { subGoals: newSubGoals });
    };

    const toggleTopic = (index: number) => {
        const newExpanded = new Set(expandedTopics);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedTopics(newExpanded);
    };

    const [showAuthModal, setShowAuthModal] = useState(false);

    // Initial check (optional, or just do it on action)

    const handlePublish = async () => {
        if (!config) return;

        // 1. Check Auth
        const isLoggedIn = await checkUserSession();
        if (!isLoggedIn) {
            setShowAuthModal(true);
            return;
        }

        setIsPublishing(true);

        try {
            const response = await fetch('/api/bots/create-from-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setShowAuthModal(true);
                    return;
                }
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
                </div>
            </div>
        );
    }

    // Preview & Edit View
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <header className="p-6 flex items-center justify-between border-b border-white/10">
                <h1 className="text-2xl font-bold text-white">Business Tuner</h1>
                <button
                    onClick={() => router.push('/onboarding')}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    ← Modifica obiettivo
                </button>
            </header>

            <main className="max-w-3xl mx-auto p-6 space-y-8">
                {/* Name - Editable */}
                <div className="space-y-2">
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={config.name || 'La mia intervista'}
                                onChange={(e) => updateConfig({ name: e.target.value })}
                                className="text-3xl font-bold bg-transparent text-white border-b-2 border-purple-500 focus:outline-none w-full"
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
                            <Edit2 className="w-5 h-5 opacity-50" />
                        </button>
                    )}
                    <p className="text-sm text-slate-400">Clicca per modificare nome, obiettivo o topic</p>
                </div>

                {/* Research Goal - Editable */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-400">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-medium">Obiettivo della ricerca</span>
                        </div>
                        {!editingGoal && (
                            <button onClick={() => setEditingGoal(true)} className="text-slate-400 hover:text-white">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {editingGoal ? (
                        <div className="space-y-2">
                            <textarea
                                value={config.researchGoal}
                                onChange={(e) => updateConfig({ researchGoal: e.target.value })}
                                className="w-full bg-white/10 text-white rounded-lg p-3 border border-white/20 focus:outline-none focus:border-purple-500 resize-none"
                                rows={3}
                                autoFocus
                            />
                            <button
                                onClick={() => setEditingGoal(false)}
                                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
                            >
                                <Save className="w-3 h-3" /> Salva
                            </button>
                        </div>
                    ) : (
                        <p className="text-white">{config.researchGoal}</p>
                    )}
                </div>

                {/* Intro Message - Editable */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Messaggio di benvenuto</span>
                        {!editingIntro && (
                            <button onClick={() => setEditingIntro(true)} className="text-slate-400 hover:text-white">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {editingIntro ? (
                        <div className="space-y-2">
                            <textarea
                                value={config.introMessage}
                                onChange={(e) => updateConfig({ introMessage: e.target.value })}
                                className="w-full bg-white/10 text-white rounded-lg p-3 border border-white/20 focus:outline-none focus:border-purple-500 resize-none"
                                rows={3}
                                autoFocus
                            />
                            <button
                                onClick={() => setEditingIntro(false)}
                                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
                            >
                                <Save className="w-3 h-3" /> Fatto
                            </button>
                        </div>
                    ) : (
                        <p className="text-slate-300 italic">"{config.introMessage}"</p>
                    )}
                </div>

                {/* Topics - Fully Editable */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-white">Topic dell'intervista</h3>
                        <button
                            onClick={addTopic}
                            className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 text-sm rounded-lg flex items-center gap-1 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Aggiungi topic
                        </button>
                    </div>

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
                                    {editingTopicIndex === index ? (
                                        <input
                                            type="text"
                                            value={topic.label}
                                            onChange={(e) => updateTopic(index, { label: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-transparent text-white font-medium border-b border-purple-500 focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-white font-medium">{topic.label}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {editingTopicIndex !== index && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingTopicIndex(index); setExpandedTopics(new Set([...expandedTopics, index])); }}
                                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {config.topics.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeTopic(index); }}
                                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {expandedTopics.has(index) ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {expandedTopics.has(index) && (
                                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">
                                    {/* Description */}
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">Descrizione</label>
                                        {editingTopicIndex === index ? (
                                            <textarea
                                                value={topic.description}
                                                onChange={(e) => updateTopic(index, { description: e.target.value })}
                                                className="w-full bg-white/10 text-slate-300 rounded-lg p-2 text-sm border border-white/10 focus:outline-none focus:border-purple-500 resize-none"
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-slate-400 text-sm">{topic.description}</p>
                                        )}
                                    </div>

                                    {/* Sub-goals */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500 uppercase tracking-wide">Sotto-obiettivi</span>
                                            {editingTopicIndex === index && (
                                                <button
                                                    onClick={() => addSubGoal(index)}
                                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" /> Aggiungi
                                                </button>
                                            )}
                                        </div>
                                        <ul className="space-y-1">
                                            {topic.subGoals.map((goal, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-purple-400 mt-1">•</span>
                                                    {editingTopicIndex === index ? (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={goal}
                                                                onChange={(e) => updateSubGoal(index, i, e.target.value)}
                                                                className="flex-1 bg-white/10 text-slate-300 rounded px-2 py-1 text-sm border border-white/10 focus:outline-none focus:border-purple-500"
                                                            />
                                                            {topic.subGoals.length > 1 && (
                                                                <button
                                                                    onClick={() => removeSubGoal(index, i)}
                                                                    className="text-slate-500 hover:text-red-400"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-sm">{goal}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {editingTopicIndex === index && (
                                        <button
                                            onClick={() => setEditingTopicIndex(null)}
                                            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
                                        >
                                            <Save className="w-3 h-3" /> Fatto
                                        </button>
                                    )}
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

            {/* Simulator Modal */}
            {showSimulator && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col relative">
                        <button
                            onClick={() => setShowSimulator(false)}
                            className="absolute top-4 right-4 z-50 p-2 bg-white/80 hover:bg-white rounded-full text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <SimulatorChat config={config} onClose={() => setShowSimulator(false)} />
                    </div>
                </div>
            )}

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-md w-full bg-slate-800 rounded-2xl overflow-hidden p-8 text-center space-y-6 border border-slate-700">
                        <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="2xl font-bold text-white mb-2">Quasi fatto!</h3>
                            <p className="text-slate-300">
                                Per salvare e pubblicare la tua intervista, devi creare un account gratuito.
                                La tua configurazione verrà salvata automaticamente.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    // Redirect to register, preserving current path as callback
                                    window.location.href = `/register?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
                                }}
                                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
                            >
                                Registrati per salvare
                            </button>
                            <button
                                onClick={() => setShowAuthModal(false)}
                                className="w-full px-6 py-3 text-slate-400 hover:text-white transition-colors"
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

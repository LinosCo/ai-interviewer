'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    Edit2,
    Link2,
    Plus,
    Play,
    Share2,
    Sparkles,
    Trash2,
    X,
    Save
} from 'lucide-react';
import SimulatorChat from '@/components/simulator/simulator-chat';
import { colors, gradients, shadows } from '@/lib/design-system';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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
    const [showAuthModal, setShowAuthModal] = useState(false);

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

    const updateSubGoal = (topicIndex: number, goalIndex: number, value: string) => {
        if (!config) return;
        const newTopics = [...config.topics];
        const newSubGoals = [...newTopics[topicIndex].subGoals];
        newSubGoals[goalIndex] = value;
        newTopics[topicIndex] = { ...newTopics[topicIndex], subGoals: newSubGoals };
        updateConfig({ topics: newTopics });
    };

    const removeSubGoal = (topicIndex: number, goalIndex: number) => {
        if (!config) return;
        const newTopics = [...config.topics];
        const newSubGoals = newTopics[topicIndex].subGoals.filter((_, i) => i !== goalIndex);
        newTopics[topicIndex] = { ...newTopics[topicIndex], subGoals: newSubGoals };
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
        const newTopics = [...config.topics];
        const newSubGoals = [...newTopics[topicIndex].subGoals, 'Nuovo obiettivo'];
        newTopics[topicIndex] = { ...newTopics[topicIndex], subGoals: newSubGoals };
        updateConfig({ topics: newTopics });
    };

    const toggleTopic = (index: number) => {
        if (editingTopicIndex !== null && editingTopicIndex !== index) return;
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
            <div className="min-h-screen flex items-center justify-center" style={{ background: gradients.mesh }}>
                <div className="text-gray-800 font-medium">Caricamento...</div>
            </div>
        );
    }

    // Published Success View
    if (publishedSlug) {
        const interviewLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/i/${publishedSlug}`;

        return (
            <div className="min-h-screen flex flex-col" style={{ background: gradients.mesh }}>
                <Header />
                <main className="flex-1 flex items-center justify-center p-6">
                    <div style={{
                        maxWidth: '500px',
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px',
                        padding: '2.5rem',
                        border: '1px solid rgba(255, 255, 255, 0.5)',
                        boxShadow: shadows.xl,
                        textAlign: 'center'
                    }}>
                        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <Check className="w-10 h-10 text-green-600" />
                        </div>

                        <div className="space-y-2 mb-8">
                            <h2 className="text-3xl font-bold text-gray-900">Intervista pubblicata!</h2>
                            <p className="text-gray-600">La tua intervista è pronta. Condividi il link per iniziare a raccogliere risposte.</p>
                        </div>

                        <div className="bg-white/50 rounded-xl p-4 flex items-center gap-3 mb-8 border border-white/60">
                            <Link2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 truncate flex-1 text-left font-mono text-sm">{interviewLink}</span>
                            <button
                                onClick={copyLink}
                                className="px-4 py-2 text-white rounded-lg text-sm flex items-center gap-2 transition-colors font-medium"
                                style={{ background: gradients.primary }}
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copiato!' : 'Copia'}
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex-1 px-6 py-3 bg-white/50 hover:bg-white text-gray-700 font-medium rounded-xl transition-colors border border-gray-200"
                            >
                                Vai alla dashboard
                            </button>
                            <button
                                onClick={() => router.push('/onboarding')}
                                className="flex-1 px-6 py-3 text-white font-medium rounded-xl transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                style={{ background: gradients.primary, boxShadow: shadows.amber }}
                            >
                                Crea un'altra
                            </button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    // Preview & Edit View
    return (
        <div className="min-h-screen flex flex-col" style={{ background: gradients.mesh }}>
            <Header />

            <main className="max-w-3xl mx-auto p-6 space-y-8 pb-32 w-full flex-1">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/onboarding')}
                    className="text-gray-500 hover:text-amber-600 transition-colors font-medium flex items-center gap-2"
                >
                    ← Modifica obiettivo iniziale
                </button>

                {/* Name - Editable */}
                <div className="space-y-2">
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={config.name || 'La mia intervista'}
                                onChange={(e) => updateConfig({ name: e.target.value })}
                                className="text-3xl font-bold bg-transparent text-gray-900 border-b-2 border-amber-500 focus:outline-none w-full"
                                autoFocus
                                onBlur={() => setEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setEditingName(true)}
                            className="text-3xl font-bold text-gray-900 flex items-center gap-2 hover:text-amber-600 transition-colors text-left"
                        >
                            {config.name || 'La mia intervista'}
                            <Edit2 className="w-5 h-5 opacity-30 hover:opacity-100" />
                        </button>
                    )}
                    <p className="text-sm text-gray-500">Clicca per modificare nome, obiettivo o topic per affinare l'intervista.</p>
                </div>

                {/* Research Goal - Editable */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-600">
                            <Sparkles className="w-5 h-5" />
                            <span className="font-semibold">Obiettivo della ricerca</span>
                        </div>
                        {!editingGoal && (
                            <button onClick={() => setEditingGoal(true)} className="text-gray-400 hover:text-amber-600">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {editingGoal ? (
                        <div className="space-y-3">
                            <textarea
                                value={config.researchGoal}
                                onChange={(e) => updateConfig({ researchGoal: e.target.value })}
                                className="w-full bg-white text-gray-900 rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none shadow-inner"
                                rows={3}
                                autoFocus
                            />
                            <button
                                onClick={() => setEditingGoal(false)}
                                className="px-3 py-1.5 text-white text-sm rounded-lg flex items-center gap-1 font-medium shadow-sm transition-transform active:scale-95"
                                style={{ background: gradients.primary }}
                            >
                                <Save className="w-3 h-3" /> Salva
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-700 leading-relaxed">{config.researchGoal}</p>
                    )}
                </div>

                {/* Intro Message - Editable */}
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/60 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Messaggio di benvenuto</span>
                        {!editingIntro && (
                            <button onClick={() => setEditingIntro(true)} className="text-gray-400 hover:text-amber-600">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {editingIntro ? (
                        <div className="space-y-3">
                            <textarea
                                value={config.introMessage}
                                onChange={(e) => updateConfig({ introMessage: e.target.value })}
                                className="w-full bg-white text-gray-900 rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none shadow-inner"
                                rows={3}
                                autoFocus
                            />
                            <button
                                onClick={() => setEditingIntro(false)}
                                className="px-3 py-1.5 text-white text-sm rounded-lg flex items-center gap-1 font-medium shadow-sm transition-transform active:scale-95"
                                style={{ background: gradients.primary }}
                            >
                                <Save className="w-3 h-3" /> Fatto
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-600 italic">"{config.introMessage}"</p>
                    )}
                </div>

                {/* Topics - Fully Editable */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">Piano dell'intervista</h3>
                        <button
                            onClick={addTopic}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm rounded-lg flex items-center gap-1 transition-colors font-medium"
                        >
                            <Plus className="w-4 h-4" /> Aggiungi topic
                        </button>
                    </div>

                    {config.topics.map((topic, index) => (
                        <div
                            key={index}
                            className="bg-white/80 backdrop-blur-sm rounded-xl border border-white shadow-sm overflow-hidden"
                        >
                            <button
                                onClick={() => toggleTopic(index)}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-sm font-bold">
                                        {index + 1}
                                    </span>
                                    {editingTopicIndex === index ? (
                                        <input
                                            type="text"
                                            value={topic.label}
                                            onChange={(e) => updateTopic(index, { label: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-transparent text-gray-900 font-bold border-b border-amber-500 focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="text-gray-900 font-bold">{topic.label}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {editingTopicIndex !== index && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingTopicIndex(index); setExpandedTopics(new Set([...expandedTopics, index])); }}
                                            className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {config.topics.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeTopic(index); }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {expandedTopics.has(index) ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </button>

                            {expandedTopics.has(index) && (
                                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3 bg-gray-50/50">
                                    {/* Description */}
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1 font-semibold">Descrizione</label>
                                        {editingTopicIndex === index ? (
                                            <textarea
                                                value={topic.description}
                                                onChange={(e) => updateTopic(index, { description: e.target.value })}
                                                className="w-full bg-white text-gray-800 rounded-lg p-2 text-sm border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                                                rows={2}
                                            />
                                        ) : (
                                            <p className="text-gray-600 text-sm">{topic.description}</p>
                                        )}
                                    </div>

                                    {/* Sub-goals */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Cosa scoprire</span>
                                            {editingTopicIndex === index && (
                                                <button
                                                    onClick={() => addSubGoal(index)}
                                                    className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium"
                                                >
                                                    <Plus className="w-3 h-3" /> Aggiungi
                                                </button>
                                            )}
                                        </div>
                                        <ul className="space-y-2">
                                            {topic.subGoals.map((goal, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-amber-500 mt-1.5">•</span>
                                                    {editingTopicIndex === index ? (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={goal}
                                                                onChange={(e) => updateSubGoal(index, i, e.target.value)}
                                                                className="flex-1 bg-white text-gray-800 rounded px-2 py-1 text-sm border border-gray-200 focus:outline-none focus:border-amber-500"
                                                            />
                                                            {topic.subGoals.length > 1 && (
                                                                <button
                                                                    onClick={() => removeSubGoal(index, i)}
                                                                    className="text-gray-400 hover:text-red-500"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 text-sm">{goal}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {editingTopicIndex === index && (
                                        <button
                                            onClick={() => setEditingTopicIndex(null)}
                                            className="px-3 py-1.5 text-white text-sm rounded-lg flex items-center gap-1 font-medium shadow-sm transition-transform active:scale-95"
                                            style={{ background: gradients.primary }}
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
                        className="flex-1 px-6 py-4 bg-white hover:bg-gray-50 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg border border-gray-200"
                    >
                        <Play className="w-5 h-5 text-amber-500" fill="currentColor" />
                        Prova l'intervista
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="flex-1 px-6 py-4 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ background: gradients.primary, boxShadow: shadows.amber }}
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

            <Footer />

            {/* Simulator Modal */}
            {showSimulator && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-4xl h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col relative border-4 border-white">
                        <SimulatorChat config={config} onClose={() => setShowSimulator(false)} />
                    </div>
                </div>
            )}

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="max-w-md w-full bg-white rounded-3xl overflow-hidden p-8 text-center space-y-6 shadow-2xl border border-white/50">
                        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Quasi fatto!</h3>
                            <p className="text-gray-500">
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
                                className="w-full px-6 py-3 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                style={{ background: gradients.primary }}
                            >
                                Registrati per salvare
                            </button>
                            <button
                                onClick={() => setShowAuthModal(false)}
                                className="w-full px-6 py-3 text-gray-500 hover:text-gray-900 transition-colors font-medium"
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

// ... imports and interfaces are kept in memory or assumed to be in view (I pasted full content)

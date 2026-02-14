'use client';

import { useState } from 'react';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Edit2,
    Plus,
    Play,
    Sparkles,
    Trash2,
    X,
    Save,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import SimulatorChat from '@/components/simulator/simulator-chat';

interface TopicConfig {
    label: string;
    description: string;
    subGoals: string[];
    maxTurns: number;
}

interface WizardStepPreviewProps {
    config: any;
    projectId?: string;
    onBack: () => void;
}

export default function WizardStepPreview({ config: initialConfig, projectId, onBack }: WizardStepPreviewProps) {
    const router = useRouter();
    const [config, setConfig] = useState(initialConfig);
    const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
    const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set([0]));
    const [isPublishing, setIsPublishing] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [isRefining, setIsRefining] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateConfig = (updates: any) => {
        setConfig({ ...config, ...updates });
    };

    const updateTopic = (index: number, updates: Partial<TopicConfig>) => {
        const newTopics = [...config.topics];
        newTopics[index] = { ...newTopics[index], ...updates };
        updateConfig({ topics: newTopics });
    };

    const updateSubGoal = (topicIndex: number, goalIndex: number, value: string) => {
        const newTopics = [...config.topics];
        const newSubGoals = [...newTopics[topicIndex].subGoals];
        newSubGoals[goalIndex] = value;
        newTopics[topicIndex] = { ...newTopics[topicIndex], subGoals: newSubGoals };
        updateConfig({ topics: newTopics });
    };

    const removeSubGoal = (topicIndex: number, goalIndex: number) => {
        const newTopics = [...config.topics];
        const newSubGoals = newTopics[topicIndex].subGoals.filter((_: any, i: number) => i !== goalIndex);
        newTopics[topicIndex] = { ...newTopics[topicIndex], subGoals: newSubGoals };
        updateConfig({ topics: newTopics });
    };

    const addTopic = () => {
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
        if (config.topics.length <= 1) return;
        const newTopics = config.topics.filter((_: any, i: number) => i !== index);
        updateConfig({ topics: newTopics });
        setEditingTopicIndex(null);
    };

    const addSubGoal = (topicIndex: number) => {
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

    const handleRefine = async (fieldType: string, currentText: string, context?: any) => {
        if (!currentText) return;
        const refId = fieldType === 'subGoal' ? `subGoal-${context.topicIndex}-${context.goalIndex}` : `${fieldType}-${context?.index ?? ''}`;
        setIsRefining(refId);
        try {
            const response = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: currentText,
                    fieldType,
                    context: JSON.stringify(context)
                }),
            });
            if (response.ok) {
                const { refinedText } = await response.json();
                if (fieldType === 'topicLabel') updateTopic(context.index, { label: refinedText });
                if (fieldType === 'topicDescription') updateTopic(context.index, { description: refinedText });
                if (fieldType === 'subGoal') updateSubGoal(context.topicIndex, context.goalIndex, refinedText);
            }
        } catch (err) {
            console.error('Refine error:', err);
        } finally {
            setIsRefining(null);
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        setError(null);

        try {
            const response = await fetch('/api/bots/create-from-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    botType: 'interviewer',
                    projectId: projectId || undefined
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Errore nella pubblicazione');
            }

            const result = await response.json();
            // Redirect to success page or bot dashboard
            router.push(`/dashboard/bots/${result.botId}`);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Errore nella pubblicazione');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        Piano dell'intervista
                    </h2>
                    <p className="text-sm text-gray-500">Rivedi i temi e le domande che verranno affrontate.</p>
                </div>
                <button
                    onClick={addTopic}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm rounded-lg flex items-center gap-1.5 transition-colors font-bold border border-amber-200"
                >
                    <Plus className="w-4 h-4" /> Topic
                </button>
            </div>

            <div className="space-y-4">
                {config.topics.map((topic: TopicConfig, index: number) => (
                    <div
                        key={index}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                        <button
                            onClick={() => toggleTopic(index)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-orange-50/10 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-sm font-bold">
                                    {index + 1}
                                </span>
                                {editingTopicIndex === index ? (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={topic.label}
                                            onChange={(e) => updateTopic(index, { label: e.target.value })}
                                            className="bg-white px-2 py-1 text-gray-900 font-bold border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleRefine('topicLabel', topic.label, { index })}
                                            disabled={isRefining === `topicLabel-${index}`}
                                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                                        >
                                            <Sparkles size={14} className={isRefining === `topicLabel-${index}` ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
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

                        <AnimatePresence>
                            {expandedTopics.has(index) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-4 bg-orange-50/5"
                                >
                                    {/* Description */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Descrizione Topic</label>
                                            {editingTopicIndex === index && (
                                                <button
                                                    onClick={() => handleRefine('topicDescription', topic.description, { index })}
                                                    disabled={isRefining === `topicDescription-${index}`}
                                                    className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-bold disabled:opacity-50"
                                                >
                                                    <Sparkles size={12} className={isRefining === `topicDescription-${index}` ? 'animate-spin' : ''} />
                                                    Raffina con AI
                                                </button>
                                            )}
                                        </div>
                                        {editingTopicIndex === index ? (
                                            <textarea
                                                value={topic.description}
                                                onChange={(e) => updateTopic(index, { description: e.target.value })}
                                                className="w-full bg-white text-gray-800 rounded-lg p-3 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none min-h-[60px]"
                                            />
                                        ) : (
                                            <p className="text-gray-600 text-sm leading-relaxed">{topic.description}</p>
                                        )}
                                    </div>

                                    {/* Sub-goals */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cosa vogliamo scoprire</span>
                                            {editingTopicIndex === index && (
                                                <button
                                                    onClick={() => addSubGoal(index)}
                                                    className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-bold"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Aggiungi
                                                </button>
                                            )}
                                        </div>
                                        <ul className="space-y-3">
                                            {topic.subGoals.map((g, i) => (
                                                <li key={i} className="flex items-start gap-2.5 group/goal">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                                    {editingTopicIndex === index ? (
                                                        <div className="flex-1 flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-100 hover:border-amber-200 transition-colors">
                                                            <input
                                                                type="text"
                                                                value={g}
                                                                onChange={(e) => updateSubGoal(index, i, e.target.value)}
                                                                className="flex-1 bg-transparent text-gray-800 py-1 text-sm outline-none"
                                                            />
                                                            <button
                                                                onClick={() => handleRefine('subGoal', g, { topicIndex: index, goalIndex: i })}
                                                                disabled={isRefining === `subGoal-${index}-${i}`}
                                                                className="text-amber-500 hover:text-amber-700 disabled:opacity-50"
                                                            >
                                                                <Sparkles size={14} className={isRefining === `subGoal-${index}-${i}` ? 'animate-spin' : ''} />
                                                            </button>
                                                            {topic.subGoals.length > 1 && (
                                                                <button
                                                                    onClick={() => removeSubGoal(index, i)}
                                                                    className="text-gray-300 hover:text-red-500"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 text-sm flex-1">{g}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {editingTopicIndex === index && (
                                        <button
                                            onClick={() => setEditingTopicIndex(null)}
                                            className="w-full py-2.5 bg-gray-900 text-white text-xs rounded-lg flex items-center justify-center gap-2 font-bold hover:bg-gray-800 transition-colors"
                                        >
                                            <Save size={14} />
                                            Salva Modifiche
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button
                    onClick={() => setShowSimulator(true)}
                    className="flex-1 px-6 py-4 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm border border-gray-200"
                >
                    <Play className="w-5 h-5 text-amber-500" fill="currentColor" />
                    Prova l'intervista
                </button>
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isPublishing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Pubblicazione...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Pubblica Intervista
                        </>
                    )}
                </button>
            </div>

            <div className="flex justify-center">
                <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    ← Torna alla configurazione
                </button>
            </div>

            {/* Simulator Modal */}
            {showSimulator && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="w-full max-w-4xl h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col relative border-4 border-white">
                        <SimulatorChat config={config} onClose={() => setShowSimulator(false)} />
                    </div>
                </div>
            )}
        </motion.div>
    );
}

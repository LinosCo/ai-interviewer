'use client';

import { TopicBlock } from '@prisma/client';
import { addTopicAction, deleteTopicAction, updateTopicAction } from '@/app/actions';
import { useState } from 'react';

import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';

export default function TopicsEditor({ botId, topics, canUseConditionalLogic = false }: { botId: string, topics: TopicBlock[], canUseConditionalLogic?: boolean }) {
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleAdd = async () => {
        const nextIndex = topics.length;
        await addTopicAction(botId, nextIndex);
    };

    return (
        <div className="bg-white p-6 rounded shadow">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-semibold">Conversation Flow</h2>
                <button onClick={handleAdd} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100">
                    + Add Topic
                </button>
            </div>

            <div className="space-y-4">
                {topics.map((topic, index) => (
                    <TopicCard
                        key={topic.id}
                        topic={topic}
                        index={index}
                        botId={botId}
                        isEditing={editingId === topic.id}
                        onEdit={() => setEditingId(topic.id)}
                        onCancel={() => setEditingId(null)}
                        canUseConditionalLogic={canUseConditionalLogic}
                    />
                ))}
            </div>
        </div>
    );
}

import { RefinableField } from '@/components/refinable-field';
import { Plus, Trash2, GripVertical } from 'lucide-react';

function TopicCard({ topic, index, botId, isEditing, onEdit, onCancel, canUseConditionalLogic }: any) {
    const updateAction = updateTopicAction.bind(null, topic.id, botId);

    // Parse subgoals from array (or string if legacy) to manageable state
    // We treat them as array in UI, join them for submission
    const [localSubGoals, setLocalSubGoals] = useState<string[]>(topic.subGoals || []);

    const handleAddSubGoal = () => {
        setLocalSubGoals([...localSubGoals, ""]);
    };

    const handleSubGoalChange = (idx: number, val: string) => {
        const newGoals = [...localSubGoals];
        newGoals[idx] = val;
        setLocalSubGoals(newGoals);
    };

    const handleRemoveSubGoal = (idx: number) => {
        const newGoals = [...localSubGoals];
        newGoals.splice(idx, 1);
        setLocalSubGoals(newGoals);
    };

    if (isEditing) {
        return (
            <div className="border border-blue-500 rounded-lg p-6 bg-blue-50/50 shadow-sm relative">
                <div className="absolute top-0 right-0 p-2 bg-blue-100 rounded-bl-lg text-xs font-bold text-blue-700">
                    EDITING
                </div>
                <form action={async (formData) => {
                    const data = {
                        label: formData.get('label'),
                        description: formData.get('description'),
                        subGoals: localSubGoals.join('\n'), // Join manually
                        maxTurns: formData.get('maxTurns'),
                    };
                    await updateAction(data);
                    onCancel();
                }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="md:col-span-2">
                            <RefinableField
                                label="Topic Label"
                                name="label"
                                value={topic.label}
                                context={`Topic ${index + 1}`}
                                className="w-full bg-white font-medium"
                                placeholder="e.g. Work History"
                            />
                            <p className="text-xs text-gray-500 mt-1">Short name for the topic (internal & user facing).</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Max Turns (Depth)</label>
                            <input
                                type="number"
                                name="maxTurns"
                                defaultValue={topic.maxTurns}
                                className="w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Approx. questions to ask.</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <RefinableField
                            label="Context & Description"
                            name="description"
                            value={topic.description || ''}
                            context={`Topic ${index + 1}: ${topic.label}`}
                            multiline
                            className="w-full bg-white"
                            placeholder="Explain to the AI what this topic is about..."
                            rows={3}
                        />
                        <p className="text-xs text-gray-500 mt-1">Briefly explain the purpose of this section to the AI interviewer.</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                            Sub-Goals / Key Questions
                        </label>
                        <div className="space-y-2">
                            {localSubGoals.map((goal, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <div className="bg-white border rounded-md px-3 py-2 flex-grow shadow-sm focus-within:ring-1 ring-blue-500">
                                        <input
                                            type="text"
                                            value={goal}
                                            onChange={(e) => handleSubGoalChange(i, e.target.value)}
                                            className="w-full text-sm outline-none"
                                            placeholder={`Sub-goal #${i + 1}`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSubGoal(i)}
                                        className="text-gray-400 hover:text-red-500 p-2"
                                        title="Remove"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddSubGoal}
                                className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 mt-2"
                            >
                                <Plus size={16} /> Add Sub-Goal
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Specific points or questions the AI should cover before moving on.
                        </p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Icons.GitBranch size={16} className="text-gray-400" />
                                Conditional Logic
                                {!canUseConditionalLogic && <Icons.Lock size={12} className="text-amber-500" />}
                            </label>
                            {!canUseConditionalLogic && (
                                <Link href="/dashboard/billing/plans" className="text-xs text-white bg-amber-500 px-2 py-0.5 rounded-full font-bold hover:bg-amber-600">
                                    Upgrade to PRO
                                </Link>
                            )}
                        </div>
                        <div className={`p-4 rounded-lg border ${canUseConditionalLogic ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                            <p className="text-sm text-gray-600">
                                {canUseConditionalLogic
                                    ? "Advanced branching and skip logic configuration coming soon."
                                    : "Upgrade to enable skip logic and advanced flow control."}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end mt-8 border-t pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition-colors">Save Changes</button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start group hover:shadow-md transition-all duration-200">
            <div className="flex-grow cursor-pointer" onClick={onEdit}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                        {index + 1}
                    </div>
                    <span className="font-bold text-gray-900 text-lg">{topic.label}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                        ~{topic.maxTurns} turns
                    </span>
                </div>
                <div className="pl-11 pr-4">
                    {topic.description && (
                        <p className="text-sm text-gray-600 mb-3 leading-relaxed">{topic.description}</p>
                    )}

                    {topic.subGoals && topic.subGoals.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {topic.subGoals.map((sg: string, i: number) => (
                                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                    {sg}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-1">
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Icons.Edit size={18} />
                </button>
                <button onClick={() => deleteTopicAction(topic.id, botId)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    )
}

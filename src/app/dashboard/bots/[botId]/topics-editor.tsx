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

function TopicCard({ topic, index, botId, isEditing, onEdit, onCancel, canUseConditionalLogic }: any) {
    const updateAction = updateTopicAction.bind(null, topic.id, botId);

    if (isEditing) {
        return (
            <div className="border border-blue-500 rounded p-4 bg-blue-50">
                <form action={async (formData) => {
                    const data = {
                        label: formData.get('label'),
                        description: formData.get('description'),
                        subGoals: formData.get('subGoals'),
                        maxTurns: formData.get('maxTurns'),
                    };
                    await updateAction(data);
                    onCancel();
                }}>
                    <div className="grid grid-cols-2 gap-4 mb-2">
                        <RefinableField
                            label="Label"
                            name="label"
                            value={topic.label}
                            context={`Topic ${index + 1}`}
                            className="w-full"
                        />
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Max Turns</label>
                            <input type="number" name="maxTurns" defaultValue={topic.maxTurns} className="w-full p-1 border rounded" />
                        </div>
                    </div>
                    <div className="mb-2">
                        <RefinableField
                            label="Description (Purpose)"
                            name="description"
                            value={topic.description || ''}
                            context={`Topic ${index + 1}: ${topic.label}`}
                            multiline
                            className="w-full"
                        />
                    </div>
                    <div className="mb-2">
                        <RefinableField
                            label="Sub-Goals (One per line)"
                            name="subGoals"
                            value={topic.subGoals.join('\n')}
                            context={`Topic ${index + 1}: ${topic.label}`}
                            multiline
                            className="w-full"
                        />
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                                Logica Condizionale
                                {!canUseConditionalLogic && <Icons.Lock size={12} className="text-amber-500" />}
                            </label>
                            {!canUseConditionalLogic && (
                                <Link href="/dashboard/billing/plans" className="text-[10px] text-amber-600 font-bold hover:underline">
                                    Sblocca con PRO
                                </Link>
                            )}
                        </div>
                        <div className={`p-3 rounded border ${canUseConditionalLogic ? 'bg-white' : 'bg-gray-100 opacity-60'}`}>
                            <p className="text-xs text-gray-500 italic">
                                {canUseConditionalLogic
                                    ? "Configura salti o condizioni basate sulle risposte degli utenti (Sviluppo in corso)."
                                    : "Permette di saltare argomenti o terminare l'intervista in base a criteri specifici."}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-4">
                        <button type="button" onClick={onCancel} className="text-gray-500 text-sm">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Save</button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="border rounded p-3 flex justify-between items-start group hover:shadow-sm bg-gray-50">
            <div className="flex-grow cursor-pointer" onClick={onEdit}>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700 w-6">{index + 1}.</span>
                    <span className="font-medium">{topic.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-1 rounded">{topic.maxTurns} turns</span>
                </div>
                <div className="pl-8 text-sm text-gray-600 mt-1">
                    {topic.description}
                </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={onEdit} className="text-gray-400 hover:text-blue-500">Edit</button>
                <button onClick={() => deleteTopicAction(topic.id, botId)} className="text-gray-400 hover:text-red-500">Delete</button>
            </div>
        </div>
    )
}

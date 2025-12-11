'use client';

import { TopicBlock } from '@prisma/client';
import { addTopicAction, deleteTopicAction, updateTopicAction } from '@/app/actions';
import { useState } from 'react';

export default function TopicsEditor({ botId, topics }: { botId: string, topics: TopicBlock[] }) {
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
                    />
                ))}
            </div>
        </div>
    );
}

function TopicCard({ topic, index, botId, isEditing, onEdit, onCancel }: any) {
    const updateAction = updateTopicAction.bind(null, topic.id, botId);

    // Local state for immediate feedback or we just rely on form defaultValues

    if (isEditing) {
        return (
            <div className="border border-blue-500 rounded p-4 bg-blue-50">
                <form action={async (formData) => {
                    // Extract data manually to handle subGoals transformation
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
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Label</label>
                            <input name="label" defaultValue={topic.label} className="w-full p-1 border rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500">Max Turns</label>
                            <input type="number" name="maxTurns" defaultValue={topic.maxTurns} className="w-full p-1 border rounded" />
                        </div>
                    </div>
                    <div className="mb-2">
                        <label className="text-xs font-bold uppercase text-gray-500">Description (Purpose)</label>
                        <textarea name="description" defaultValue={topic.description || ''} className="w-full p-1 border rounded h-16" />
                    </div>
                    <div className="mb-2">
                        <label className="text-xs font-bold uppercase text-gray-500">Sub-Goals (One per line)</label>
                        <textarea name="subGoals" defaultValue={topic.subGoals.join('\n')} className="w-full p-1 border rounded h-24" placeholder="- Ask about X..." />
                    </div>
                    <div className="flex gap-2 justify-end">
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

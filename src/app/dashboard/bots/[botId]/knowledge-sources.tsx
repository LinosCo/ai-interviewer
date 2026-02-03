'use client';

import { KnowledgeSource } from '@prisma/client';
import { addKnowledgeSourceAction, deleteKnowledgeSourceAction } from '@/app/actions';
import { useState } from 'react';

import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';

export default function KnowledgeSourcesEditor({ botId, sources, disabled = false }: { botId: string, sources: KnowledgeSource[], disabled?: boolean }) {
    const [isAdding, setIsAdding] = useState(false);

    // Bind actions
    const addAction = addKnowledgeSourceAction.bind(null, botId);

    const handleDelete = async (id: string) => {
        if (disabled) return;
        if (!confirm('Are you sure you want to delete this source?')) return;
        await deleteKnowledgeSourceAction(id, botId);
    };

    return (
        <div className={`bg-white p-6 rounded shadow relative overflow-hidden ${disabled ? 'opacity-80' : ''}`}>
            {disabled && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-amber-100 p-3 rounded-full mb-3 text-amber-600">
                        <Icons.Lock size={24} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Knowledge Base (PRO)</h3>
                    <p className="text-xs text-gray-500 mb-4">Aggiungi file e manuali per rendere l&apos;AI ancora più intelligente.</p>
                    <Link href="/dashboard/billing/plans">
                        <button className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-amber-600 shadow-sm">
                            Effettua l&apos;upgrade
                        </button>
                    </Link>
                </div>
            )}
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Knowledge Sources</h2>
            <p className="text-sm text-gray-500 mb-4">Add text content or guidelines for the bot to reference.</p>

            <ul className="space-y-3 mb-6">
                {sources.map(ks => (
                    <li key={ks.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                        <div>
                            <div className="font-medium text-sm">{ks.title}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{ks.content.substring(0, 50)}...</div>
                        </div>
                        <button
                            onClick={() => handleDelete(ks.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                        >
                            Delete
                        </button>
                    </li>
                ))}
                {sources.length === 0 && (
                    <li className="text-sm text-gray-400 italic text-center py-2">No sources added yet.</li>
                )}
            </ul>

            {isAdding ? (
                <form action={async (formData) => {
                    await addAction(formData);
                    setIsAdding(false);
                }} className="border p-4 rounded bg-gray-50 space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1">Title</label>
                        <input name="title" className="w-full border p-2 rounded text-sm" placeholder="e.g. Interview Guidelines" required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Content</label>
                        <textarea name="content" className="w-full border p-2 rounded text-sm h-32" placeholder="Paste text here..." required />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="text-xs text-gray-600 px-3 py-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >
                            Add Source
                        </button>
                    </div>
                </form>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="w-full border border-dashed border-gray-300 p-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                    + Add New Source
                </button>
            )}
        </div>
    );
}

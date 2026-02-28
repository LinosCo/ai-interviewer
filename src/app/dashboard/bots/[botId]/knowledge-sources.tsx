'use client';

import { KnowledgeSource } from '@prisma/client';
import {
    addKnowledgeSourceAction,
    deleteKnowledgeSourceAction,
    regenerateInterviewGuideAction,
    updateKnowledgeSourceAction
} from '@/app/actions';
import { useState } from 'react';

import { Icons } from '@/components/ui/business-tuner/Icons';
import Link from 'next/link';
import { showToast } from '@/components/toast';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function KnowledgeSourcesEditor({ botId, sources, disabled = false }: { botId: string, sources: KnowledgeSource[], disabled?: boolean }) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [isRegeneratingGuide, setIsRegeneratingGuide] = useState(false);
    const hasInterviewGuide = sources.some((source) => source.type === 'INTERVIEW_GUIDE');

    const knowledgeConfirm = useConfirmDialog();

    // Bind actions
    const addAction = addKnowledgeSourceAction.bind(null, botId);

    const handleDelete = async (id: string) => {
        if (disabled) return;
        const ok = await knowledgeConfirm.open({
            title: 'Elimina fonte',
            description: 'Sei sicuro di voler eliminare questa fonte? L\'azione non è reversibile.',
            confirmLabel: 'Elimina',
            variant: 'destructive',
        });
        if (!ok) return;
        await deleteKnowledgeSourceAction(id, botId);
    };

    const handleRegenerateGuide = async () => {
        if (disabled || isRegeneratingGuide) return;

        const ok = await knowledgeConfirm.open({
            title: hasInterviewGuide ? 'Rigenera Interview Guide' : 'Genera Interview Guide',
            description: hasInterviewGuide
                ? 'Rigenerare la guida sovrascriverà il contenuto corrente della knowledge automatica. Continuare?'
                : 'Generare ora la guida automatica dell\'intervista?',
            confirmLabel: hasInterviewGuide ? 'Rigenera' : 'Genera',
            variant: 'default',
        });
        if (!ok) return;

        setIsRegeneratingGuide(true);
        try {
            await regenerateInterviewGuideAction(botId);
        } catch (error) {
            console.error('Failed to regenerate interview guide:', error);
            showToast('Non sono riuscito a rigenerare la guida. Riprova.', 'error');
        } finally {
            setIsRegeneratingGuide(false);
        }
    };

    return (
        <div className={`bg-white p-6 rounded shadow relative overflow-hidden ${disabled ? 'opacity-80' : ''}`}>
            {disabled && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-amber-100 p-3 rounded-full mb-3 text-amber-600">
                        <Icons.Lock size={24} />
                    </div>
                    <h3 className="font-bold text-stone-900 mb-1">Knowledge Base (PRO)</h3>
                    <p className="text-xs text-stone-500 mb-4">Aggiungi file e manuali per rendere l&apos;AI ancora più intelligente.</p>
                    <Link href="/dashboard/billing/plans">
                        <button className="bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-amber-600 shadow-sm">
                            Effettua l&apos;upgrade
                        </button>
                    </Link>
                </div>
            )}
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">Knowledge Sources</h2>
            <p className="text-sm text-stone-500 mb-4">Add text content or guidelines for the bot to reference.</p>

            <button
                type="button"
                onClick={handleRegenerateGuide}
                disabled={disabled || isRegeneratingGuide}
                className="mb-4 w-full text-sm border border-amber-300 bg-amber-50 text-amber-800 rounded p-2 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {isRegeneratingGuide
                    ? 'Rigenerazione in corso...'
                    : hasInterviewGuide
                        ? 'Rigenera Interview Guide automatica'
                        : 'Genera Interview Guide automatica'}
            </button>

            <ul className="space-y-3 mb-6">
                {sources.map(ks => (
                    <li key={ks.id} className="flex justify-between items-center bg-stone-50 p-2 rounded border">
                        {editingSourceId === ks.id ? (
                            <form
                                action={async (formData) => {
                                    await updateKnowledgeSourceAction(ks.id, botId, formData);
                                    setEditingSourceId(null);
                                }}
                                className="w-full space-y-2"
                            >
                                <input
                                    name="title"
                                    defaultValue={ks.title || ''}
                                    className="w-full border p-2 rounded text-sm"
                                    placeholder="Source title"
                                    required
                                />
                                <textarea
                                    name="content"
                                    defaultValue={ks.content}
                                    className="w-full border p-2 rounded text-sm h-36"
                                    placeholder="Source content"
                                    required
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingSourceId(null)}
                                        className="text-xs text-stone-600 px-3 py-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                    >
                                        Save
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="min-w-0">
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        <span>{ks.title}</span>
                                        {ks.type === 'INTERVIEW_GUIDE' && (
                                            <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                Auto
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-stone-500 truncate max-w-[280px]">{ks.content.substring(0, 110)}...</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingSourceId(ks.id)}
                                        className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1"
                                        disabled={disabled}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ks.id)}
                                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
                                        disabled={disabled}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </li>
                ))}
                {sources.length === 0 && (
                    <li className="text-sm text-stone-400 italic text-center py-2">No sources added yet.</li>
                )}
            </ul>

            {isAdding ? (
                <form action={async (formData) => {
                    await addAction(formData);
                    setIsAdding(false);
                }} className="border p-4 rounded bg-stone-50 space-y-3">
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
                            className="text-xs text-stone-600 px-3 py-1"
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
                    className="w-full border border-dashed border-stone-300 p-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                    + Add New Source
                </button>
            )}

            <ConfirmDialog {...knowledgeConfirm.dialogProps} />
        </div>
    );
}

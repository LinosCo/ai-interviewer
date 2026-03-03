'use client';

import { useState } from "react";
import { approveGap, dismissGap } from "./actions";
import { Loader2, Check } from "lucide-react";
import { showToast } from '@/components/toast';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog';

interface GapCardProps {
    gap: any;
    botId: string;
}

export default function GapCard({ gap, botId }: GapCardProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [editedQ, setEditedQ] = useState(gap.suggestedFaq?.question || "");
    const [editedA, setEditedA] = useState(gap.suggestedFaq?.answer || "");

    const gapConfirm = useConfirmDialog();

    const handleApprove = async () => {
        setIsLoading(true);
        try {
            await approveGap(botId, gap.id, editedQ, editedA);
        } catch (error) {
            console.error(error);
            showToast("Approvazione fallita. Riprova.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = async () => {
        const ok = await gapConfirm.open({
            title: 'Scarta lacuna',
            description: "Questa lacuna non verrà più suggerita. Continuare?",
            confirmLabel: 'Scarta',
            variant: 'destructive',
        });
        if (!ok) return;

        setIsLoading(true);
        try {
            await dismissGap(botId, gap.id);
        } catch (error) {
            console.error(error);
            showToast("Dismissione fallita. Riprova.", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${gap.priority === 'high' ? 'bg-red-100 text-red-700' :
                            gap.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-700'
                            }`}>
                            {gap.priority} Priority
                        </span>
                        <h3 className="font-semibold text-slate-800">{gap.topic}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Found in {gap.evidence?.fallbackCount || 0} conversations</p>
                </div>
            </div>

            {/* Content Form */}
            <div className="space-y-3 bg-slate-50 p-3 rounded text-sm">
                <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">User Question</label>
                    <input
                        className="w-full border border-slate-200 rounded px-2 py-1"
                        value={editedQ}
                        onChange={(e) => setEditedQ(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Suggested Answer</label>
                    <textarea
                        className="w-full border border-slate-200 rounded px-2 py-1 min-h-[60px]"
                        value={editedA}
                        onChange={(e) => setEditedA(e.target.value)}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={handleDismiss}
                    disabled={isLoading}
                    className="text-slate-500 hover:text-slate-700 px-3 py-1 text-sm rounded border border-transparent hover:border-slate-200"
                >
                    Dismiss
                </button>
                <button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm rounded flex items-center gap-1 shadow-sm"
                >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Add to Knowledge
                </button>
            </div>

            <ConfirmDialog {...gapConfirm.dialogProps} />
        </div>
    );
}

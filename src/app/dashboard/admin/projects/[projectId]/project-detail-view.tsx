'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBot, transferBot } from '@/app/actions/admin';
import { ArrowLeft, Loader2, X, Plus } from 'lucide-react';

interface Bot {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
    projectId: string;
}

interface Project {
    id: string;
    name: string;
    owner: {
        name: string | null;
        email: string;
    } | null;
    bots: Bot[];
}

interface ProjectDetailViewProps {
    project: Project;
    allProjects: { id: string; name: string }[];
}

export default function ProjectDetailView({ project, allProjects }: ProjectDetailViewProps) {
    const router = useRouter();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createGoal, setCreateGoal] = useState('');

    const [transferBotId, setTransferBotId] = useState<string | null>(null);
    const [targetProjectId, setTargetProjectId] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!createName || !createGoal) return;
        setIsLoading(true);
        try {
            await createBot(project.id, createName, createGoal);
            setIsCreateOpen(false);
            setCreateName('');
            setCreateGoal('');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to create bot');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferBotId || !targetProjectId) return;
        setIsLoading(true);
        try {
            await transferBot(transferBotId, targetProjectId);
            setTransferBotId(null);
            setTargetProjectId('');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to transfer bot');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold font-display">{project.name}</h1>
                    <p className="text-sm text-gray-500">
                        Owner: {project.owner?.name || project.owner?.email || 'No Owner'}
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Bots ({project.bots.length})</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Bot
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                        <tr>
                            <th className="px-6 py-3">Bot Name</th>
                            <th className="px-6 py-3">Description/Goal</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Created</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {project.bots.map(bot => (
                            <tr key={bot.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 font-medium text-gray-900">{bot.name}</td>
                                <td className="px-6 py-4 text-gray-500 truncate max-w-xs">{bot.description}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bot.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {bot.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {new Date(bot.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setTransferBotId(bot.id)}
                                        className="text-amber-600 hover:text-amber-800 font-medium text-xs px-3 py-1 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors"
                                    >
                                        Transfer
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {project.bots.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No bots in this project.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Bot Dialog */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Create New Bot</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bot Name</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="Customer Feedback Bot"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Goal / Description</label>
                                <textarea
                                    value={createGoal}
                                    onChange={(e) => setCreateGoal(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none h-24 resize-none"
                                    placeholder="Understand why customers churn..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!createName || !createGoal || isLoading}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Create Bot
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Bot Dialog */}
            {transferBotId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Transfer Bot</h2>
                            <button onClick={() => setTransferBotId(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Select the destination project for this bot.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Project</label>
                                <select
                                    value={targetProjectId}
                                    onChange={(e) => setTargetProjectId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">Select project...</option>
                                    {allProjects
                                        .filter(p => p.id !== project.id)
                                        .map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setTransferBotId(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    disabled={!targetProjectId || isLoading}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

/**
 * TransferModal
 *
 * Modal per trasferire un progetto a un cliente.
 * Permette di selezionare il progetto e inserire l'email del destinatario.
 */

import { useState } from 'react';
import { X, Send, AlertCircle, Check, Loader2 } from 'lucide-react';

interface Project {
    id: string;
    name: string;
}

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onTransferSuccess?: () => void;
}

export function TransferModal({ isOpen, onClose, projects, onTransferSuccess }: TransferModalProps) {
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [clientEmail, setClientEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ inviteUrl: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedProject) {
            setError('Seleziona un progetto');
            return;
        }

        if (!clientEmail || !clientEmail.includes('@')) {
            setError('Inserisci un\'email valida');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/partner/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProject,
                    toEmail: clientEmail
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Errore nel trasferimento');
            }

            setSuccess({ inviteUrl: data.inviteUrl });
            onTransferSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore imprevisto');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedProject('');
        setClientEmail('');
        setError(null);
        setSuccess(null);
        onClose();
    };

    const copyInviteLink = async () => {
        if (success?.inviteUrl) {
            await navigator.clipboard.writeText(success.inviteUrl);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-stone-900">Trasferisci Progetto</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {success ? (
                    // Success state
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-stone-900 mb-2">Invito creato!</h3>
                        <p className="text-stone-600 mb-6">
                            Abbiamo inviato un invito a <strong>{clientEmail}</strong>.
                            L&apos;invito scade tra 7 giorni.
                        </p>
                        <div className="bg-stone-50 rounded-lg p-4 mb-4">
                            <p className="text-xs text-stone-500 mb-2">Link di invito:</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={success.inviteUrl}
                                    readOnly
                                    className="flex-1 text-xs bg-white border border-stone-200 rounded px-3 py-2 truncate"
                                />
                                <button
                                    onClick={copyInviteLink}
                                    className="px-3 py-2 bg-stone-900 text-white text-xs rounded hover:bg-stone-800 transition-colors"
                                >
                                    Copia
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-full py-3 bg-stone-900 text-white font-medium rounded-xl hover:bg-stone-800 transition-colors"
                        >
                            Chiudi
                        </button>
                    </div>
                ) : (
                    // Form state
                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Project selection */}
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Seleziona Progetto
                                </label>
                                <select
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    disabled={loading}
                                >
                                    <option value="">-- Seleziona un progetto --</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Client email */}
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Email del Cliente
                                </label>
                                <input
                                    type="email"
                                    value={clientEmail}
                                    onChange={(e) => setClientEmail(e.target.value)}
                                    placeholder="cliente@esempio.com"
                                    className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    disabled={loading}
                                />
                                <p className="text-xs text-stone-500 mt-2">
                                    Il cliente riceverà un invito per accettare il progetto.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 py-3 bg-stone-100 text-stone-700 font-medium rounded-xl hover:bg-stone-200 transition-colors"
                                disabled={loading}
                            >
                                Annulla
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Invia Invito
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default TransferModal;

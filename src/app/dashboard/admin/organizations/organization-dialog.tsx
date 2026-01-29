'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { showToast } from '@/components/toast';

interface OrganizationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    organization?: any; // If present, we are editing
}

export default function OrganizationDialog({ isOpen, onClose, organization }: OrganizationDialogProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [newOwnerEmail, setNewOwnerEmail] = useState('');
    const [plan, setPlan] = useState('FREE');

    useEffect(() => {
        if (isOpen) {
            setName(organization?.name || '');
            setSlug(organization?.slug || '');
            setOwnerEmail(organization?.owner?.email || '');
            setNewOwnerEmail('');
            setPlan(organization?.plan || 'FREE');
        }
    }, [isOpen, organization]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const url = organization
                ? `/api/admin/organizations/${organization.id}`
                : '/api/admin/organizations';

            const method = organization ? 'PATCH' : 'POST';

            const body = organization
                ? { name, slug, plan, newOwnerEmail: newOwnerEmail || undefined }
                : { name, slug, plan, ownerEmail };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Something went wrong');
            }

            showToast(organization ? 'Organizzazione aggiornata' : 'Organizzazione creata');
            router.refresh();
            onClose();
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{organization ? 'Modifica Organizzazione' : 'Crea Organizzazione'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4 py-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 text-sm"
                            placeholder="Nome organizzazione"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Slug</label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 text-sm"
                            placeholder="my-org-slug"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Caratteri minuscoli, numeri e trattini soltanto.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Piano Abbonamento</label>
                        <select
                            value={plan}
                            onChange={(e) => setPlan(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all text-sm"
                        >
                            <option value="FREE">Free</option>
                            <option value="TRIAL">Trial</option>
                            <option value="STARTER">Starter</option>
                            <option value="PRO">Pro</option>
                            <option value="BUSINESS">Business</option>
                            <option value="PARTNER">Partner</option>
                        </select>
                    </div>

                    {organization ? (
                        <div className="pt-4 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Trasferisci Proprietà (Opzionale)</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Attuale proprietario: <span className="font-semibold text-gray-900">{organization.owner?.email || 'Sconosciuto'}</span>
                            </p>
                            <input
                                type="email"
                                value={newOwnerEmail}
                                onChange={(e) => setNewOwnerEmail(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 text-sm"
                                placeholder="Email del nuovo proprietario"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Proprietario</label>
                            <input
                                type="email"
                                value={ownerEmail}
                                onChange={(e) => setOwnerEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 text-sm"
                                placeholder="Proprietario organizzazione"
                            />
                        </div>
                    )}

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Salvataggio...' : organization ? 'Trasferisci' : 'Crea'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

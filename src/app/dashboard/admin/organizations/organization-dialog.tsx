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

    useEffect(() => {
        if (isOpen) {
            setName(organization?.name || '');
            setSlug(organization?.slug || '');
            setOwnerEmail(organization?.owner?.email || '');
            setNewOwnerEmail('');
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
                ? { newOwnerEmail }
                : { name, slug, ownerEmail };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Something went wrong');
            }

            showToast(organization ? 'Proprietario aggiornato' : 'Organizzazione creata');
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{organization ? 'Trasferisci Proprietà' : 'Crea Organizzazione'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4">
                    {!organization ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nome</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Slug</label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                                    placeholder="my-org-slug"
                                />
                                <p className="text-xs text-gray-400 mt-1">Caratteri minuscoli, numeri e trattini soltanto.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Proprietario</label>
                                <input
                                    type="email"
                                    value={ownerEmail}
                                    onChange={(e) => setOwnerEmail(e.target.value)}
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <p className="text-sm text-gray-600 mb-4">
                                Attualmente di proprietà di: <strong>{organization.owner?.email || 'Sconosciuto'}</strong>
                            </p>
                            <label className="block text-sm font-medium text-gray-700">Nuova Email Proprietario</label>
                            <input
                                type="email"
                                value={newOwnerEmail}
                                onChange={(e) => setNewOwnerEmail(e.target.value)}
                                required
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
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

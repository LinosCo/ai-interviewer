'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, updateUser, updateUserSubscription } from '@/app/actions/admin';
import { UserRole } from '@prisma/client';
import { X } from 'lucide-react';
import { showToast } from '@/components/toast';

interface Project {
    id: string;
    name: string;
}

interface User {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    projectAccess: { projectId: string }[];
    memberships?: {
        organization: {
            subscription: {
                tier: string;
            } | null;
        };
    }[];
}

interface UserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User; // If provided, edit mode
    projects: Project[];
}

export default function UserDialog({ isOpen, onClose, user, projects }: UserDialogProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('USER');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [tier, setTier] = useState<string>('FREE');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (user && isOpen) {
            setName(user.name || '');
            setEmail(user.email || '');
            setRole(user.role);
            setSelectedProjectIds(user.projectAccess.map(p => p.projectId));
            setTier(user.memberships?.[0]?.organization?.subscription?.tier || 'FREE');
        } else if (!user && isOpen) {
            setName('');
            setEmail('');
            setPassword('');
            setRole('USER');
            setSelectedProjectIds([]);
            setTier('FREE');
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            let res;
            if (user) {
                res = await updateUser(user.id, {
                    name,
                    email,
                    password: password || undefined,
                    role,
                    projectIds: selectedProjectIds
                });
            } else {
                res = await createUser({
                    name,
                    email,
                    password,
                    role,
                    projectIds: selectedProjectIds
                });
            }

            // Update Subscription if edited or for new user (if not FREE)
            const currentTier = user?.memberships?.[0]?.organization?.subscription?.tier || 'FREE';
            if (tier !== currentTier) {
                const targetUserId = user ? user.id : (res as any).id;
                await updateUserSubscription(targetUserId, tier);
            }

            showToast(`Utente ${user ? 'aggiornato' : 'creato'} con successo!`);
            router.refresh();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('Errore durante il salvataggio. Controlla la console.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleProject = (projectId: string) => {
        if (selectedProjectIds.includes(projectId)) {
            setSelectedProjectIds(selectedProjectIds.filter(id => id !== projectId));
        } else {
            setSelectedProjectIds([...selectedProjectIds, projectId]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                    aria-label="Chiudi dialog"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-6">
                    {user ? 'Modifica Utente' : 'Crea Nuovo Utente'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {user ? 'Nuova Password (lascia vuoto per mantenere attuale)' : 'Password'}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            {...(!user && { required: true })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="w-full border rounded-lg px-3 py-2"
                        >
                            <option value="USER">Utente (Accesso Limitato)</option>
                            <option value="ADMIN">Admin (Accesso Completo)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Piano Abbonamento</label>
                        <select
                            value={tier}
                            onChange={(e) => setTier(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 bg-amber-50 border-amber-200"
                        >
                            <option value="FREE">Free</option>
                            <option value="STARTER">Starter</option>
                            <option value="PRO">Pro</option>
                            <option value="BUSINESS">Business (Enterprise)</option>
                            <option value="PARTNER">Partner (Agenzie)</option>
                            <option value="ADMIN">Admin (Staff)</option>
                        </select>
                        <p className="text-xs text-amber-600 mt-1 italic">
                            Attivazione manuale per clienti Enterprise, Partner e Staff.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Accesso Progetti</label>
                        <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                            {projects.map(project => (
                                <label key={project.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedProjectIds.includes(project.id)}
                                        onChange={() => toggleProject(project.id)}
                                        className="rounded text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">{project.name}</span>
                                </label>
                            ))}
                            {projects.length === 0 && (
                                <p className="text-sm text-gray-500 italic">Nessun progetto disponibile</p>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Gli Admin hanno accesso completo indipendentemente dalla selezione.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                            {isLoading ? 'Salvataggio...' : 'Salva Utente'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}

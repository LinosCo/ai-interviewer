'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, updateUser } from '@/app/actions/admin';
import { UserRole } from '@prisma/client';
import { X } from 'lucide-react';

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
}

interface UserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User; // If provided, edit mode
    projects: Project[];
}

export default function UserDialog({ isOpen, onClose, user, projects }: UserDialogProps) {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(user?.role || 'USER');
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
        user?.projectAccess.map(p => p.projectId) || []
    );
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (user) {
                await updateUser(user.id, {
                    name,
                    email,
                    password: password || undefined,
                    role,
                    projectIds: selectedProjectIds
                });
            } else {
                await createUser({
                    name,
                    email,
                    password,
                    role,
                    projectIds: selectedProjectIds
                });
            }
            alert(`User ${user ? 'updated' : 'created'} successfully!`);
            router.refresh();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save user. Check console for details.');
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
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-6">
                    {user ? 'Edit User' : 'Create New User'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
                            {user ? 'New Password (leave blank to keep current)' : 'Password'}
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="w-full border rounded-lg px-3 py-2"
                        >
                            <option value="USER">User (Limited Access)</option>
                            <option value="ADMIN">Admin (Full Access)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Project Access</label>
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
                                <p className="text-sm text-gray-500 italic">No projects available</p>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Admins have full access regardless of selection.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                            {isLoading ? 'Saving...' : 'Save User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

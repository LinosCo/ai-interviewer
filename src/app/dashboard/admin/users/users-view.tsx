'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import UserDialog from './user-dialog';
import { deleteUser } from '@/app/actions/admin';

interface Project {
    id: string;
    name: string;
}

interface User {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    projectAccess: { projectId: string; project: Project }[];
    memberships: {
        organization: {
            subscription: {
                tier: string;
            } | null;
        };
    }[];
    createdAt: Date;
}

interface UsersViewProps {
    users: User[];
    projects: Project[];
}

export default function UsersView({ users, projects }: UsersViewProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

    const handleCreate = () => {
        setEditingUser(undefined);
        setIsDialogOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsDialogOpen(true);
    };

    const router = useRouter();

    const handleDelete = async (userId: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                await deleteUser(userId);
                alert('User deleted successfully');
                router.refresh();
            } catch (error) {
                alert('Failed to delete user');
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">User Management</h1>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
                >
                    <Plus size={20} />
                    Add User
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{user.name || 'Unnamed'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-500">
                                        {user.role === 'ADMIN' ? (
                                            <span className="text-gray-400 italic">Full Access</span>
                                        ) : user.projectAccess.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {user.projectAccess.map(pa => (
                                                    <span key={pa.projectId} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                        {pa.project.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-red-400">No Projects</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-amber-600 hover:text-amber-900 mr-4"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            <UserDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                user={editingUser}
                projects={projects}
            />
        </div>
    );
}

import { useState } from 'react';
import { transferProject, createProject } from '@/app/actions/admin';
import { Icons } from '@/components/ui/business-tuner/Icons';

interface User {
    id: string;
    name: string | null;
    email: string;
}

interface Project {
    id: string;
    name: string;
    ownerId: string | null;
    owner: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    _count: {
        bots: number;
    };
}

interface ProjectsViewProps {
    projects: Project[];
    users: User[];
}

export default function ProjectsView({ projects, users }: ProjectsViewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [newOwnerId, setNewOwnerId] = useState('');

    // Create State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createOwnerId, setCreateOwnerId] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.owner?.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleTransfer = async () => {
        if (!selectedProject || !newOwnerId) return;
        setIsLoading(true);
        try {
            await transferProject(selectedProject.id, newOwnerId);
            alert('Project transferred successfully');
            setSelectedProject(null);
            setNewOwnerId('');
        } catch (error) {
            console.error(error);
            alert('Failed to transfer project');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!createName || !createOwnerId) return;
        setIsLoading(true);
        try {
            await createProject(createName, createOwnerId);
            alert('Project created successfully');
            setIsCreateOpen(false);
            setCreateName('');
            setCreateOwnerId('');
        } catch (error) {
            console.error(error);
            alert('Failed to create project');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display">Project Management</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-lg w-64 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2"
                    >
                        <Icons.Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                        <tr>
                            <th className="px-6 py-3">Project Name</th>
                            <th className="px-6 py-3">Bots</th>
                            <th className="px-6 py-3">Current Owner</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredProjects.map(project => (
                            <tr key={project.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 font-medium text-gray-900">{project.name}</td>
                                <td className="px-6 py-4 text-gray-500">{project._count.bots}</td>
                                <td className="px-6 py-4 text-gray-600">
                                    {project.owner ? (
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 font-medium">{project.owner.name || 'Unnamed'}</span>
                                            <span className="text-xs text-gray-500">{project.owner.email}</span>
                                        </div>
                                    ) : (
                                        <span className="text-red-500 italic">No Owner</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        className="text-amber-600 hover:text-amber-800 font-medium text-xs px-3 py-1 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors"
                                    >
                                        Transfer Ownership
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredProjects.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No projects found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Dialog */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Create New Project</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="My Project"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                                <select
                                    value={createOwnerId}
                                    onChange={(e) => setCreateOwnerId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">Select an owner...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || user.email} ({user.email})
                                        </option>
                                    ))}
                                </select>
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
                                    disabled={!createName || !createOwnerId || isLoading}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                                    Create Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Dialog */}
            {selectedProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Transfer Project</h2>
                            <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-gray-600">
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-2">
                                You are transferring ownership of <strong>{selectedProject.name}</strong>.
                            </p>
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm">
                                <Icons.AlertCircle className="inline-block w-4 h-4 mr-2 -mt-0.5" />
                                The new owner will gain full control over this project and all its chatbots.
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select New Owner</label>
                                <select
                                    value={newOwnerId}
                                    onChange={(e) => setNewOwnerId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">Select a user...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || user.email} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    disabled={!newOwnerId || isLoading}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                                    Confirm Transfer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

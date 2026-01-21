'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { Filter } from 'lucide-react';

interface VisibilityProjectFilterProps {
    currentProjectId?: string;
}

export function VisibilityProjectFilter({ currentProjectId }: VisibilityProjectFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { projects, isOrgAdmin } = useProject();

    const handleProjectChange = (projectId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (projectId === 'all') {
            params.delete('projectId');
        } else {
            params.set('projectId', projectId);
        }
        // Remove scanId when changing project
        params.delete('scanId');
        router.push(`/dashboard/visibility?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
                value={currentProjectId || 'all'}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            >
                {isOrgAdmin && (
                    <option value="all">Tutti i brand</option>
                )}
                {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                        {project.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

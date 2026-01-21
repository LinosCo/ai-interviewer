'use client';

import { useState, useRef, useEffect } from 'react';
import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export function ProjectSelector() {
    const { projects, selectedProject, setSelectedProject, loading, isOrgAdmin, isAllProjectsSelected } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) {
        return (
            <div className="px-4 py-3 rounded-xl bg-gray-50 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-32"></div>
            </div>
        );
    }

    if (!selectedProject) {
        return null;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors border border-stone-200"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {isAllProjectsSelected ? (
                        <LayoutGrid size={18} className="text-amber-500 flex-shrink-0" />
                    ) : (
                        <Icons.FolderKanban size={18} className="text-amber-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-700 truncate">
                        {selectedProject.name}
                    </span>
                    {isAllProjectsSelected && (
                        <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Admin
                        </span>
                    )}
                    {selectedProject.isPersonal && !isAllProjectsSelected && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Personale
                        </span>
                    )}
                </div>
                <Icons.ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="max-h-64 overflow-y-auto">
                        {/* "All Projects" option for admins */}
                        {isOrgAdmin && (
                            <>
                                <button
                                    onClick={() => {
                                        setSelectedProject(ALL_PROJECTS_OPTION);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-stone-50 transition-colors ${
                                        isAllProjectsSelected ? 'bg-amber-50' : ''
                                    }`}
                                >
                                    <LayoutGrid
                                        size={16}
                                        className={isAllProjectsSelected ? 'text-amber-500' : 'text-gray-400'}
                                    />
                                    <span className={`flex-1 truncate ${
                                        isAllProjectsSelected ? 'text-amber-700 font-medium' : 'text-gray-600'
                                    }`}>
                                        Tutti i progetti
                                    </span>
                                    <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                                        Admin
                                    </span>
                                    {isAllProjectsSelected && (
                                        <Icons.Check size={16} className="text-amber-500" />
                                    )}
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                            </>
                        )}
                        {projects.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-stone-50 transition-colors ${
                                    selectedProject?.id === project.id ? 'bg-amber-50' : ''
                                }`}
                            >
                                <Icons.FolderKanban
                                    size={16}
                                    className={selectedProject?.id === project.id ? 'text-amber-500' : 'text-gray-400'}
                                />
                                <span className={`flex-1 truncate ${
                                    selectedProject?.id === project.id ? 'text-amber-700 font-medium' : 'text-gray-600'
                                }`}>
                                    {project.name}
                                </span>
                                {project.isPersonal && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                        Personale
                                    </span>
                                )}
                                {project.role === 'OWNER' && !project.isPersonal && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                        Owner
                                    </span>
                                )}
                                {selectedProject?.id === project.id && (
                                    <Icons.Check size={16} className="text-amber-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Manage Projects Link - only for owners */}
                    {projects.some(p => p.role === 'OWNER' && !p.isPersonal) && (
                        <>
                            <div className="border-t border-gray-100" />
                            <Link
                                href={`/dashboard/projects/${selectedProject.id}/settings`}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 px-4 py-3 text-gray-500 hover:text-amber-600 hover:bg-stone-50 transition-colors"
                            >
                                <Icons.Settings size={16} />
                                <span className="text-sm">Gestisci progetto</span>
                            </Link>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

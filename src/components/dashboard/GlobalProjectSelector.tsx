'use client';

import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { Folder, ChevronDown, LayoutGrid } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalProjectSelector() {
    const { projects, selectedProject, setSelectedProject, loading, isOrgAdmin } = useProject();
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
            <div className="w-full h-10 bg-gray-50 animate-pulse rounded-xl border border-gray-100" />
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-gray-100 shadow-sm rounded-xl hover:border-amber-200 transition-all group"
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                        {selectedProject?.id === ALL_PROJECTS_OPTION.id ? (
                            <LayoutGrid className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                            <Folder className="w-3.5 h-3.5 text-amber-600" />
                        )}
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Progetto</span>
                        <span className="text-xs font-bold text-gray-900 truncate w-full">
                            {selectedProject?.name || 'Seleziona'}
                        </span>
                    </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-white border border-gray-100 shadow-xl rounded-xl z-50 max-h-56 overflow-y-auto"
                    >
                        {isOrgAdmin && (
                            <button
                                onClick={() => {
                                    setSelectedProject(ALL_PROJECTS_OPTION);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-black transition-all mb-1 ${selectedProject?.id === ALL_PROJECTS_OPTION.id
                                    ? 'bg-amber-600 text-white'
                                    : 'text-amber-600 hover:bg-amber-50'
                                    }`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span className="truncate uppercase tracking-tight">{ALL_PROJECTS_OPTION.name}</span>
                            </button>
                        )}

                        {isOrgAdmin && <div className="h-px bg-gray-100 my-1 mx-2" />}

                        {projects.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${selectedProject?.id === project.id
                                    ? 'bg-amber-50 text-amber-900'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Folder className={`w-3.5 h-3.5 ${selectedProject?.id === project.id ? 'text-amber-600' : 'text-gray-400'}`} />
                                <span className="truncate">{project.name}</span>
                                {project.isPersonal && (
                                    <span className="ml-auto text-[9px] font-black bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full uppercase">Io</span>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

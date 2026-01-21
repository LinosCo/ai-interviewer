'use client';

import { useProject } from '@/contexts/ProjectContext';
import { Folder, ChevronDown } from 'lucide-react';
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
            <div className="w-full h-12 bg-gray-50 animate-pulse rounded-xl border border-gray-100" />
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-2xl hover:border-amber-200 transition-all group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                        <Folder className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Progetto Attivo</span>
                        <span className="text-sm font-bold text-gray-900 truncate w-full">
                            {selectedProject?.name || 'Seleziona Progetto'}
                        </span>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-2 p-2 bg-white border border-gray-100 shadow-xl rounded-[24px] z-50 max-h-64 overflow-y-auto"
                    >
                        {projects.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => {
                                    setSelectedProject(project);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedProject?.id === project.id
                                        ? 'bg-amber-50 text-amber-900'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Folder className={`w-4 h-4 ${selectedProject?.id === project.id ? 'text-amber-600' : 'text-gray-400'}`} />
                                <span className="truncate">{project.name}</span>
                                {project.isPersonal && (
                                    <span className="ml-auto text-[10px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase">Io</span>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

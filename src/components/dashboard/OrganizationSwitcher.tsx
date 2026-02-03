'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OrganizationSwitcher() {
    const { organizations, currentOrganization, setCurrentOrganization, loading } = useOrganization();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Show skeleton while loading or if no data yet
    if (loading || (!currentOrganization && organizations.length === 0)) {
        return (
            <div className="w-full h-12 bg-gray-50 animate-pulse rounded-xl border border-gray-100" />
        );
    }

    return (
        <div className="relative mb-6" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-100 shadow-sm rounded-2xl hover:border-amber-200 transition-all group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shrink-0">
                        <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Team / Org</span>
                        <span className="text-sm font-bold text-gray-900 truncate w-full">
                            {currentOrganization?.name || 'Seleziona Team'}
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
                        className="absolute top-full left-0 right-0 mt-2 p-2 bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 max-h-64 overflow-y-auto"
                    >
                        <div className="px-2 py-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">I tuoi spazi di lavoro</span>
                        </div>

                        {organizations.map((org) => (
                            <button
                                key={org.id}
                                onClick={() => {
                                    setCurrentOrganization(org);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${currentOrganization?.id === org.id
                                    ? 'bg-amber-50 text-amber-900'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`p-1.5 rounded-lg ${currentOrganization?.id === org.id ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                    <Building2 className={`w-4 h-4 ${currentOrganization?.id === org.id ? 'text-amber-600' : 'text-gray-500'}`} />
                                </div>
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="truncate">{org.name}</span>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{org.plan}</span>
                                </div>
                                {currentOrganization?.id === org.id && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                                )}
                            </button>
                        ))}

                        <div className="h-px bg-gray-100 my-2 mx-1" />

                        <button
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-amber-600 hover:bg-amber-50 transition-all"
                            onClick={() => {/* Logic to create new org */ }}
                        >
                            <div className="p-1.5 rounded-lg bg-amber-100">
                                <Plus className="w-4 h-4" />
                            </div>
                            <span>Crea nuovo Team</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

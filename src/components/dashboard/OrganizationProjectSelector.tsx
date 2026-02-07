'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { Building2, ChevronDown, Folder, LayoutGrid, Search, Plus, Check } from 'lucide-react';
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Link from 'next/link';

interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface Project {
    id: string;
    name: string;
    isPersonal: boolean;
    role: 'OWNER' | 'MEMBER';
}

type DropdownMode = 'org' | 'project' | null;

export default function OrganizationProjectSelector() {
    const { organizations, currentOrganization, setCurrentOrganization, loading: orgLoading, refetchOrganizations } = useOrganization();
    const { projects, selectedProject, setSelectedProject, loading: projectLoading, isOrgAdmin } = useProject();

    const [dropdownMode, setDropdownMode] = useState<DropdownMode>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const hasAutoRetriedRef = useRef(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setDropdownMode(null);
                setSearchQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (dropdownMode && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [dropdownMode]);

    useEffect(() => {
        if (!orgLoading && organizations.length === 0 && !hasAutoRetriedRef.current) {
            hasAutoRetriedRef.current = true;
            void refetchOrganizations();
        }
        if (organizations.length > 0) {
            hasAutoRetriedRef.current = false;
        }
    }, [orgLoading, organizations.length, refetchOrganizations]);

    const filteredOrganizations = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredProjects = (() => {
        const baseProjects = isOrgAdmin ? [ALL_PROJECTS_OPTION, ...projects] : projects;
        return baseProjects.filter(project =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    })();

    const handleOrgSelect = useCallback((org: Organization) => {
        setCurrentOrganization(org);
        setDropdownMode(null);
        setSearchQuery('');
    }, [setCurrentOrganization]);

    const handleProjectSelect = useCallback((project: Project) => {
        setSelectedProject(project);
        setDropdownMode(null);
        setSearchQuery('');
    }, [setSelectedProject]);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setHighlightedIndex(0);
    };

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        const items = dropdownMode === 'org' ? filteredOrganizations : filteredProjects;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (items[highlightedIndex]) {
                    if (dropdownMode === 'org') {
                        handleOrgSelect(items[highlightedIndex] as Organization);
                    } else {
                        handleProjectSelect(items[highlightedIndex] as Project);
                    }
                }
                break;
            case 'Escape':
                setDropdownMode(null);
                setSearchQuery('');
                break;
        }
    }, [dropdownMode, filteredOrganizations, filteredProjects, highlightedIndex, handleOrgSelect, handleProjectSelect]);

    // Loading state
    if (orgLoading) {
        return (
            <div className="space-y-2 mb-6">
                <div className="w-full h-11 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
                <div className="w-full h-11 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
            </div>
        );
    }

    if (organizations.length === 0) {
        return (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500 mb-2">Nessuna organizzazione disponibile</p>
                <button
                    onClick={() => refetchOrganizations()}
                    className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                    Riprova caricamento
                </button>
            </div>
        );
    }

    if (!currentOrganization) {
        return (
            <div className="space-y-2 mb-6">
                <div className="w-full h-11 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
                <div className="w-full h-11 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
            </div>
        );
    }

    return (
        <div className="relative mb-6 space-y-2" ref={containerRef}>
            {/* Organization Selector - Full Width */}
            <div className="relative">
                <button
                    onClick={() => {
                        setDropdownMode(dropdownMode === 'org' ? null : 'org');
                        setSearchQuery('');
                        setHighlightedIndex(0);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-all ${
                        dropdownMode === 'org'
                            ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-expanded={dropdownMode === 'org'}
                    aria-haspopup="listbox"
                    aria-label="Seleziona organizzazione"
                >
                    <div className={`p-1.5 rounded-md shrink-0 ${dropdownMode === 'org' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        <Building2 className={`w-4 h-4 ${dropdownMode === 'org' ? 'text-amber-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Team
                        </span>
                        <span className="text-sm font-semibold text-gray-900 truncate block">
                            {currentOrganization?.name || 'Seleziona'}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownMode === 'org' ? 'rotate-180' : ''}`} />
                </button>

                {/* Organization Dropdown */}
                {dropdownMode === 'org' && (
                    <div
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
                        role="listbox"
                        aria-label="Organizzazioni"
                    >
                        {/* Search Input */}
                        {organizations.length > 3 && (
                            <div className="p-2 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Cerca team..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-64 overflow-y-auto p-1">
                            {filteredOrganizations.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                    Nessun team trovato
                                </div>
                            ) : (
                                filteredOrganizations.map((org, index) => {
                                    const isSelected = currentOrganization?.id === org.id;
                                    const isHighlighted = index === highlightedIndex;

                                    return (
                                        <button
                                            key={org.id}
                                            onClick={() => handleOrgSelect(org)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                                                isHighlighted ? 'bg-gray-100' : ''
                                            } ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                                            role="option"
                                            aria-selected={isSelected}
                                        >
                                            <div className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                                <Building2 className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-gray-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-sm font-medium block truncate ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                                                    {org.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold">
                                                    {org.plan}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}

                            {/* Create New Organization */}
                            <div className="border-t border-gray-100 mt-1 pt-1">
                                <Link
                                    href="/dashboard/settings/organizations/new"
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-amber-600 hover:bg-amber-50 transition-colors"
                                    onClick={() => setDropdownMode(null)}
                                >
                                    <div className="p-1.5 rounded-md bg-amber-100 shrink-0">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium">Crea nuovo Team</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Project Selector - Full Width */}
            <div className="relative">
                <button
                    onClick={() => {
                        setDropdownMode(dropdownMode === 'project' ? null : 'project');
                        setSearchQuery('');
                        setHighlightedIndex(0);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-all ${
                        dropdownMode === 'project'
                            ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-expanded={dropdownMode === 'project'}
                    aria-haspopup="listbox"
                    aria-label="Seleziona progetto"
                >
                    <div className={`p-1.5 rounded-md shrink-0 ${dropdownMode === 'project' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        {selectedProject?.id === ALL_PROJECTS_OPTION.id ? (
                            <LayoutGrid className={`w-4 h-4 ${dropdownMode === 'project' ? 'text-amber-600' : 'text-gray-500'}`} />
                        ) : (
                            <Folder className={`w-4 h-4 ${dropdownMode === 'project' ? 'text-amber-600' : 'text-gray-500'}`} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                            Progetto
                        </span>
                        <span className="text-sm font-semibold text-gray-900 truncate block">
                            {projectLoading ? 'Caricamento...' : (selectedProject?.name || 'Tutti i progetti')}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropdownMode === 'project' ? 'rotate-180' : ''}`} />
                </button>

                {/* Project Dropdown */}
                {dropdownMode === 'project' && (
                    <div
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
                        role="listbox"
                        aria-label="Progetti"
                    >
                        {/* Search Input */}
                        {projects.length > 3 && (
                            <div className="p-2 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Cerca progetto..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-64 overflow-y-auto p-1">
                            {projectLoading ? (
                                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                    Caricamento progetti...
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                    Nessun progetto trovato
                                </div>
                            ) : (
                                filteredProjects.map((project, index) => {
                                    const isSelected = selectedProject?.id === project.id;
                                    const isHighlighted = index === highlightedIndex;
                                    const isAllProjects = project.id === ALL_PROJECTS_OPTION.id;

                                    return (
                                        <button
                                            key={project.id}
                                            onClick={() => handleProjectSelect(project)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                                                isHighlighted ? 'bg-gray-100' : ''
                                            } ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                                            role="option"
                                            aria-selected={isSelected}
                                        >
                                            <div className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                                {isAllProjects ? (
                                                    <LayoutGrid className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-gray-500'}`} />
                                                ) : (
                                                    <Folder className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-gray-500'}`} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-sm font-medium block truncate ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                                                    {project.name}
                                                </span>
                                            </div>
                                            {project.isPersonal && (
                                                <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase shrink-0">
                                                    Personale
                                                </span>
                                            )}
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

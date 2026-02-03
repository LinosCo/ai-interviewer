'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { Building2, ChevronDown, ChevronRight, Folder, LayoutGrid, Search, Plus, Check } from 'lucide-react';
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
    const { organizations, currentOrganization, setCurrentOrganization, loading: orgLoading } = useOrganization();
    const { projects, selectedProject, setSelectedProject, loading: projectLoading, isOrgAdmin } = useProject();

    const [dropdownMode, setDropdownMode] = useState<DropdownMode>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

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
            case 'Tab':
                // Allow tab to switch between org and project
                if (dropdownMode === 'org' && !e.shiftKey) {
                    e.preventDefault();
                    setDropdownMode('project');
                    setSearchQuery('');
                } else if (dropdownMode === 'project' && e.shiftKey) {
                    e.preventDefault();
                    setDropdownMode('org');
                    setSearchQuery('');
                }
                break;
        }
    }, [dropdownMode, filteredOrganizations, filteredProjects, highlightedIndex, handleOrgSelect, handleProjectSelect]);

    // Loading state
    if (orgLoading || (!currentOrganization && organizations.length === 0)) {
        return (
            <div className="w-full h-10 bg-gray-50 animate-pulse rounded-lg border border-gray-200 mb-6" />
        );
    }

    const isOpen = dropdownMode !== null;

    return (
        <div className="relative mb-6" ref={containerRef}>
            {/* Breadcrumb Selector Button */}
            <div className="w-full flex items-center border border-gray-200 rounded-lg hover:border-gray-300 transition-all bg-white">
                {/* Organization Section */}
                <button
                    onClick={() => {
                        setDropdownMode(dropdownMode === 'org' ? null : 'org');
                        setSearchQuery('');
                        setHighlightedIndex(0);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 flex-1 min-w-0 rounded-l-lg transition-colors ${
                        dropdownMode === 'org' ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                    aria-expanded={dropdownMode === 'org'}
                    aria-haspopup="listbox"
                    aria-label="Seleziona organizzazione"
                >
                    <Building2 className={`w-4 h-4 shrink-0 ${dropdownMode === 'org' ? 'text-amber-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-900 truncate">
                        {currentOrganization?.name || 'Seleziona'}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${dropdownMode === 'org' ? 'rotate-180' : ''}`} />
                </button>

                {/* Divider */}
                <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />

                {/* Project Section */}
                <button
                    onClick={() => {
                        setDropdownMode(dropdownMode === 'project' ? null : 'project');
                        setSearchQuery('');
                        setHighlightedIndex(0);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 flex-1 min-w-0 rounded-r-lg transition-colors ${
                        dropdownMode === 'project' ? 'bg-amber-50' : 'hover:bg-gray-50'
                    }`}
                    aria-expanded={dropdownMode === 'project'}
                    aria-haspopup="listbox"
                    aria-label="Seleziona progetto"
                >
                    {selectedProject?.id === ALL_PROJECTS_OPTION.id ? (
                        <LayoutGrid className={`w-4 h-4 shrink-0 ${dropdownMode === 'project' ? 'text-amber-600' : 'text-gray-400'}`} />
                    ) : (
                        <Folder className={`w-4 h-4 shrink-0 ${dropdownMode === 'project' ? 'text-amber-600' : 'text-gray-400'}`} />
                    )}
                    <span className="text-sm text-gray-600 truncate">
                        {projectLoading ? 'Caricamento...' : (selectedProject?.name || 'Tutti')}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${dropdownMode === 'project' ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
                    role="listbox"
                    aria-label={dropdownMode === 'org' ? 'Organizzazioni' : 'Progetti'}
                >
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={dropdownMode === 'org' ? 'Cerca organizzazione...' : 'Cerca progetto...'}
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                            />
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="max-h-64 overflow-y-auto p-1">
                        {dropdownMode === 'org' ? (
                            // Organization List
                            <>
                                {filteredOrganizations.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                        Nessuna organizzazione trovata
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
                                                    <span className="text-xs text-gray-400 uppercase">
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
                            </>
                        ) : (
                            // Project List
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

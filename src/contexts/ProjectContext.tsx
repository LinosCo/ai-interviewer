'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useOrganization } from './OrganizationContext';

interface Project {
    id: string;
    name: string;
    isPersonal: boolean;
    role: 'OWNER' | 'MEMBER';
}

// Special "All Projects" option for admins
export const ALL_PROJECTS_OPTION: Project = {
    id: '__ALL__',
    name: 'Tutti i progetti',
    isPersonal: false,
    role: 'OWNER'
};

interface ProjectContextType {
    projects: Project[];
    selectedProject: Project | null;
    setSelectedProject: (project: Project | null) => void;
    loading: boolean;
    refetchProjects: () => Promise<void>;
    isOrgAdmin: boolean;
    isAllProjectsSelected: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const SELECTED_PROJECT_KEY_PREFIX = 'bt_selected_project_id_';

export function ProjectProvider({ children }: { children: ReactNode }) {
    const { currentOrganization, loading: orgLoading } = useOrganization();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);

    const fetchProjects = useCallback(async () => {
        // Don't fetch if organization context is still loading
        if (orgLoading) {
            return;
        }

        if (!currentOrganization) {
            setLoading(false);
            setProjects([]);
            setSelectedProjectState(null);
            return;
        }

        setLoading(true);
        // Reset state before fetching new data to avoid showing stale data
        setProjects([]);
        setSelectedProjectState(null);

        try {
            const res = await fetch(`/api/projects?organizationId=${currentOrganization.id}`);
            if (res.ok) {
                const data = await res.json();
                const projectsList = data.projects || [];
                const adminStatus = data.isOrgAdmin || false;

                setProjects(projectsList);
                setIsOrgAdmin(adminStatus);

                // Restore selected project from localStorage (organization-specific)
                const storageKey = `${SELECTED_PROJECT_KEY_PREFIX}${currentOrganization.id}`;
                const savedProjectId = localStorage.getItem(storageKey);

                if (savedProjectId === ALL_PROJECTS_OPTION.id && adminStatus) {
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                } else if (savedProjectId) {
                    const savedProject = projectsList.find((p: Project) => p.id === savedProjectId);
                    if (savedProject) {
                        setSelectedProjectState(savedProject);
                    } else if (adminStatus) {
                        setSelectedProjectState(ALL_PROJECTS_OPTION);
                        localStorage.setItem(storageKey, ALL_PROJECTS_OPTION.id);
                    } else if (projectsList.length > 0) {
                        setSelectedProjectState(projectsList[0]);
                        localStorage.setItem(storageKey, projectsList[0].id);
                    } else {
                        setSelectedProjectState(null);
                    }
                } else if (adminStatus) {
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                    localStorage.setItem(storageKey, ALL_PROJECTS_OPTION.id);
                } else if (projectsList.length > 0) {
                    setSelectedProjectState(projectsList[0]);
                    localStorage.setItem(storageKey, projectsList[0].id);
                } else {
                    setSelectedProjectState(null);
                }
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    }, [currentOrganization, orgLoading]);

    useEffect(() => {
        // Re-fetch when organization changes or when organization loading completes
        fetchProjects();
    }, [currentOrganization?.id, orgLoading, fetchProjects]);

    const setSelectedProject = (project: Project | null) => {
        setSelectedProjectState(project);
        if (project && currentOrganization) {
            const storageKey = `${SELECTED_PROJECT_KEY_PREFIX}${currentOrganization.id}`;
            localStorage.setItem(storageKey, project.id);
        }
    };

    const refetchProjects = async () => {
        await fetchProjects();
    };

    const isAllProjectsSelected = selectedProject?.id === ALL_PROJECTS_OPTION.id;

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProject,
            setSelectedProject,
            loading,
            refetchProjects,
            isOrgAdmin,
            isAllProjectsSelected
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}

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

export function ProjectProvider({ children, initialData }: { children: ReactNode, initialData?: Project[] }) {
    const { currentOrganization, loading: orgLoading } = useOrganization();
    const [projects, setProjects] = useState<Project[]>(initialData || []);
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
    const [loading, setLoading] = useState(!initialData);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 2;
    const canUseAllProjects = (projectsList: Project[], adminStatus: boolean) =>
        adminStatus || projectsList.length > 1;

    const fetchProjects = useCallback(async () => {
        // Don't fetch if organization context is still loading
        if (orgLoading && !currentOrganization) {
            return;
        }

        if (!currentOrganization) {
            setLoading(false);
            setProjects([]);
            setSelectedProjectState(null);
            return;
        }

        // Avoid re-fetching if we already have data for this org (and it's not a retry)
        if (projects.length > 0 && retryCount === 0) {
            // Check if current projects belong to current org (simple heuristic or improved later)
            // For now, let's assume if we have projects and just switched org, we might need to fetch
            // BUT if we just initialized with initialData, we are good.
        }

        setLoading(true);
        let scheduledRetry = false;

        try {
            const res = await fetch(`/api/projects?organizationId=${currentOrganization.id}`, {
                cache: 'no-store',
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            if (res.ok) {
                const data = await res.json().catch(() => null);
                if (!data || !Array.isArray(data.projects)) {
                    throw new Error('Invalid projects payload');
                }
                const projectsList = data.projects || [];
                const adminStatus = data.isOrgAdmin || false;

                setProjects(projectsList);
                setIsOrgAdmin(adminStatus);

                // Restore selected project from localStorage (organization-specific)
                const storageKey = `${SELECTED_PROJECT_KEY_PREFIX}${currentOrganization.id}`;
                const savedProjectId = localStorage.getItem(storageKey);

                const allProjectsEnabled = canUseAllProjects(projectsList, adminStatus);

                if (savedProjectId === ALL_PROJECTS_OPTION.id && allProjectsEnabled) {
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                } else if (savedProjectId) {
                    const savedProject = projectsList.find((p: Project) => p.id === savedProjectId);
                    if (savedProject) {
                        setSelectedProjectState(savedProject);
                    } else if (allProjectsEnabled) {
                        setSelectedProjectState(ALL_PROJECTS_OPTION);
                        localStorage.setItem(storageKey, ALL_PROJECTS_OPTION.id);
                    } else if (projectsList.length > 0) {
                        setSelectedProjectState(projectsList[0]);
                        localStorage.setItem(storageKey, projectsList[0].id);
                    } else {
                        setSelectedProjectState(null);
                    }
                } else if (allProjectsEnabled) {
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                    localStorage.setItem(storageKey, ALL_PROJECTS_OPTION.id);
                } else if (projectsList.length > 0) {
                    setSelectedProjectState(projectsList[0]);
                    localStorage.setItem(storageKey, projectsList[0].id);
                } else {
                    setSelectedProjectState(null);
                }
                return;
            }
            if ((res.status === 401 || res.status === 403) && retryCount < maxRetries) {
                scheduledRetry = true;
                setTimeout(() => setRetryCount((count) => count + 1), 600);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            if (retryCount < maxRetries) {
                scheduledRetry = true;
                setTimeout(() => setRetryCount((count) => count + 1), 600);
            }
        } finally {
            if (!scheduledRetry) {
                setLoading(false);
            }
        }
    }, [currentOrganization, orgLoading, retryCount, projects.length]);

    useEffect(() => {
        // If we have initial data and it matches the current org (implicitly), use it
        // Note: initialData in ProjectProvider is passed from layout, which fetches based on active org.
        // We need to be careful: if the user switches orgs client-side, initialData might be stale or from the previous org.
        // However, ProjectProvider is wrapping the whole dashboard.
        // Strategy: If initialData is present AND we are in the initial loading state, use it.
        if (initialData && initialData.length > 0 && projects.length === 0 && currentOrganization) {
            setProjects(initialData);
            setLoading(false);

            // Initialize selection logic for initialData
            const storageKey = `${SELECTED_PROJECT_KEY_PREFIX}${currentOrganization.id}`;
            const savedProjectId = localStorage.getItem(storageKey);
            let targetProject = null;

            if (savedProjectId) {
                if (savedProjectId === ALL_PROJECTS_OPTION.id && canUseAllProjects(initialData, isOrgAdmin)) {
                    targetProject = ALL_PROJECTS_OPTION;
                } else {
                    targetProject = initialData.find(p => p.id === savedProjectId);
                }
            }
            if (!targetProject) {
                if (canUseAllProjects(initialData, isOrgAdmin)) {
                    targetProject = ALL_PROJECTS_OPTION;
                } else if (initialData.length > 0) {
                    targetProject = initialData[0];
                }
            }
            if (targetProject) {
                setSelectedProjectState(targetProject);
            }
            return;
        }

        // Fetch when organization changes
        if (currentOrganization?.id) {
            // If we already have projects and they seem to be for a different org (heuristic needed or just fetch)
            // or if we have no projects, fetch.
            // Simplest robust way: if we didn't just use initialData, fetch.
            // We can check if `projects` contains items that don't look right, but checking orgId in project would be better.
            // For now, let's rely on the fact that if we just set initialData, we returned early.
            if (!initialData || projects.length === 0) {
                fetchProjects();
            }
        }
    }, [currentOrganization?.id, orgLoading, retryCount, fetchProjects, initialData, projects.length]);

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

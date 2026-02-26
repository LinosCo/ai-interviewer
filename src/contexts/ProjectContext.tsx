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
    const hasInitialProjects = Array.isArray(initialData) && initialData.length > 0;

    // === BT-DEBUG START ===
    console.log('[BT-DEBUG][ProjCtx] Render — currentOrg:', currentOrganization?.id || null, 'orgLoading:', orgLoading, 'hasInitialProjects:', hasInitialProjects, 'initialData?.length:', initialData?.length);
    // === BT-DEBUG END ===
    const [projects, setProjects] = useState<Project[]>(initialData || []);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);
    const canUseAllProjects = (projectsList: Project[], adminStatus: boolean) =>
        adminStatus || projectsList.length > 1;

    // Lazy initializer — resolves selectedProject synchronously from initialData
    // so the first render already has a project selected (avoids null flash).
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(() => {
        if (!hasInitialProjects) return null;
        if (typeof window === 'undefined') return initialData![0] ?? null;

        // Read the org ID from localStorage/cookie to build the project storage key
        const orgId = localStorage.getItem('bt_selected_org_id') ||
            document.cookie.split('; ').find(r => r.startsWith('bt_selected_org_id='))?.split('=')[1];

        if (orgId) {
            const storageKey = `${SELECTED_PROJECT_KEY_PREFIX}${orgId}`;
            const savedProjectId = localStorage.getItem(storageKey);

            if (savedProjectId === ALL_PROJECTS_OPTION.id && canUseAllProjects(initialData!, false)) {
                return ALL_PROJECTS_OPTION;
            }
            if (savedProjectId) {
                const found = initialData!.find(p => p.id === savedProjectId);
                if (found) return found;
            }
        }
        // Default: "All projects" if available, otherwise first project
        if (canUseAllProjects(initialData!, false)) return ALL_PROJECTS_OPTION;
        return initialData![0] ?? null;
    });

    const [loading, setLoading] = useState(!hasInitialProjects);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 2;

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

    // Track which organization we've already initialised projects for,
    // so we only fetch when the user switches orgs (not on every render).
    const [initializedOrgId, setInitializedOrgId] = useState<string | null>(
        () => currentOrganization?.id ?? null
    );

    useEffect(() => {
        // === BT-DEBUG START ===
        console.log('[BT-DEBUG][ProjCtx] useEffect fired — currentOrg:', currentOrganization?.id || null, 'initializedOrgId:', initializedOrgId, 'projects.length:', projects.length, 'selectedProject:', selectedProject?.id || null, 'hasInitialProjects:', hasInitialProjects);
        // === BT-DEBUG END ===

        if (!currentOrganization?.id) {
            console.log('[BT-DEBUG][ProjCtx] → no currentOrganization, returning early');
            return;
        }

        // Already initialised for this org (either from initialData or a previous fetch)
        if (initializedOrgId === currentOrganization.id && (projects.length > 0 || hasInitialProjects)) {
            console.log('[BT-DEBUG][ProjCtx] → already initialized for this org, skipping fetch');
            return;
        }

        // Org changed — fetch fresh projects
        console.log('[BT-DEBUG][ProjCtx] → org changed or not initialized, fetching projects...');
        setInitializedOrgId(currentOrganization.id);
        fetchProjects();
    }, [currentOrganization?.id, initializedOrgId, fetchProjects, projects.length, hasInitialProjects]);

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

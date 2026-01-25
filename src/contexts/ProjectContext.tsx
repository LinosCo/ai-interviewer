'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

const SELECTED_PROJECT_KEY = 'bt_selected_project_id';

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                const projectsList = data.projects || data; // Support both old and new API format
                const adminStatus = data.isOrgAdmin || false;

                setProjects(projectsList);
                setIsOrgAdmin(adminStatus);

                // Restore selected project from localStorage or set default
                const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);

                // Handle "All Projects" selection for admins
                if (savedProjectId === ALL_PROJECTS_OPTION.id && adminStatus) {
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                } else if (savedProjectId) {
                    const savedProject = projectsList.find((p: Project) => p.id === savedProjectId);
                    if (savedProject) {
                        setSelectedProjectState(savedProject);
                    } else if (adminStatus) {
                        // Saved project not found, default to "All Projects" for admins
                        setSelectedProjectState(ALL_PROJECTS_OPTION);
                        localStorage.setItem(SELECTED_PROJECT_KEY, ALL_PROJECTS_OPTION.id);
                    } else if (projectsList.length > 0) {
                        setSelectedProjectState(projectsList[0]);
                        localStorage.setItem(SELECTED_PROJECT_KEY, projectsList[0].id);
                    }
                } else if (adminStatus) {
                    // No saved project, default to "All Projects" for admins
                    setSelectedProjectState(ALL_PROJECTS_OPTION);
                    localStorage.setItem(SELECTED_PROJECT_KEY, ALL_PROJECTS_OPTION.id);
                } else if (projectsList.length > 0) {
                    // Default to first project for non-admins
                    setSelectedProjectState(projectsList[0]);
                    localStorage.setItem(SELECTED_PROJECT_KEY, projectsList[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const setSelectedProject = (project: Project | null) => {
        setSelectedProjectState(project);
        if (project) {
            localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
        }
    };

    const refetchProjects = async () => {
        setLoading(true);
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

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Project {
    id: string;
    name: string;
    isPersonal: boolean;
    role: 'OWNER' | 'MEMBER';
}

interface ProjectContextType {
    projects: Project[];
    selectedProject: Project | null;
    setSelectedProject: (project: Project) => void;
    loading: boolean;
    refetchProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const SELECTED_PROJECT_KEY = 'bt_selected_project_id';

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);

                // Restore selected project from localStorage or use first project
                const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
                const savedProject = data.find((p: Project) => p.id === savedProjectId);

                if (savedProject) {
                    setSelectedProjectState(savedProject);
                } else if (data.length > 0) {
                    // Default to first project (personal project since it's sorted first)
                    setSelectedProjectState(data[0]);
                    localStorage.setItem(SELECTED_PROJECT_KEY, data[0].id);
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

    const setSelectedProject = (project: Project) => {
        setSelectedProjectState(project);
        localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    };

    const refetchProjects = async () => {
        setLoading(true);
        await fetchProjects();
    };

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProject,
            setSelectedProject,
            loading,
            refetchProjects
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

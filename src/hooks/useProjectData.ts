'use client';

import { useState, useEffect } from 'react';
import { useProject, ALL_PROJECTS_OPTION } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface UseProjectDataOptions<T> {
    endpoint: string; // e.g., 'bots', 'interviews', etc.
    queryParams?: Record<string, string>;
}

export function useProjectData<T>({ endpoint, queryParams }: UseProjectDataOptions<T>) {
    const { selectedProject, loading: projectLoading, isAllProjectsSelected } = useProject();
    const { currentOrganization } = useOrganization();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (projectLoading) {
            return;
        }

        // Prevent infinite loading when no project is selected yet
        // (e.g. first render/race during org bootstrap).
        if (!selectedProject) {
            setLoading(false);
            setData(null);
            setError(null);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams(queryParams);
                if (currentOrganization?.id) {
                    params.set('organizationId', currentOrganization.id);
                }
                // For "All Projects", use a different API path
                const url = isAllProjectsSelected
                    ? `/api/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`
                    : `/api/projects/${selectedProject.id}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;

                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result = await res.json();
                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedProject?.id, projectLoading, endpoint, isAllProjectsSelected, JSON.stringify(queryParams), currentOrganization?.id]);

    const refetch = async () => {
        if (!selectedProject) return;

        setLoading(true);
        try {
            const params = new URLSearchParams(queryParams);
            if (currentOrganization?.id) {
                params.set('organizationId', currentOrganization.id);
            }
            const url = isAllProjectsSelected
                ? `/api/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`
                : `/api/projects/${selectedProject.id}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;

            const res = await fetch(url);
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (err) {
            console.error('Refetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    return {
        data,
        loading: projectLoading || loading,
        error,
        projectId: selectedProject?.id,
        isAllProjects: isAllProjectsSelected,
        refetch
    };
}

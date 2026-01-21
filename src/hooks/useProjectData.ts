'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';

interface UseProjectDataOptions<T> {
    endpoint: string; // e.g., 'bots', 'interviews', etc.
    queryParams?: Record<string, string>;
}

export function useProjectData<T>({ endpoint, queryParams }: UseProjectDataOptions<T>) {
    const { selectedProject, loading: projectLoading } = useProject();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (projectLoading || !selectedProject) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams(queryParams);
                const url = `/api/projects/${selectedProject.id}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;

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
    }, [selectedProject?.id, projectLoading, endpoint, JSON.stringify(queryParams)]);

    const refetch = async () => {
        if (!selectedProject) return;

        setLoading(true);
        try {
            const params = new URLSearchParams(queryParams);
            const url = `/api/projects/${selectedProject.id}/${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;

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
        refetch
    };
}

'use client';

import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ReactNode } from 'react';
import { useEffect } from 'react';

export function DashboardProviders({
    children,
    initialOrganizations,
    initialProjects
}: {
    children: ReactNode,
    initialOrganizations?: any[],
    initialProjects?: any[]
}) {
    useEffect(() => {
        // Prevent landing-embedded widget from persisting when navigating to dashboard.
        document.body.classList.add('hide-dashboard-widget');
        return () => {
            document.body.classList.remove('hide-dashboard-widget');
        };
    }, []);

    return (
        <OrganizationProvider initialData={initialOrganizations}>
            <ProjectProvider initialData={initialProjects}>
                {children}
            </ProjectProvider>
        </OrganizationProvider>
    );
}

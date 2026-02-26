'use client';

import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ReactNode } from 'react';

export function DashboardProviders({
    children,
    initialOrganizations,
    initialProjects
}: {
    children: ReactNode,
    initialOrganizations?: any[],
    initialProjects?: any[]
}) {
    return (
        <OrganizationProvider initialData={initialOrganizations}>
            <ProjectProvider initialData={initialProjects}>
                {children}
            </ProjectProvider>
        </OrganizationProvider>
    );
}

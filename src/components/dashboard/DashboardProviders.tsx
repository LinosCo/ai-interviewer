'use client';

import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ReactNode } from 'react';

export function DashboardProviders({ children }: { children: ReactNode }) {
    return (
        <OrganizationProvider>
            <ProjectProvider>
                {children}
            </ProjectProvider>
        </OrganizationProvider>
    );
}

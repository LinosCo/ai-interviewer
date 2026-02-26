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
    // === BT-DEBUG START ===
    console.log('[BT-DEBUG][DashProviders] Render — initialOrganizations:', initialOrganizations?.length ?? 'undefined', 'initialProjects:', initialProjects?.length ?? 'undefined');
    if (initialOrganizations && initialOrganizations.length > 0) {
        console.log('[BT-DEBUG][DashProviders] First org:', initialOrganizations[0]?.id, initialOrganizations[0]?.name);
    }
    // === BT-DEBUG END ===

    return (
        <OrganizationProvider initialData={initialOrganizations}>
            <ProjectProvider initialData={initialProjects}>
                {children}
            </ProjectProvider>
        </OrganizationProvider>
    );
}

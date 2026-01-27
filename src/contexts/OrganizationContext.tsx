'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface OrganizationContextType {
    organizations: Organization[];
    currentOrganization: Organization | null;
    setCurrentOrganization: (org: Organization | null) => void;
    loading: boolean;
    refetchOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'bt_selected_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrganizations = async () => {
        if (!session) return;

        try {
            const res = await fetch('/api/organizations');
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data.organizations);

                // Ripristina organizzazione selezionata
                const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
                if (savedOrgId) {
                    const savedOrg = data.organizations.find((o: Organization) => o.id === savedOrgId);
                    if (savedOrg) {
                        setCurrentOrganizationState(savedOrg);
                    } else if (data.organizations.length > 0) {
                        setCurrentOrganizationState(data.organizations[0]);
                        localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
                    }
                } else if (data.organizations.length > 0) {
                    setCurrentOrganizationState(data.organizations[0]);
                    localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchOrganizations();
        }
    }, [session]);

    const setCurrentOrganization = (org: Organization | null) => {
        setCurrentOrganizationState(org);
        if (org) {
            localStorage.setItem(SELECTED_ORG_KEY, org.id);
            // Trigger a page reload or event to refresh other contexts (like projects)
            // For now, let's keep it simple and assume components will react to currentOrganization change
        }
    };

    const refetchOrganizations = async () => {
        setLoading(true);
        await fetchOrganizations();
    };

    return (
        <OrganizationContext.Provider value={{
            organizations,
            currentOrganization,
            setCurrentOrganization,
            loading,
            refetchOrganizations
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
}

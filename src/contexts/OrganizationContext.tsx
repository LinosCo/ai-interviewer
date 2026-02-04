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
    isAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'bt_selected_org_id';
const COOKIE_ORG_KEY = 'bt_selected_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 2;

    const fetchOrganizations = async () => {
        if (!session) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch('/api/organizations');
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data.organizations);

                // Ripristina organizzazione selezionata
                const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY) ||
                    document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_ORG_KEY}=`))?.split('=')[1];

                if (savedOrgId) {
                    const savedOrg = data.organizations.find((o: Organization) => o.id === savedOrgId);
                    if (savedOrg) {
                        setCurrentOrganizationState(savedOrg);
                        // Assicurati che il cookie sia sincronizzato
                        document.cookie = `${COOKIE_ORG_KEY}=${savedOrg.id}; path=/; max-age=31536000; SameSite=Lax`;
                    } else if (data.organizations.length > 0) {
                        setCurrentOrganizationState(data.organizations[0]);
                        localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
                        document.cookie = `${COOKIE_ORG_KEY}=${data.organizations[0].id}; path=/; max-age=31536000; SameSite=Lax`;
                    }
                } else if (data.organizations.length > 0) {
                    setCurrentOrganizationState(data.organizations[0]);
                    localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
                    document.cookie = `${COOKIE_ORG_KEY}=${data.organizations[0].id}; path=/; max-age=31536000; SameSite=Lax`;
                }

                // Only set loading to false after we've set the current organization
                // This ensures dependent contexts (like ProjectContext) don't start fetching too early
                setLoading(false);
            } else {
                setLoading(false);
                if ((res.status === 401 || res.status === 403) && retryCount < maxRetries) {
                    setTimeout(() => setRetryCount((count) => count + 1), 600);
                }
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            setLoading(false);
            setOrganizations([]);
            setCurrentOrganizationState(null);
            return;
        }

        if (status === 'authenticated') {
            fetchOrganizations();
        }
    }, [status, session, retryCount]);

    const setCurrentOrganization = (org: Organization | null) => {
        setCurrentOrganizationState(org);
        if (org) {
            localStorage.setItem(SELECTED_ORG_KEY, org.id);
            document.cookie = `${COOKIE_ORG_KEY}=${org.id}; path=/; max-age=31536000; SameSite=Lax`;
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
            refetchOrganizations,
            isAdmin: (session?.user as any)?.role === 'ADMIN'
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

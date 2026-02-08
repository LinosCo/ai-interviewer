'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

export function OrganizationProvider({ children, initialData }: { children: ReactNode, initialData?: Organization[] }) {
    const { data: session, status } = useSession();
    const [organizations, setOrganizations] = useState<Organization[]>(initialData || []);
    const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(!initialData);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;

    const fetchOrganizations = useCallback(async () => {
        if (status !== 'authenticated') {
            return;
        }

        let scheduledRetry = false;
        try {
            // Only set loading to true if we don't have any organizations yet
            if (organizations.length === 0) {
                setLoading(true);
            }

            const res = await fetch(`/api/organizations?_ts=${Date.now()}`, {
                cache: 'no-store',
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            if (res.ok) {
                const data = await res.json().catch(() => null);
                if (!data || !Array.isArray(data.organizations)) {
                    throw new Error('Invalid organizations payload');
                }
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

                if (data.organizations.length > 0) {
                    setRetryCount(0);
                } else {
                    setCurrentOrganizationState(null);
                    if (retryCount < maxRetries) {
                        scheduledRetry = true;
                        const delayMs = Math.min(5000, 600 * Math.pow(1.6, retryCount));
                        setTimeout(() => setRetryCount((count) => count + 1), delayMs);
                        return;
                    }
                }
            } else {
                if ((res.status === 401 || res.status === 403 || res.status >= 500) && retryCount < maxRetries) {
                    scheduledRetry = true;
                    const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                    setTimeout(() => setRetryCount((count) => count + 1), delayMs);
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
            if (retryCount < maxRetries) {
                scheduledRetry = true;
                const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                setTimeout(() => setRetryCount((count) => count + 1), delayMs);
                return;
            }
        } finally {
            if (!scheduledRetry) {
                setLoading(false);
            }
        }
    }, [maxRetries, retryCount, status]);

    useEffect(() => {
        if (status === 'loading') {
            setLoading(true);
            return;
        }

        if (status === 'unauthenticated') {
            setLoading(false);
            setOrganizations([]);
            setCurrentOrganizationState(null);
            return;
        }

        if (status === 'authenticated') {
            fetchOrganizations();
        }
    }, [status, retryCount, fetchOrganizations]);

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
        setRetryCount(0);
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

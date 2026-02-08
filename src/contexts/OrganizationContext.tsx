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
            // Only set loading to true if we don't have any organizations yet AND it's not a retry
            if (organizations.length === 0 && retryCount === 0) {
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

                // Initialize selection logic
                const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY) ||
                    document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_ORG_KEY}=`))?.split('=')[1];

                let targetOrg = null;

                if (savedOrgId) {
                    targetOrg = data.organizations.find((o: Organization) => o.id === savedOrgId);
                }

                if (!targetOrg && data.organizations.length > 0) {
                    targetOrg = data.organizations[0];
                }

                if (targetOrg) {
                    setCurrentOrganizationState(targetOrg);
                    localStorage.setItem(SELECTED_ORG_KEY, targetOrg.id);
                    document.cookie = `${COOKIE_ORG_KEY}=${targetOrg.id}; path=/; max-age=31536000; SameSite=Lax`;
                }

                if (data.organizations.length > 0) {
                    setRetryCount(0);
                }
            } else {
                if ((res.status === 401 || res.status === 403 || res.status >= 500) && retryCount < maxRetries) {
                    scheduledRetry = true;
                    const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                    setTimeout(() => setRetryCount((count) => count + 1), delayMs);
                }
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
            if (retryCount < maxRetries) {
                scheduledRetry = true;
                const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                setTimeout(() => setRetryCount((count) => count + 1), delayMs);
            }
        } finally {
            if (!scheduledRetry) {
                setLoading(false);
            }
        }
    }, [maxRetries, retryCount, status, organizations.length]);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            setLoading(false);
            setOrganizations([]);
            setCurrentOrganizationState(null);
            return;
        }

        if (status === 'authenticated') {
            // If we have initial data, use it properly first
            if (initialData && initialData.length > 0 && organizations.length === 0) {
                setOrganizations(initialData);
                // Initialize selection from initial data immediately
                const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY) ||
                    document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_ORG_KEY}=`))?.split('=')[1];
                let targetOrg = null;

                if (savedOrgId) {
                    targetOrg = initialData.find(o => o.id === savedOrgId);
                }
                if (!targetOrg) {
                    targetOrg = initialData[0];
                }
                if (targetOrg) {
                    setCurrentOrganizationState(targetOrg);
                }
                setLoading(false);
            } else if (organizations.length === 0) {
                // Fetch if no data at all
                fetchOrganizations();
            } else if (organizations.length > 0 && !currentOrganization) {
                // Ensure selection if data exists but selection fell through
                const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
                const target = organizations.find(o => o.id === savedOrgId) || organizations[0];
                if (target) setCurrentOrganizationState(target);
                setLoading(false);
            }
        }
    }, [status, retryCount, fetchOrganizations, initialData, organizations.length, currentOrganization]);

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

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
    error?: string | null;
    refetchOrganizations: () => Promise<void>;
    isAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'bt_selected_org_id';
const COOKIE_ORG_KEY = 'bt_selected_org_id';

export function OrganizationProvider({ children, initialData }: { children: ReactNode, initialData?: Organization[] }) {
    const { data: session, status } = useSession();
    const hasInitialOrganizations = Array.isArray(initialData) && initialData.length > 0;

    // === BT-DEBUG START ===
    console.log('[BT-DEBUG][OrgCtx] Render — status:', status, 'hasInitialOrgs:', hasInitialOrganizations, 'initialData?.length:', initialData?.length, 'session?.user?.id:', session?.user?.id);
    // === BT-DEBUG END ===
    const [organizations, setOrganizations] = useState<Organization[]>(initialData || []);
    const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(() => {
        if (!hasInitialOrganizations) return null;
        // Eagerly resolve from localStorage/cookie so first render shows the org immediately
        if (typeof window !== 'undefined') {
            const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY) ||
                document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_ORG_KEY}=`))?.split('=')[1];
            if (savedOrgId) {
                const found = (initialData || []).find(o => o.id === savedOrgId);
                if (found) return found;
            }
        }
        return initialData![0] ?? null;
    });
    const [loading, setLoading] = useState(!hasInitialOrganizations);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;

    const [error, setError] = useState<string | null>(null);

    const resolvePreferredOrganization = useCallback((list: Organization[]): Organization | null => {
        if (!Array.isArray(list) || list.length === 0) return null;
        const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY) ||
            document.cookie.split('; ').find(row => row.startsWith(`${COOKIE_ORG_KEY}=`))?.split('=')[1];
        if (savedOrgId) {
            const found = list.find((o) => o.id === savedOrgId);
            if (found) return found;
        }
        return list[0] || null;
    }, []);

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
            // Clear error on start of new fetch cycle (not retries)
            if (retryCount === 0) setError(null);

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
                setError(null);

                // Initialize selection logic
                const targetOrg = resolvePreferredOrganization(data.organizations);

                if (targetOrg) {
                    setCurrentOrganizationState(targetOrg);
                    localStorage.setItem(SELECTED_ORG_KEY, targetOrg.id);
                    document.cookie = `${COOKIE_ORG_KEY}=${targetOrg.id}; path=/; max-age=31536000; SameSite=Lax`;
                }

                if (data.organizations.length > 0) {
                    setRetryCount(0);
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.error || `Server error: ${res.status}`;
                console.error(`Fetch organizations failed with status: ${res.status}`, errorData);

                if ((res.status === 401 || res.status === 403 || res.status >= 500)) {
                    if (retryCount < maxRetries) {
                        scheduledRetry = true;
                        const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                        setTimeout(() => setRetryCount((count) => count + 1), delayMs);
                    } else {
                        setError(errorMessage);
                    }
                } else {
                    setError(errorMessage);
                }
            }
        } catch (error: any) {
            console.error('Failed to fetch organizations:', error);
            if (retryCount < maxRetries) {
                scheduledRetry = true;
                const delayMs = Math.min(5000, 500 * Math.pow(2, retryCount));
                setTimeout(() => setRetryCount((count) => count + 1), delayMs);
            } else {
                setError(error.message || 'Connection failed');
            }
        } finally {
            if (!scheduledRetry) {
                setLoading(false);
            }
        }
    }, [maxRetries, retryCount, status, organizations.length, resolvePreferredOrganization]);

    useEffect(() => {
        // === BT-DEBUG START ===
        console.log('[BT-DEBUG][OrgCtx] useEffect fired — status:', status, 'orgs.length:', organizations.length, 'currentOrg:', currentOrganization?.id || null, 'hasInitialOrgs:', hasInitialOrganizations, 'error:', error, 'retryCount:', retryCount);
        // === BT-DEBUG END ===

        if (status === 'loading') {
            console.log('[BT-DEBUG][OrgCtx] → branch: status=loading, returning early');
            return;
        }

        if (status === 'unauthenticated') {
            console.log('[BT-DEBUG][OrgCtx] → branch: UNAUTHENTICATED — wiping data!');
            setLoading(false);
            setOrganizations([]);
            setCurrentOrganizationState(null);
            return;
        }

        if (status === 'authenticated') {
            // Initialize from server-provided organizations
            if (hasInitialOrganizations && organizations.length === 0) {
                console.log('[BT-DEBUG][OrgCtx] → branch: authenticated, hasInitialOrgs but orgs empty, restoring initialData');
                setOrganizations(initialData);
                const targetOrg = resolvePreferredOrganization(initialData);
                if (targetOrg) {
                    setCurrentOrganizationState(targetOrg);
                    localStorage.setItem(SELECTED_ORG_KEY, targetOrg.id);
                    document.cookie = `${COOKIE_ORG_KEY}=${targetOrg.id}; path=/; max-age=31536000; SameSite=Lax`;
                }
                setLoading(false);
            } else if (organizations.length === 0 && !error) { // Only fetch if no data at all
                console.log('[BT-DEBUG][OrgCtx] → branch: authenticated, no orgs, fetching...');
                // Fetch if no data at all
                fetchOrganizations();
            } else if (organizations.length > 0 && !currentOrganization) {
                console.log('[BT-DEBUG][OrgCtx] → branch: authenticated, orgs exist but no currentOrg, resolving...');
                // Ensure selection if data exists but selection fell through
                const target = resolvePreferredOrganization(organizations);
                if (target) setCurrentOrganizationState(target);
                setLoading(false);
            } else {
                console.log('[BT-DEBUG][OrgCtx] → branch: authenticated, no action needed (orgs.length:', organizations.length, 'currentOrg:', currentOrganization?.id, ')');
            }
        }
    }, [status, retryCount, fetchOrganizations, initialData, organizations, organizations.length, currentOrganization, error, hasInitialOrganizations, resolvePreferredOrganization]);

    const setCurrentOrganization = (org: Organization | null) => {
        setCurrentOrganizationState(org);
        if (org) {
            localStorage.setItem(SELECTED_ORG_KEY, org.id);
            document.cookie = `${COOKIE_ORG_KEY}=${org.id}; path=/; max-age=31536000; SameSite=Lax`;
        }
    };

    const refetchOrganizations = async () => {
        setRetryCount(0);
        setError(null);
        setLoading(true);
        await fetchOrganizations();
    };

    return (
        <OrganizationContext.Provider value={{
            organizations,
            currentOrganization,
            setCurrentOrganization,
            loading,
            error,
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

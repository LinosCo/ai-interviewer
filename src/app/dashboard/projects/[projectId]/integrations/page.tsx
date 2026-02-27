'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IntegrationsGrid } from '@/components/integrations';
import { AnimatePresence } from 'framer-motion';
import { ConnectionsTab } from '@/components/integrations/ConnectionsTab';
import { AiRoutingTab } from '@/components/integrations/AiRoutingTab';

interface MCPConnection {
  id: string;
  type: 'WORDPRESS' | 'WOOCOMMERCE';
  name: string;
  status: 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface GoogleConnection {
  id: string;
  serviceAccountEmail: string;
  ga4Enabled: boolean;
  ga4PropertyId?: string | null;
  ga4Status: 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  ga4LastSyncAt?: string | null;
  ga4LastError?: string | null;
  gscEnabled: boolean;
  gscSiteUrl?: string | null;
  gscStatus: 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  gscLastSyncAt?: string | null;
  gscLastError?: string | null;
}

interface CMSConnection {
  id: string;
  name: string;
  status: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
}

interface N8NConnection {
  id: string;
  name: string;
  webhookUrl: string;
  status: 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  lastTriggerAt?: string | null;
  lastError?: string | null;
  triggerOnTips: boolean;
}

interface Project {
  id: string;
  name: string;
  organizationId?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

type UserPlan = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'PARTNER';

interface MCPConnectionsResponse {
  connections?: MCPConnection[];
}

interface GoogleConnectionResponse {
  connection?: GoogleConnection | null;
}

interface CMSConnectionResponse {
  connection?: CMSConnection | null;
}

interface N8NConnectionResponse {
  connection?: N8NConnection | null;
}

interface UserMeResponse {
  plan?: string;
}

interface ProjectsListResponse {
  projects?: Project[];
}

interface ProjectResponse {
  project?: {
    organization?: {
      id: string;
      name: string;
      plan?: string;
    };
  };
  organization?: {
    id: string;
    name: string;
    plan?: string;
  };
}

interface OrganizationsResponse {
  organizations?: Organization[];
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [googleConnection, setGoogleConnection] = useState<GoogleConnection | null>(null);
  const [cmsConnection, setCmsConnection] = useState<CMSConnection | null>(null);
  const [n8nConnection, setN8nConnection] = useState<N8NConnection | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [currentOrgName, setCurrentOrgName] = useState<string>('');
  const [userPlan, setUserPlan] = useState<UserPlan>('FREE');
  const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'connections' | 'routing' | 'settings'>('connections');

  const showNotification = useCallback((type: 'error' | 'success', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Fetch all integrations data
  const fetchData = useCallback(async () => {
    try {
      const [mcpRes, googleRes, cmsRes, n8nRes, userRes, projectsRes] = await Promise.all([
        fetch(`/api/integrations/mcp/connections?projectId=${projectId}`),
        fetch(`/api/integrations/google/connections?projectId=${projectId}`),
        fetch(`/api/cms/connection?projectId=${projectId}`),
        fetch(`/api/integrations/n8n/connections?projectId=${projectId}`),
        fetch('/api/user/me'),
        fetch('/api/projects/list-all'),
      ]);

      const [mcpData, googleData, cmsData, n8nData, userData, projectsData] = await Promise.all([
        readJsonSafely<MCPConnectionsResponse>(mcpRes),
        readJsonSafely<GoogleConnectionResponse>(googleRes),
        readJsonSafely<CMSConnectionResponse>(cmsRes),
        readJsonSafely<N8NConnectionResponse>(n8nRes),
        readJsonSafely<UserMeResponse>(userRes),
        readJsonSafely<ProjectsListResponse>(projectsRes),
      ]);

      if (mcpRes.ok) {
        setMcpConnections(mcpData?.connections || []);
      }

      if (googleRes.ok) {
        setGoogleConnection(googleData?.connection || null);
      }

      if (cmsRes.ok) {
        if (cmsData?.connection) {
          setCmsConnection({
            id: cmsData.connection.id,
            name: cmsData.connection.name,
            status: cmsData.connection.status,
            lastSyncAt: cmsData.connection.lastSyncAt,
            lastSyncError: cmsData.connection.lastSyncError,
          });
        }
      }

      if (n8nRes.ok) {
        setN8nConnection(n8nData?.connection || null);
      }

      if (userRes.ok) {
        setUserPlan((userData?.plan || 'FREE').toUpperCase() as UserPlan);
      }

      if (projectsRes.ok) {
        setProjects(projectsData?.projects || []);
      }

      // Fetch current project organization info
      try {
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (projectRes.ok) {
          const projectData = await readJsonSafely<ProjectResponse>(projectRes);
          if (projectData?.project?.organization) {
            setCurrentOrgId(projectData.project.organization.id);
            setCurrentOrgName(projectData.project.organization.name);
            // Source of truth for integrations plan is the Organization
            setUserPlan((projectData.project.organization.plan || 'FREE').toUpperCase() as UserPlan);
          } else if (projectData?.organization) {
            // Some API variations return organization directly
            setCurrentOrgId(projectData.organization.id);
            setCurrentOrgName(projectData.organization.name);
            setUserPlan((projectData.organization.plan || 'FREE').toUpperCase() as UserPlan);
          }
        }
      } catch (err) {
        console.error('Error fetching project org:', err);
      }

      // Fetch user's organizations
      try {
        const orgsRes = await fetch('/api/organizations');
        if (orgsRes.ok) {
          const orgsData = await readJsonSafely<OrganizationsResponse>(orgsRes);
          setOrganizations(orgsData?.organizations || []);
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleTestMCP = async (id: string) => {
    const res = await fetch(`/api/integrations/mcp/connections/${id}/test`, {
      method: 'POST',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleDeleteMCP = async (id: string) => {
    const res = await fetch(`/api/integrations/mcp/connections/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleConfigureMCP = (type: 'WORDPRESS' | 'WOOCOMMERCE') => {
    router.push(`/dashboard/projects/${projectId}/integrations/connect/${type.toLowerCase()}`);
  };

  const handleTestGA4 = async (id: string) => {
    const res = await fetch(`/api/integrations/google/connections/${id}/test-ga4`, {
      method: 'POST',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleTestGSC = async (id: string) => {
    const res = await fetch(`/api/integrations/google/connections/${id}/test-gsc`, {
      method: 'POST',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleConfigureGoogle = () => {
    router.push(`/dashboard/projects/${projectId}/integrations/connect/google`);
  };

  const handleDeleteGoogle = async (id: string) => {
    const res = await fetch(`/api/integrations/google/connections/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleDeleteCMS = async (id: string) => {
    try {
      const res = await fetch(`/api/cms/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
      } else {
        console.error('Failed to delete CMS connection');
      }
    } catch (error) {
      console.error('Error deleting CMS connection:', error);
    }
  };

  const handleOpenCMSDashboard = async () => {
    try {
      const res = await fetch('/api/cms/dashboard-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('CMS Dashboard URL generated:', data.url);
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        const error = await res.json();
        console.error('Failed to get CMS dashboard URL:', error);
        showNotification('error', error.error || 'Impossibile aprire il CMS');
      }
    } catch (error) {
      console.error('Error opening CMS dashboard:', error);
    }
  };

  const handleConfigureCMS = () => {
    router.push(`/dashboard/projects/${projectId}/integrations/connect/cms`);
  };

  const handleTestN8N = async (id: string) => {
    const res = await fetch(`/api/integrations/n8n/connections/${id}/test`, {
      method: 'POST',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleDeleteN8N = async (id: string) => {
    const res = await fetch(`/api/integrations/n8n/connections/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchData();
    }
  };

  const handleConfigureN8N = () => {
    router.push(`/dashboard/projects/${projectId}/integrations/connect/n8n`);
  };

  if (loading) {
    return (
      <div className="px-8 pt-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 bg-gray-100 rounded-full w-40" />
          <div className="h-4 bg-gray-100 rounded-full w-64" />
          <div className="flex gap-4 border-b border-gray-100 pb-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-24 bg-gray-100 rounded-t-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 bg-gray-100 rounded-[2.5rem]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'connections' as const, label: 'Connessioni' },
    { id: 'routing' as const, label: 'AI Routing' },
    { id: 'settings' as const, label: 'Impostazioni' },
  ] as const;

  // Compute number of active connections for the tab badge
  const activeCount = [
    ...mcpConnections.filter(c => c.status === 'ACTIVE'),
    ...(
      googleConnection &&
      (googleConnection.ga4Status === 'ACTIVE' || googleConnection.gscStatus === 'ACTIVE')
        ? [googleConnection]
        : []
    ),
    ...(cmsConnection?.status === 'ACTIVE' ? [cmsConnection] : []),
    ...(n8nConnection?.status === 'ACTIVE' ? [n8nConnection] : []),
  ].length;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      {/* Page header + tab bar */}
      <div className="px-8 pt-8 pb-0 flex-shrink-0">
        {/* Inline notification */}
        {notification && (
          <div
            className={`mb-4 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between
              ${notification.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : 'bg-green-50 text-green-700 border border-green-100'
              }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrazioni</h1>
          <p className="text-sm text-gray-400 mt-1">
            Connetti i tuoi strumenti e configura il routing automatico dei contenuti AI.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-4 py-3 text-sm font-semibold transition-colors
                ${activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
                }
              `}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {tab.id === 'connections' && activeCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black">
                    {activeCount}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-hidden px-8">
        <AnimatePresence mode="wait">
          {activeTab === 'connections' && (
            <ConnectionsTab
              key="connections"
              activeCount={activeCount}
              mcpConnections={mcpConnections}
              googleConnection={googleConnection}
              cmsConnection={cmsConnection}
              n8nConnection={n8nConnection}
              userPlan={userPlan}
              onTestMCP={handleTestMCP}
              onDeleteMCP={handleDeleteMCP}
              onConfigureMCP={handleConfigureMCP}
              onTestGA4={handleTestGA4}
              onTestGSC={handleTestGSC}
              onConfigureGoogle={handleConfigureGoogle}
              onDeleteGoogle={handleDeleteGoogle}
              onDeleteCMS={handleDeleteCMS}
              onOpenCMSDashboard={handleOpenCMSDashboard}
              onConfigureCMS={handleConfigureCMS}
              onTestN8N={handleTestN8N}
              onDeleteN8N={handleDeleteN8N}
              onConfigureN8N={handleConfigureN8N}
              projects={projects}
              organizations={organizations}
              currentProjectId={projectId}
              currentOrgId={currentOrgId}
              currentOrgName={currentOrgName}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'routing' && (
            <AiRoutingTab
              key="routing"
              projectId={projectId}
              mcpConnections={mcpConnections}
              cmsConnection={cmsConnection}
              n8nConnection={n8nConnection}
            />
          )}
          {activeTab === 'settings' && (
            <div
              key="settings"
              className="flex-1 overflow-y-auto pt-6 pb-8"
            >
              <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
                  Impostazioni progetto
                </p>
                <p className="text-sm text-gray-400">
                  Le impostazioni di progetto sono disponibili dalla sezione{' '}
                  <a
                    href={`/dashboard/projects`}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Progetti →
                  </a>
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

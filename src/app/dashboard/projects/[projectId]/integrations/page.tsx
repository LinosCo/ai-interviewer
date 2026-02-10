'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IntegrationsGrid } from '@/components/integrations';

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

      if (mcpRes.ok) {
        const data = await mcpRes.json();
        setMcpConnections(data.connections || []);
      }

      if (googleRes.ok) {
        const data = await googleRes.json();
        setGoogleConnection(data.connection || null);
      }

      if (cmsRes.ok) {
        const data = await cmsRes.json();
        if (data.connection) {
          setCmsConnection({
            id: data.connection.id,
            name: data.connection.name,
            status: data.connection.status,
            lastSyncAt: data.connection.lastSyncAt,
            lastSyncError: data.connection.lastSyncError,
          });
        }
      }

      if (n8nRes.ok) {
        const data = await n8nRes.json();
        setN8nConnection(data.connection || null);
      }

      if (userRes.ok) {
        const data = await userRes.json();
        setUserPlan(data.plan || 'FREE');
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || []);
      }

      // Fetch current project organization info
      try {
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          if (projectData.project?.organization) {
            setCurrentOrgId(projectData.project.organization.id);
            setCurrentOrgName(projectData.project.organization.name);
            // Source of truth for integrations plan is the Organization
            setUserPlan(projectData.project.organization.plan || 'FREE');
          } else if (projectData.organization) {
            // Some API variations return organization directly
            setCurrentOrgId(projectData.organization.id);
            setCurrentOrgName(projectData.organization.name);
            setUserPlan(projectData.organization.plan || 'FREE');
          }
        }
      } catch (err) {
        console.error('Error fetching project org:', err);
      }

      // Fetch user's organizations
      try {
        const orgsRes = await fetch('/api/organizations');
        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          setOrganizations(orgsData.organizations || []);
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
        alert(error.error || 'Impossibile aprire il CMS');
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
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <IntegrationsGrid
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
    </div>
  );
}

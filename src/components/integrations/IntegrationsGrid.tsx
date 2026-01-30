'use client';

import { IntegrationCard } from './IntegrationCard';
import { ConnectionShareDialog } from './ConnectionShareDialog';
import { ConnectionTransferOrgDialog } from './ConnectionTransferOrgDialog';
import { useState } from 'react';
import TransferDialog from '@/components/dashboard/TransferDialog';
import {
  transferMCPConnectionToProject,
  transferGoogleConnectionToProject,
  transferCMSConnectionToProject
} from '@/app/actions/project-tools';

type ConnectionStatus = 'PENDING' | 'TESTING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

interface MCPConnection {
  id: string;
  type: 'WORDPRESS' | 'WOOCOMMERCE';
  name: string;
  status: ConnectionStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface GoogleConnection {
  id: string;
  serviceAccountEmail: string;
  ga4Enabled: boolean;
  ga4PropertyId?: string | null;
  ga4Status: ConnectionStatus;
  ga4LastSyncAt?: string | null;
  ga4LastError?: string | null;
  gscEnabled: boolean;
  gscSiteUrl?: string | null;
  gscStatus: ConnectionStatus;
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

interface IntegrationsGridProps {
  mcpConnections: MCPConnection[];
  googleConnection: GoogleConnection | null;
  cmsConnection: CMSConnection | null;
  userPlan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'PARTNER';
  onTestMCP: (id: string) => Promise<void>;
  onDeleteMCP: (id: string) => Promise<void>;
  onConfigureMCP: (type: 'WORDPRESS' | 'WOOCOMMERCE') => void;
  onTestGA4: (id: string) => Promise<void>;
  onTestGSC: (id: string) => Promise<void>;
  onConfigureGoogle: () => void;
  onDeleteGoogle: (id: string) => Promise<void>;
  projects: Project[];
  organizations?: Organization[];
  currentProjectId: string;
  currentOrgId?: string;
  currentOrgName?: string;
  onRefresh: () => void;
}

export function IntegrationsGrid({
  mcpConnections,
  googleConnection,
  cmsConnection,
  userPlan,
  onTestMCP,
  onDeleteMCP,
  onConfigureMCP,
  onTestGA4,
  onTestGSC,
  onConfigureGoogle,
  onDeleteGoogle,
  projects,
  organizations = [],
  currentProjectId,
  currentOrgId = '',
  currentOrgName = '',
  onRefresh
}: IntegrationsGridProps) {
  const [transferItem, setTransferItem] = useState<{ id: string; name: string; type: 'MCP' | 'GOOGLE' | 'CMS' } | null>(null);
  const [shareConnection, setShareConnection] = useState<{ id: string; name: string; type: 'CMS' | 'MCP' } | null>(null);
  const [transferOrgConnection, setTransferOrgConnection] = useState<{ id: string; name: string; type: 'CMS' | 'MCP' } | null>(null);

  const canRead = ['PRO', 'BUSINESS', 'PARTNER'].includes(userPlan);
  const canWrite = ['BUSINESS', 'PARTNER'].includes(userPlan);

  // Find existing connections
  const wpConnection = mcpConnections.find(c => c.type === 'WORDPRESS');
  const wooConnection = mcpConnections.find(c => c.type === 'WOOCOMMERCE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Integrazioni</h2>
          <p className="text-sm text-gray-500 mt-1">
            Connetti i tuoi canali per analisi cross-channel
            {canWrite && ' e pubblicazione automatica dei contenuti'}.
          </p>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google */}
        <IntegrationCard
          id={googleConnection?.id || 'google'}
          type="GOOGLE"
          name="Google"
          description="Analytics + Search Console"
          status={
            googleConnection
              ? googleConnection.ga4Status === 'ACTIVE' && googleConnection.gscStatus === 'ACTIVE'
                ? 'ACTIVE'
                : googleConnection.ga4Status === 'ERROR' || googleConnection.gscStatus === 'ERROR'
                  ? 'ERROR'
                  : 'PENDING'
              : 'DISABLED'
          }
          lastSyncAt={googleConnection?.ga4LastSyncAt || googleConnection?.gscLastSyncAt}
          lastError={googleConnection?.ga4LastError || googleConnection?.gscLastError}
          onTest={
            googleConnection
              ? async () => {
                if (googleConnection.ga4Enabled) await onTestGA4(googleConnection.id);
                if (googleConnection.gscEnabled) await onTestGSC(googleConnection.id);
              }
              : undefined
          }
          onConfigure={onConfigureGoogle}
          onDelete={googleConnection ? () => onDeleteGoogle(googleConnection.id) : undefined}
          onTransfer={googleConnection ? () => setTransferItem({ id: googleConnection.id, name: 'Google Connection', type: 'GOOGLE' }) : undefined}
          disabled={!googleConnection}
          upgradeRequired={!canRead}
        />

        {/* WordPress */}
        <IntegrationCard
          id={wpConnection?.id || 'wordpress'}
          type="WORDPRESS"
          name="WordPress"
          description={canWrite ? 'CMS & Blog (lettura + scrittura)' : 'CMS & Blog (sola lettura)'}
          status={wpConnection?.status || 'DISABLED'}
          lastSyncAt={wpConnection?.lastSyncAt}
          lastError={wpConnection?.lastError}
          onTest={wpConnection ? () => onTestMCP(wpConnection.id) : undefined}
          onConfigure={() => onConfigureMCP('WORDPRESS')}
          onDelete={wpConnection ? () => onDeleteMCP(wpConnection.id) : undefined}
          onTransfer={wpConnection ? () => setTransferItem({ id: wpConnection.id, name: wpConnection.name, type: 'MCP' }) : undefined}
          onManageSharing={wpConnection ? () => setShareConnection({ id: wpConnection.id, name: wpConnection.name, type: 'MCP' }) : undefined}
          onTransferOrg={wpConnection ? () => setTransferOrgConnection({ id: wpConnection.id, name: wpConnection.name, type: 'MCP' }) : undefined}
          disabled={!wpConnection}
          upgradeRequired={!canRead}
        />

        {/* WooCommerce */}
        <IntegrationCard
          id={wooConnection?.id || 'woocommerce'}
          type="WOOCOMMERCE"
          name="WooCommerce"
          description="E-commerce (lettura + scrittura)"
          status={wooConnection?.status || 'DISABLED'}
          lastSyncAt={wooConnection?.lastSyncAt}
          lastError={wooConnection?.lastError}
          onTest={wooConnection ? () => onTestMCP(wooConnection.id) : undefined}
          onConfigure={() => onConfigureMCP('WOOCOMMERCE')}
          onDelete={wooConnection ? () => onDeleteMCP(wooConnection.id) : undefined}
          onTransfer={wooConnection ? () => setTransferItem({ id: wooConnection.id, name: wooConnection.name, type: 'MCP' }) : undefined}
          onManageSharing={wooConnection ? () => setShareConnection({ id: wooConnection.id, name: wooConnection.name, type: 'MCP' }) : undefined}
          onTransferOrg={wooConnection ? () => setTransferOrgConnection({ id: wooConnection.id, name: wooConnection.name, type: 'MCP' }) : undefined}
          disabled={!wooConnection}
          upgradeRequired={!canWrite}
        />

        {/* CMS Voler.ai */}
        <IntegrationCard
          id={cmsConnection?.id || 'cms-voler'}
          type="CMS_VOLER"
          name="CMS Voler.ai"
          description="Siti sviluppati da Voler.ai"
          status={
            cmsConnection
              ? (cmsConnection.status as 'ACTIVE' | 'ERROR' | 'PENDING')
              : 'DISABLED'
          }
          lastSyncAt={cmsConnection?.lastSyncAt}
          lastError={cmsConnection?.lastSyncError}
          onTransfer={cmsConnection ? () => setTransferItem({ id: cmsConnection.id, name: cmsConnection.name, type: 'CMS' }) : undefined}
          onManageSharing={cmsConnection ? () => setShareConnection({ id: cmsConnection.id, name: cmsConnection.name, type: 'CMS' }) : undefined}
          onTransferOrg={cmsConnection ? () => setTransferOrgConnection({ id: cmsConnection.id, name: cmsConnection.name, type: 'CMS' }) : undefined}
          disabled={!cmsConnection}
          upgradeRequired={!canWrite}
        />
      </div>

      {/* Upgrade Banner for FREE/STARTER */}
      {!canRead && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h3 className="text-xl font-bold mb-2">
            Sblocca le Integrazioni
          </h3>
          <p className="text-indigo-100 mb-4">
            Con PRO accedi a Google Analytics e Search Console per analisi cross-channel.
            Con BUSINESS puoi pubblicare direttamente su WordPress e WooCommerce.
          </p>
          <a
            href="/dashboard/settings/billing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Scopri i piani
          </a>
        </div>
      )}

      {/* Transfer Dialog (legacy - project to project) */}
      {transferItem && (
        <TransferDialog
          isOpen={!!transferItem}
          onClose={() => setTransferItem(null)}
          itemName={transferItem.name}
          itemId={transferItem.id}
          itemType="TOOL"
          targetProjects={projects}
          currentProjectId={currentProjectId}
          onTransfer={async (targetId) => {
            if (transferItem.type === 'MCP') await transferMCPConnectionToProject(transferItem.id, targetId);
            if (transferItem.type === 'GOOGLE') await transferGoogleConnectionToProject(transferItem.id, targetId);
            if (transferItem.type === 'CMS') await transferCMSConnectionToProject(transferItem.id, targetId);
            onRefresh();
          }}
        />
      )}

      {/* Share Connection Dialog (multi-project) */}
      {shareConnection && (
        <ConnectionShareDialog
          isOpen={!!shareConnection}
          onClose={() => setShareConnection(null)}
          connectionId={shareConnection.id}
          connectionName={shareConnection.name}
          connectionType={shareConnection.type}
          currentProjectId={currentProjectId}
          availableProjects={projects}
          onRefresh={onRefresh}
        />
      )}

      {/* Transfer Organization Dialog */}
      {transferOrgConnection && (
        <ConnectionTransferOrgDialog
          isOpen={!!transferOrgConnection}
          onClose={() => setTransferOrgConnection(null)}
          connectionId={transferOrgConnection.id}
          connectionName={transferOrgConnection.name}
          connectionType={transferOrgConnection.type}
          currentOrgId={currentOrgId}
          currentOrgName={currentOrgName}
          availableOrganizations={organizations}
          onSuccess={() => {
            setTransferOrgConnection(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

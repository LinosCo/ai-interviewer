'use client';

import { useState } from 'react';
import {
  Globe, ExternalLink, RefreshCw, Zap,
  CheckCircle, Search
} from 'lucide-react';
import { CMSSuggestionCard } from './CMSSuggestionCard';
import { AnalyticsOverview } from './AnalyticsOverview';
import { SearchQueriesTable } from './SearchQueriesTable';

interface CMSVolerDashboardProps {
  connection: {
    id: string;
    name: string;
    siteUrl: string;
    status: string;
    lastSyncAt: string | null;
    gaConnected: boolean;
    searchConsoleConnected: boolean;
    cmsDashboardUrl?: string | null;
  };
  analytics: {
    pageviews: number;
    sessions?: number;
    uniqueVisitors?: number;
    bounceRate: number;
    avgSessionDuration: number;
    searchImpressions?: number;
    searchClicks?: number;
    avgPosition?: number;
    topPages: any[];
    topSearchQueries: any[];
  } | null;
  suggestions: {
    id: string;
    title: string;
    body: string;
    targetSection: string | null;
    type: string;
    status: string;
    priorityScore: number;
    reasoning: string;
    createdAt: string;
    publishedAt: string | null;
    performanceBefore: any;
    performanceAfter: any;
  }[];
  projectId: string;
}

export function CMSVolerDashboard({
  connection,
  analytics,
  suggestions,
  projectId
}: CMSVolerDashboardProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);

  const handleOpenCMS = async () => {
    if (!connection.cmsDashboardUrl) return;

    setIsOpening(true);
    try {
      const res = await fetch('/api/cms/dashboard-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate URL');
      }

      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Failed to open CMS:', error);
      alert(error.message || 'Errore apertura dashboard CMS');
    } finally {
      setIsOpening(false);
    }
  };

  const handlePushSuccess = (suggestionId: string) => {
    setLocalSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId ? { ...s, status: 'PUSHED' } : s
      )
    );
  };

  const pendingSuggestions = localSuggestions.filter(s => s.status === 'PENDING');
  const pushedSuggestions = localSuggestions.filter(s => s.status === 'PUSHED');
  const publishedSuggestions = localSuggestions.filter(s => s.status === 'PUBLISHED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{connection.name}</h1>
              <p className="text-gray-500">{connection.siteUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={connection.status} />
            {connection.cmsDashboardUrl && (
              <button
                onClick={handleOpenCMS}
                disabled={isOpening || connection.status === 'DISABLED'}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isOpening ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Apri Dashboard CMS
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        {connection.lastSyncAt && (
          <p className="text-sm text-gray-400 mt-4">
            Ultimo sync: {new Date(connection.lastSyncAt).toLocaleString('it-IT')}
          </p>
        )}
      </div>

      {/* Analytics */}
      {analytics && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Analytics</h2>
          <AnalyticsOverview
            analytics={analytics}
            gaConnected={connection.gaConnected}
            gscConnected={connection.searchConsoleConnected}
          />
        </div>
      )}

      {/* Suggerimenti */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending + Pushed */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Suggerimenti da applicare
            {(pendingSuggestions.length + pushedSuggestions.length) > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                {pendingSuggestions.length + pushedSuggestions.length}
              </span>
            )}
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {pendingSuggestions.map(s => (
              <CMSSuggestionCard
                key={s.id}
                suggestion={s}
                connectionId={connection.id}
                showPushButton
                showStatus
                onPushSuccess={() => handlePushSuccess(s.id)}
              />
            ))}
            {pushedSuggestions.map(s => (
              <CMSSuggestionCard
                key={s.id}
                suggestion={s}
                connectionId={connection.id}
                showStatus
              />
            ))}
            {pendingSuggestions.length === 0 && pushedSuggestions.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                Nessun suggerimento in attesa
              </p>
            )}
          </div>
        </div>

        {/* Published */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Pubblicati di recente
          </h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {publishedSuggestions.slice(0, 5).map(s => (
              <CMSSuggestionCard
                key={s.id}
                suggestion={s}
                connectionId={connection.id}
                showPerformance
                showStatus
              />
            ))}
            {publishedSuggestions.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                Nessun suggerimento pubblicato
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search Console Queries */}
      {connection.searchConsoleConnected && analytics?.topSearchQueries && analytics.topSearchQueries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            Top Query Search Console
          </h2>
          <SearchQueriesTable queries={analytics.topSearchQueries} />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: 'bg-emerald-100 text-emerald-700', label: 'Connesso' },
    PARTIAL: { color: 'bg-amber-100 text-amber-700', label: 'Parziale' },
    GOOGLE_ONLY: { color: 'bg-blue-100 text-blue-700', label: 'Solo Google' },
    PENDING: { color: 'bg-gray-100 text-gray-600', label: 'In attesa' },
    ERROR: { color: 'bg-red-100 text-red-700', label: 'Errore' },
    DISABLED: { color: 'bg-gray-100 text-gray-400', label: 'Disabilitato' }
  };

  const { color, label } = config[status] || config.PENDING;

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {status === 'ACTIVE' && '🟢 '}
      {status === 'PARTIAL' && '🟡 '}
      {status === 'ERROR' && '🔴 '}
      {label}
    </div>
  );
}

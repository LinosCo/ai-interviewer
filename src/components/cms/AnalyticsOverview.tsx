'use client';

import { TrendingUp, TrendingDown, Users, Eye, Clock, MousePointer } from 'lucide-react';

interface AnalyticsOverviewProps {
  analytics: {
    pageviews: number;
    sessions?: number;
    uniqueVisitors?: number;
    bounceRate: number;
    avgSessionDuration: number;
    searchImpressions?: number;
    searchClicks?: number;
    avgPosition?: number;
  };
  gaConnected: boolean;
  gscConnected: boolean;
}

export function AnalyticsOverview({
  analytics,
  gaConnected,
  gscConnected
}: AnalyticsOverviewProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Google Analytics Section */}
      {gaConnected && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Google Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<Eye className="w-5 h-5 text-blue-500" />}
              label="Pageviews"
              value={analytics.pageviews.toLocaleString()}
            />
            <MetricCard
              icon={<Users className="w-5 h-5 text-purple-500" />}
              label="Visitatori"
              value={(analytics.uniqueVisitors || analytics.sessions || 0).toLocaleString()}
            />
            <MetricCard
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              label="Durata Media"
              value={formatDuration(analytics.avgSessionDuration)}
            />
            <MetricCard
              icon={<TrendingDown className="w-5 h-5 text-red-500" />}
              label="Bounce Rate"
              value={`${(analytics.bounceRate * 100).toFixed(1)}%`}
              isBad={analytics.bounceRate > 0.6}
            />
          </div>
        </div>
      )}

      {/* Search Console Section */}
      {gscConnected && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Search Console
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<Eye className="w-5 h-5 text-blue-500" />}
              label="Impressioni"
              value={(analytics.searchImpressions || 0).toLocaleString()}
            />
            <MetricCard
              icon={<MousePointer className="w-5 h-5 text-green-500" />}
              label="Click"
              value={(analytics.searchClicks || 0).toLocaleString()}
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              label="CTR"
              value={analytics.searchImpressions && analytics.searchClicks
                ? `${((analytics.searchClicks / analytics.searchImpressions) * 100).toFixed(2)}%`
                : '-'
              }
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
              label="Posizione Media"
              value={analytics.avgPosition?.toFixed(1) || '-'}
              isGood={analytics.avgPosition !== undefined && analytics.avgPosition < 10}
            />
          </div>
        </div>
      )}

      {/* No connections message */}
      {!gaConnected && !gscConnected && (
        <div className="text-center py-8 text-gray-400">
          <p>Nessun servizio Google connesso</p>
          <p className="text-sm mt-1">Contatta il supporto per configurare Google Analytics e Search Console</p>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isGood?: boolean;
  isBad?: boolean;
}

function MetricCard({ icon, label, value, isGood, isBad }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${
        isGood ? 'text-emerald-600' : isBad ? 'text-red-600' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  );
}

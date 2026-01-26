'use client';

import { Search, TrendingUp, TrendingDown } from 'lucide-react';

interface SearchQuery {
  query: string;
  impressions: number;
  clicks: number;
  ctr?: number;
  position: number;
}

interface SearchQueriesTableProps {
  queries: SearchQuery[];
  maxItems?: number;
}

export function SearchQueriesTable({ queries, maxItems = 10 }: SearchQueriesTableProps) {
  const displayedQueries = queries.slice(0, maxItems);

  if (!displayedQueries.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nessuna query disponibile</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-3 font-medium">Query</th>
            <th className="pb-3 font-medium text-right">Impressioni</th>
            <th className="pb-3 font-medium text-right">Click</th>
            <th className="pb-3 font-medium text-right">CTR</th>
            <th className="pb-3 font-medium text-right">Posizione</th>
          </tr>
        </thead>
        <tbody>
          {displayedQueries.map((q, i) => {
            const ctr = q.ctr !== undefined
              ? q.ctr
              : q.impressions > 0
                ? q.clicks / q.impressions
                : 0;

            return (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-4">
                  <span className="font-medium text-gray-900">{q.query}</span>
                </td>
                <td className="py-3 text-right text-gray-600">
                  {q.impressions.toLocaleString()}
                </td>
                <td className="py-3 text-right text-gray-600">
                  {q.clicks.toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <span className={`${ctr > 0.05 ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {(ctr * 100).toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 text-right">
                  <PositionBadge position={q.position} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {queries.length > maxItems && (
        <p className="text-sm text-gray-400 mt-3 text-center">
          +{queries.length - maxItems} altre query
        </p>
      )}
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  const getColor = () => {
    if (position <= 3) return 'bg-emerald-100 text-emerald-700';
    if (position <= 10) return 'bg-blue-100 text-blue-700';
    if (position <= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getColor()}`}>
      {position <= 10 ? (
        <TrendingUp className="w-3 h-3" />
      ) : position > 20 ? (
        <TrendingDown className="w-3 h-3" />
      ) : null}
      {position.toFixed(1)}
    </span>
  );
}

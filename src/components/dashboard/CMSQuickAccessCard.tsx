'use client';

import { useState } from 'react';
import { Globe, ExternalLink, RefreshCw, BarChart3, FileText, Zap } from 'lucide-react';
import { showToast } from '@/components/toast';

interface CMSQuickAccessCardProps {
  projectId: string;
  connectionStatus: string;
  lastSyncAt: Date | string | null;
}

export function CMSQuickAccessCard({
  projectId,
  connectionStatus,
  lastSyncAt
}: CMSQuickAccessCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenCMS = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cms/dashboard-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to open CMS');
      }

      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isOnline = connectionStatus === 'ACTIVE' || connectionStatus === 'PARTIAL';

  return (
    <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Gestione Sito</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-300' : 'bg-amber-300'} animate-pulse`} />
                <span className="text-sm text-white/80">
                  {isOnline ? 'Connesso' : 'Verifica connessione'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/80 text-sm mb-6">
          Modifica i contenuti del tuo sito web con l'assistente AI.
          I suggerimenti vengono generati automaticamente dai dati raccolti.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-1 text-white/80" />
            <span className="text-xs text-white/70">Analytics</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-white/80" />
            <span className="text-xs text-white/70">Contenuti</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-white/80" />
            <span className="text-xs text-white/70">AI Tips</span>
          </div>
        </div>

        <button
          onClick={handleOpenCMS}
          disabled={isLoading || !isOnline}
          className="w-full bg-white text-emerald-700 font-semibold py-3 px-4 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Apri Dashboard CMS
              <ExternalLink className="w-4 h-4" />
            </>
          )}
        </button>

        {lastSyncAt && (
          <p className="text-xs text-white/60 text-center mt-3">
            Ultimo sync: {new Date(lastSyncAt).toLocaleDateString('it-IT', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}
      </div>
    </div>
  );
}

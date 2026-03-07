'use client';

import { motion } from 'framer-motion';
import { IntegrationsGrid } from './IntegrationsGrid';
import type { ComponentProps } from 'react';

type GridProps = ComponentProps<typeof IntegrationsGrid>;

interface ConnectionsTabProps extends GridProps {
  activeCount: number;
}

export function ConnectionsTab({ activeCount, ...gridProps }: ConnectionsTabProps) {
  const googleReady = Boolean(
    gridProps.googleConnection
    && (gridProps.googleConnection.ga4Status === 'ACTIVE' || gridProps.googleConnection.gscStatus === 'ACTIVE')
  );
  const publishingReady = Boolean(
    gridProps.cmsConnection?.status === 'ACTIVE'
    || gridProps.mcpConnections.some((connection) => connection.status === 'ACTIVE')
  );
  const automationReady = Boolean(gridProps.n8nConnection?.status === 'ACTIVE');

  const readinessCards = [
    {
      title: 'Data Sources',
      state: googleReady ? 'Connesso' : 'Da completare',
      health: googleReady ? 'Sano' : 'Nessun feed attivo',
      coverage: googleReady ? 'Copertura: GA/GSC disponibili' : 'Copertura: assente',
      scope: 'Scope: dedicato al progetto',
      nextAction: googleReady ? 'Azione: valida GA4 + GSC periodicamente' : 'Azione: collega Google Analytics e Search Console',
    },
    {
      title: 'Publishing Destinations',
      state: publishingReady ? 'Connesso' : 'Da completare',
      health: publishingReady ? 'Sano' : 'Nessuna destinazione attiva',
      coverage: publishingReady ? 'Copertura: WordPress/WooCommerce/CMS disponibili' : 'Copertura: assente',
      scope: 'Scope: dedicato al progetto',
      nextAction: publishingReady ? 'Azione: verifica permessi di pubblicazione' : 'Azione: configura WordPress, WooCommerce o CMS voler.ai',
    },
    {
      title: 'Automation',
      state: automationReady ? 'Connesso' : 'Da completare',
      health: automationReady ? 'Sano' : 'Automazione non attiva',
      coverage: automationReady ? 'Copertura: webhook n8n disponibile' : 'Copertura: assente',
      scope: 'Scope: dedicato al progetto',
      nextAction: automationReady ? 'Azione: abilita ricette di routing per i tip' : 'Azione: collega n8n e crea la prima ricetta',
    },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pt-6 pb-8"
    >
      {/* Active connections header */}
      {activeCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Connessioni attive
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
            {activeCount}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {readinessCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.title}</p>
            <p className={`mt-2 text-sm font-semibold ${card.state === 'Connesso' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {card.state}
            </p>
            <p className="mt-1 text-xs text-slate-600">{card.health}</p>
            <p className="mt-1 text-xs text-slate-600">{card.scope}</p>
            <p className="mt-1 text-xs text-slate-600">{card.coverage}</p>
            <p className="mt-2 text-xs font-medium text-slate-700">{card.nextAction}</p>
          </div>
        ))}
      </div>

      {/* The existing IntegrationsGrid renders all connection cards */}
      <IntegrationsGrid {...gridProps} />
    </motion.div>
  );
}

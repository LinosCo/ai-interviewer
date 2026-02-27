'use client';

import { motion } from 'framer-motion';
import { IntegrationsGrid } from './IntegrationsGrid';
import type { ComponentProps } from 'react';

type GridProps = ComponentProps<typeof IntegrationsGrid>;

interface ConnectionsTabProps extends GridProps {
  activeCount: number;
}

export function ConnectionsTab({ activeCount, ...gridProps }: ConnectionsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto space-y-6 pt-6 pb-8"
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

      {/* The existing IntegrationsGrid renders all connection cards */}
      <IntegrationsGrid {...gridProps} />
    </motion.div>
  );
}

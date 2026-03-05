'use client';

import { motion } from 'framer-motion';
import { Calendar, Sparkles, Lock, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TrustItem {
  icon: LucideIcon;
  label: string;
}

const TRUST_ITEMS: TrustItem[] = [
  { icon: Calendar, label: 'Nato da 10+ anni di esperienza in marketing strategico' },
  { icon: Sparkles, label: 'Powered by voler.ai' },
  { icon: Lock, label: 'Dati cifrati, server EU' },
  { icon: Shield, label: 'GDPR compliant' },
];

export function TrustStrip() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className="bg-[hsl(var(--secondary)/0.5)] border-y border-[hsl(var(--border))]"
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 text-sm text-[hsl(var(--muted-foreground))]">
          {TRUST_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === TRUST_ITEMS.length - 1;

            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-[hsl(var(--coral))]" />
                  {item.label}
                </span>
                {!isLast && (
                  <span className="hidden md:inline text-[hsl(var(--border))]">
                    |
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

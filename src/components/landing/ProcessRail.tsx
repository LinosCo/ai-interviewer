'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const PHASES = [
  { id: 'strumenti', label: '01 Ascolta' },
  { id: 'decidi', label: '02 Decidi' },
  { id: 'esegui', label: '03 Esegui' },
  { id: 'monitora', label: '04 Monitora' },
] as const;

type PhaseId = (typeof PHASES)[number]['id'];

export function ProcessRail() {
  const [activePhase, setActivePhase] = useState<PhaseId>('strumenti');
  const [drift, setDrift] = useState(0);

  useEffect(() => {
    const targets = PHASES
      .map((phase) => document.getElementById(phase.id))
      .filter(Boolean) as HTMLElement[];

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const next = visible[0].target.id as PhaseId;
        setActivePhase(next);
      },
      {
        threshold: [0.2, 0.4, 0.6],
        rootMargin: '-35% 0px -45% 0px',
      }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const offset = Math.sin(window.scrollY * 0.004) * 5;
      setDrift(offset);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <aside
      aria-label="Fasi del processo"
      className="hidden lg:flex fixed left-3 xl:left-5 top-1/2 -translate-y-1/2 z-[45] pointer-events-none"
    >
      <div
        className="pointer-events-auto transition-transform duration-300"
        style={{ transform: `translateY(${drift}px)` }}
      >
        <div className="rounded-[30px] border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--background)/0.9)] backdrop-blur-md px-2 py-3 shadow-strong">
          <div className="flex flex-col gap-2">
            {PHASES.map((phase) => {
              const isActive = activePhase === phase.id;

              return (
                <motion.a
                  key={phase.id}
                  href={`#${phase.id}`}
                  animate={isActive ? { scale: 1.03, x: 0 } : { scale: 1, x: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`relative rounded-full border px-2 py-4 [writing-mode:vertical-rl] text-xs font-semibold tracking-[0.16em] transition-colors ${
                    isActive
                      ? 'border-[hsl(var(--coral)/0.45)] bg-[hsl(var(--coral)/0.14)] text-[hsl(var(--coral))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/0.9)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {phase.label}
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

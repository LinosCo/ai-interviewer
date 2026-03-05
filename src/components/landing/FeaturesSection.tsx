'use client';

import { motion } from 'framer-motion';
import { FeaturesTabs } from './FeaturesTabs';

export function FeaturesSection(): React.JSX.Element {
  return (
    <section id="strumenti" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
      <div className="absolute inset-0 bg-white/86 backdrop-blur-[2px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Tutto quello che ti serve,{' '}
            <span className="gradient-text">in un&apos;unica piattaforma</span>
          </h2>
        </motion.div>

        <FeaturesTabs />
      </div>
    </section>
  );
}

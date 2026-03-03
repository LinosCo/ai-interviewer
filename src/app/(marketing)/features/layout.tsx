import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Funzionalita della Piattaforma',
  description:
    'Scopri tutte le funzionalita di Business Tuner: interviste AI, chatbot, brand monitoring, Copilot strategico, automazioni e governance multi-progetto.',
  path: '/features',
  keywords: [
    'funzionalita business tuner',
    'copilot strategico marketing',
    'stakeholder listening software',
  ],
});

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

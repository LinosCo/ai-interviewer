import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Prezzi e Piani',
  description:
    'Confronta piani e crediti di Business Tuner. Scegli il livello giusto per PMI, team marketing, agenzie e consulenti.',
  path: '/pricing',
  keywords: [
    'prezzi business tuner',
    'piani ai marketing intelligence',
    'crediti ai per team marketing',
  ],
});

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

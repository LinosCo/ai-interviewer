import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Programma Partner per Agenzie e Consulenti',
  description:
    'Modello partner per agenzie, consulenti strategici e business advisor: ascolto stakeholder, Copilot decisionale e operativita tracciabile per clienti PMI e corporate.',
  path: '/partner',
  keywords: [
    'programma partner agenzie',
    'piattaforma per consulenti strategici',
    'strumento multi cliente',
    'white label marketing intelligence',
  ],
});

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

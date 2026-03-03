import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'FAQ',
  description:
    'Domande frequenti su Business Tuner: valore, adozione, crediti, sicurezza, piani e utilizzo per PMI, agenzie e consulenti.',
  path: '/faq',
  keywords: [
    'faq business tuner',
    'domande frequenti ai marketing intelligence',
    'supporto piani e crediti',
  ],
});

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

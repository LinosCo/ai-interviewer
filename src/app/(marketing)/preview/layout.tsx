import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Preview',
  description: 'Preview interno di Business Tuner.',
  path: '/preview',
  noIndex: true,
});

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

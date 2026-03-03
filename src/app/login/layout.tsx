import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Login',
  description: 'Accesso riservato Business Tuner.',
  path: '/login',
  noIndex: true,
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

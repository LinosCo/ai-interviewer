import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Recupero Password',
  description: 'Pagina di recupero password Business Tuner.',
  path: '/forgot-password',
  noIndex: true,
});

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

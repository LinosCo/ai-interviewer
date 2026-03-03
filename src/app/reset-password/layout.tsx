import type { Metadata } from 'next';
import { buildMarketingMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Reset Password',
  description: 'Pagina di reset password Business Tuner.',
  path: '/reset-password',
  noIndex: true,
});

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

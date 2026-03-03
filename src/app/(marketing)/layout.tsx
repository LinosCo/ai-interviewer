import { auth } from '@/auth';
import { LandingHeader, LandingFooter } from '@/components/landing';
import type { Metadata } from 'next';
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: {
    default: HOME_PAGE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_PAGE_DESCRIPTION,
};

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader session={session} />

      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}

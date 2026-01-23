import { auth } from '@/auth';
import { LandingHeader, LandingFooter } from '@/components/landing';

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

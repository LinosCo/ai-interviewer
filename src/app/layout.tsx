import type { Metadata } from 'next';
import './globals.css';
import { ToastContainer } from '@/components/toast';
import { Providers } from '@/components/Providers';
import { AnalyticsGate } from '@/components/AnalyticsGate';
import { auth } from '@/auth';
import { CookieConsent } from '@/components/CookieConsent';
import {
  BRAND_KEYWORDS,
  DEFAULT_LOCALE,
  DEFAULT_OG_IMAGE_URL,
  DEFAULT_TWITTER_IMAGE_URL,
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
  SITE_NAME,
  SITE_TWITTER_HANDLE,
  SITE_URL,
} from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_PAGE_DESCRIPTION,
  keywords: BRAND_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: DEFAULT_LOCALE,
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
    description: HOME_PAGE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
    description: HOME_PAGE_DESCRIPTION,
    creator: SITE_TWITTER_HANDLE,
    site: SITE_TWITTER_HANDLE,
    images: [DEFAULT_TWITTER_IMAGE_URL],
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
    apple: [{ url: '/icon.svg' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="it" className="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="antialiased">
        <Providers session={session}>
          {children}
          <ToastContainer />
          <CookieConsent />
        </Providers>
        <AnalyticsGate />
      </body>
    </html>
  );
}

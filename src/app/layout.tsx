import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/toast";
import { Providers } from "@/components/Providers";
import { AnalyticsGate } from "@/components/AnalyticsGate";
import { auth } from "@/auth";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.it';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Business Tuner - Ascolta il mercato. Decidi meglio.",
    template: "%s | Business Tuner",
  },
  description: "Raccogli feedback qualitativi da clienti, dipendenti e stakeholder con interviste AI. Senza consulenti, senza sondaggi ignorati.",
  keywords: [
    "interviste AI",
    "feedback clienti",
    "ricerca qualitativa",
    "customer research",
    "user research",
    "feedback stakeholder",
    "intelligenza artificiale",
    "business intelligence",
    "analisi mercato",
  ],
  authors: [{ name: "Business Tuner" }],
  creator: "Business Tuner",
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteUrl,
    siteName: "Business Tuner",
    title: "Business Tuner - Ascolta il mercato. Decidi meglio.",
    description: "Raccogli feedback qualitativi da clienti, dipendenti e stakeholder con interviste AI. Senza consulenti, senza sondaggi ignorati.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Business Tuner - Ascolta il mercato. Decidi meglio.",
    description: "Interviste AI per raccogliere feedback qualitativi da clienti e stakeholder.",
    creator: "@businesstuner",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

import { CookieConsent } from "@/components/CookieConsent";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // === BT-DEBUG START ===
  console.log('[BT-DEBUG][RootLayout] session:', session ? { userId: session.user?.id } : null);
  // === BT-DEBUG END ===

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

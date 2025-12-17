import type { Metadata } from "next";

export const siteConfig = {
  name: "Business Tuner",
  description: "Raccogli feedback qualitativi da clienti, dipendenti e stakeholder con interviste AI. Senza consulenti, senza sondaggi ignorati.",
  url: "https://businesstuner.it",
  ogImage: "/og-image.png",
  links: {
    email: "info@businesstuner.it",
  },
};

export const defaultMetadata: Metadata = {
  title: {
    default: `${siteConfig.name} - Ascolta il mercato. Decidi meglio.`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "feedback clienti",
    "interviste qualitative",
    "ricerca di mercato",
    "customer feedback",
    "employee feedback",
    "exit interview",
    "NPS qualitativo",
    "voice of customer",
    "AI interviste",
    "sondaggi intelligenti",
  ],
  authors: [{ name: "Business Tuner" }],
  creator: "Business Tuner",
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
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

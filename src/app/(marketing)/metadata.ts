import type { Metadata } from "next";

export const siteConfig = {
  name: "Business Tuner",
  description: "Raccogli segnali da clienti, team e mercato. Decidi con il Copilot AI. Esegui con automazioni. Monitora l'impatto. Una piattaforma, un ciclo continuo.",
  url: "https://businesstuner.voler.ai",
  links: {
    email: "businesstuner@voler.ai",
  },
};

export const defaultMetadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Il ciclo strategico AI per PMI e consulenti`,
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
    "copilot strategico",
    "brand monitoring",
    "automazioni marketing",
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
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
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

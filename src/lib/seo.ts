import type { Metadata } from 'next';

export const SITE_NAME = 'Business Tuner';
export const SITE_URL =
  (process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.it').replace(/\/+$/, '');
export const SITE_TWITTER_HANDLE = '@businesstuner';
export const DEFAULT_LOCALE = 'it_IT';

export const BRAND_KEYWORDS: string[] = [
  'ciclo strategico ai',
  'interviste qualitative ai',
  'feedback clienti',
  'brand monitoring',
  'copilot strategico',
  'automazioni marketing',
  'business intelligence pmi',
  'strumento per agenzie',
  'tool per consulenti strategici',
  'business tuner',
];

export const HOME_PAGE_TITLE =
  'Il ciclo strategico AI per PMI e consulenti';
export const HOME_PAGE_DESCRIPTION =
  'Raccogli segnali da clienti, team e mercato. Decidi con il Copilot AI. Esegui con automazioni. Monitora l\'impatto. Una piattaforma, un ciclo continuo.';

export function absoluteUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
}

export const DEFAULT_OG_IMAGE_URL = absoluteUrl('/opengraph-image');
export const DEFAULT_TWITTER_IMAGE_URL = absoluteUrl('/twitter-image');

type MarketingMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildMarketingMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
}: MarketingMetadataOptions): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title,
    description,
    keywords: [...BRAND_KEYWORDS, ...keywords],
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: DEFAULT_LOCALE,
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: DEFAULT_OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - ${title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE_TWITTER_HANDLE,
      creator: SITE_TWITTER_HANDLE,
      title,
      description,
      images: [DEFAULT_TWITTER_IMAGE_URL],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        }
      : {
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
}

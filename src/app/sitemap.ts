import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

type StaticPage = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const STATIC_MARKETING_PAGES: StaticPage[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/partner', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/templates', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/methodology', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/sales', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/cookie-policy', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/dpa', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/sla', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/sales-terms', changeFrequency: 'yearly', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return STATIC_MARKETING_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

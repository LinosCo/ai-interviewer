import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/w/',
          '/i/',
          '/t/',
          '/claim/',
          '/transfer/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`],
    host: SITE_URL,
  };
}

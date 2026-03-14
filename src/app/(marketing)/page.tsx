import { MarketingHomeClient } from '@/components/landing';
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE, SITE_NAME, SITE_URL } from '@/lib/seo';
import { getLandingArticles, getLandingFaqs } from '@/lib/business-tuner-content';

// Skip static generation — DB is not available during Docker builds.
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [faqs, articles] = await Promise.all([
    getLandingFaqs(),
    getLandingArticles(6),
  ]);

  const homepageJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/logo.png`,
        },
        sameAs: ['https://www.linkedin.com/company/business-tuner'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: 'it-IT',
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
        description: HOME_PAGE_DESCRIPTION,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'it-IT',
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: faqs.slice(0, 10).map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      ...(articles.length > 0
        ? [
            {
              '@type': 'Blog',
              '@id': `${SITE_URL}/insights#blog`,
              url: `${SITE_URL}/insights`,
              name: `${SITE_NAME} Insights`,
              description: 'Approfondimenti, FAQ e contenuti pubblicati dal CMS di Business Tuner.',
              blogPost: articles.map((article) => ({
                '@type': 'BlogPosting',
                headline: article.title,
                url: article.url.startsWith('http') ? article.url : `${SITE_URL}/insights/${article.slug}`,
                datePublished: article.publishedAt,
                dateModified: article.updatedAt,
                description: article.metaDescription || article.excerpt,
                author: {
                  '@type': 'Organization',
                  name: SITE_NAME,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        id="home-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
      />
      <MarketingHomeClient faqs={faqs} />
    </>
  );
}

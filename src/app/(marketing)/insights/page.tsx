import Link from 'next/link';
import { buildMarketingMetadata, SITE_NAME, SITE_URL } from '@/lib/seo';
import { getLandingArticles } from '@/lib/business-tuner-content';

// Skip static generation — DB is not available during Docker builds.
export const dynamic = 'force-dynamic';

export const metadata = buildMarketingMetadata({
  title: 'Insights e contenuti',
  description: 'Approfondimenti, aggiornamenti e contenuti SEO pubblicati dal CMS di Business Tuner.',
  path: '/insights',
  keywords: ['blog business tuner', 'insights ai', 'contenuti seo'],
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default async function InsightsPage() {
  const articles = await getLandingArticles(24);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/insights#blog`,
    url: `${SITE_URL}/insights`,
    name: `${SITE_NAME} Insights`,
    description: 'Approfondimenti e contenuti pubblicati dal CMS interno di Business Tuner.',
    blogPost: articles.map((article) => ({
      '@type': 'BlogPosting',
      headline: article.title,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      description: article.metaDescription || article.excerpt,
      url: `${SITE_URL}/insights/${article.slug}`,
      author: { '@type': 'Organization', name: SITE_NAME },
    })),
  };

  return (
    <div className="relative overflow-hidden bg-white">
      <script
        id="insights-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative border-b border-stone-200 bg-gradient-to-b from-stone-50 to-white pt-24 pb-16 md:pt-32">
        <div className="max-w-5xl mx-auto px-6">
          <p className="mb-4 text-sm uppercase tracking-[0.18em] text-[hsl(var(--coral))]">Insights</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-[hsl(var(--foreground))] max-w-4xl">
            Contenuti pubblicati dal CMS di Business Tuner
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
            Articoli, aggiornamenti e contenuti SEO che il progetto puo pubblicare e usare direttamente sulla propria landing.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          {articles.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-[hsl(var(--muted-foreground))]">
              Nessun articolo pubblicato dal CMS al momento.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="mb-3 text-xs uppercase tracking-[0.16em] text-[hsl(var(--coral))]">
                    {formatDate(article.publishedAt)}
                  </p>
                  <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    <Link href={`/insights/${article.slug}`} className="hover:text-[hsl(var(--coral))]">
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-4 text-[hsl(var(--muted-foreground))] leading-relaxed">
                    {article.metaDescription || article.excerpt}
                  </p>
                  <div className="mt-6">
                    <Link
                      href={`/insights/${article.slug}`}
                      className="inline-flex items-center text-sm font-semibold text-[hsl(var(--coral))]"
                    >
                      Leggi l&apos;articolo
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

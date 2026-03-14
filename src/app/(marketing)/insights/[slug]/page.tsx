import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { getLandingArticleBySlug, getLandingArticles } from '@/lib/business-tuner-content';

type Params = {
  slug: string;
};

export async function generateStaticParams() {
  const articles = await getLandingArticles(50);
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getLandingArticleBySlug(slug);

  if (!article) {
    return {};
  }

  const canonical = `${SITE_URL}/insights/${article.slug}`;
  return {
    title: article.title,
    description: article.metaDescription || article.excerpt,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      title: article.title,
      description: article.metaDescription || article.excerpt,
      siteName: SITE_NAME,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.metaDescription || article.excerpt,
    },
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = await getLandingArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const canonical = `${SITE_URL}/insights/${article.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    description: article.metaDescription || article.excerpt,
    url: canonical,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: canonical,
  };

  return (
    <div className="bg-white">
      <script
        id="insight-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <Link href="/insights" className="text-sm font-semibold text-[hsl(var(--coral))]">
          Torna agli insights
        </Link>

        <header className="mt-6 border-b border-stone-200 pb-8">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--coral))]">
            {formatDate(article.publishedAt)}
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-[hsl(var(--foreground))]">
            {article.title}
          </h1>
          <p className="mt-5 text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">
            {article.metaDescription || article.excerpt}
          </p>
        </header>

        <div className="prose prose-stone max-w-none prose-headings:font-display prose-headings:text-[hsl(var(--foreground))] prose-p:text-[hsl(var(--muted-foreground))] prose-li:text-[hsl(var(--muted-foreground))] prose-a:text-[hsl(var(--coral))] mt-10">
          <ReactMarkdown>{article.body}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

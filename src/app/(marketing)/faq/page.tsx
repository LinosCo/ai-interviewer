import { FluidBackground } from '@/components/landing/FluidBackground';
import { SITE_URL } from '@/lib/seo';
import { getLandingFaqs } from '@/lib/business-tuner-content';

export default async function FAQPage() {
  const faqs = await getLandingFaqs();

  const faqPageJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/faq#faq`,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/faq#webpage`,
        url: `${SITE_URL}/faq`,
        name: 'FAQ | Business Tuner',
        description: 'Domande frequenti su Business Tuner, casi d’uso, integrazioni e adozione operativa.',
        inLanguage: 'it-IT',
      },
    ],
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <script
        id="faq-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />
      <FluidBackground />

      <main className="relative">
        <section className="pt-24 pb-12 md:pt-32 md:pb-16 relative">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Domande <span className="gradient-text">Frequenti</span>
            </h1>
            <p className="text-xl text-[hsl(var(--muted-foreground))]">
              FAQ aggiornate dalla knowledge base e dal CMS di Business Tuner
            </p>
          </div>
        </section>

        <div className="h-24 section-fade-from-transparent" />

        <section className="pb-24 relative">
          <div className="absolute inset-0 bg-white/85" />
          <div className="max-w-3xl mx-auto px-6 relative z-10">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <article
                  key={`${faq.slug}-${index}`}
                  className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <h2 className="text-lg font-bold mb-2 text-[hsl(var(--foreground))]">
                    {faq.question}
                  </h2>
                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="h-24 section-fade-to-transparent" />
      </main>
    </div>
  );
}

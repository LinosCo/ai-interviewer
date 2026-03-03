import type { Metadata } from 'next';
import Script from 'next/script';
import {
  FluidBackground,
  HeroSection,
  ProblemSection,
  FeaturesSection,
  AITipsSection,
  NewsSection,
  HowItWorks,
  WhySection,
  UseCasesSection,
  TrainingBotSection,
  AutomationSection,
  PricingSection,
  FAQSection,
  CTASection,
} from '@/components/landing';
import { LANDING_FAQS } from '@/components/landing/landing-faq-data';
import {
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  buildMarketingMetadata,
} from '@/lib/seo';

const CHATBOT_BOT_ID = 'cmkfq2fuq0001q5yy3wnk6yvq';

export const metadata: Metadata = buildMarketingMetadata({
  title: HOME_PAGE_TITLE,
  description: HOME_PAGE_DESCRIPTION,
  path: '/',
  keywords: [
    'ai marketing intelligence operativa',
    'interviste ai',
    'chatbot ai per sito',
    'monitoraggio reputazione online',
    'copilot marketing',
  ],
});

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${absoluteUrl('/')}#organization`,
      name: SITE_NAME,
      url: absoluteUrl('/'),
      logo: absoluteUrl('/opengraph-image'),
      description: HOME_PAGE_DESCRIPTION,
      areaServed: 'IT',
    },
    {
      '@type': 'WebSite',
      '@id': `${absoluteUrl('/')}#website`,
      url: absoluteUrl('/'),
      name: SITE_NAME,
      inLanguage: 'it-IT',
      publisher: { '@id': `${absoluteUrl('/')}#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${absoluteUrl('/')}#software`,
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: absoluteUrl('/'),
      description: HOME_PAGE_DESCRIPTION,
      offers: {
        '@type': 'Offer',
        url: absoluteUrl('/pricing'),
        availability: 'https://schema.org/InStock',
      },
      creator: { '@id': `${absoluteUrl('/')}#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${absoluteUrl('/')}#faq`,
      mainEntity: LANDING_FAQS.map((faq) => ({
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
      '@id': `${absoluteUrl('/')}#webpage`,
      url: absoluteUrl('/'),
      name: `${SITE_NAME} - ${HOME_PAGE_TITLE}`,
      description: HOME_PAGE_DESCRIPTION,
      isPartOf: { '@id': `${absoluteUrl('/')}#website` },
      about: { '@id': `${absoluteUrl('/')}#software` },
      inLanguage: 'it-IT',
    },
  ],
};

export default function LandingPage() {
  const chatbotScriptSrc = `${SITE_URL}/embed/chatbot.js`;

  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <script
        id="landing-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      <FluidBackground />
      <main className="relative">
        {/* Hero Section */}
        <HeroSection />

        {/* Transition: Hero -> Problem (white background) */}
        <div className="h-32 section-fade-from-transparent" />

        {/* Problem Section (white background) */}
        <ProblemSection />

        {/* Transition: Problem (white) -> Features (white) - no transition needed */}
        <FeaturesSection />

        {/* Transition: Features (white) -> AITips (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <AITipsSection />

        {/* Transition: AITips (transparent) -> News (white) */}
        <div className="h-24 section-fade-from-transparent" />
        <NewsSection />

        {/* Transition: News (white) -> HowItWorks (white) */}
        <div className="h-16 bg-white" />
        <HowItWorks />

        {/* Transition: HowItWorks (white) -> Why (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <WhySection />

        {/* Transition: Why (transparent) -> UseCases (white-ish) */}
        <div className="h-24 section-fade-from-transparent" />
        <UseCasesSection />

        {/* Transition: UseCases -> Training (white) */}
        <TrainingBotSection />

        {/* Transition: Training -> Automation (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <AutomationSection />

        {/* Transition: Automation -> Pricing (white) */}
        <div className="h-24 section-fade-from-transparent" />
        <PricingSection />
        <FAQSection />

        {/* Transition: FAQ (white) -> CTA (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <CTASection />
      </main>

      <Script
        id="landing-chatbot-script"
        src={chatbotScriptSrc}
        strategy="afterInteractive"
        data-bot-id={CHATBOT_BOT_ID}
        data-domain={SITE_URL}
        data-force-consent="true"
      />
    </div>
  );
}

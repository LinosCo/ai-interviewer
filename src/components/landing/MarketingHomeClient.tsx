'use client';

import {
  FluidBackground,
  HeroSection,
  TrustStrip,
  ProblemSection,
  HowItWorks,
  FeaturesSection,
  TargetSection,
  WhySection,
  PricingSection,
  FAQSection,
  CTASection,
  NewsSection,
} from '@/components/landing';
import { useEffect } from 'react';

const CHATBOT_BOT_ID = 'cmkfq2fuq0001q5yy3wnk6yvq';

type MarketingHomeClientProps = {
  faqs: Array<{ question: string; answer: string }>;
};

function LandingChatbotScript() {
  useEffect(() => {
    const configuredBase = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const scriptBase =
      configuredBase ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const chatbotScriptSrc = `${scriptBase}/embed/chatbot.js`;

    const existing = document.querySelector(`script[src="${chatbotScriptSrc}"][data-bot-id="${CHATBOT_BOT_ID}"]`);
    if (existing) return;

    const script = document.createElement('script');
    script.src = chatbotScriptSrc;
    script.defer = true;
    script.setAttribute('data-bot-id', CHATBOT_BOT_ID);
    script.setAttribute('data-domain', scriptBase);
    script.setAttribute('data-force-consent', 'true');
    document.body.appendChild(script);

    return () => {
      script.remove();
      document
        .querySelectorAll(`iframe[src*="${scriptBase}"], script[src="${chatbotScriptSrc}"]`)
        .forEach((el) => el.remove());
    };
  }, []);

  return null;
}

export function MarketingHomeClient({ faqs }: MarketingHomeClientProps) {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <FluidBackground />
      <main className="relative">
        <HeroSection />
        <TrustStrip />
        <ProblemSection />
        <div className="h-16 section-fade-from-transparent" />
        <HowItWorks />
        <div className="h-16 section-fade-to-transparent" />
        <FeaturesSection />
        <div className="h-16 section-fade-from-transparent" />
        <TargetSection />
        <div className="h-16 section-fade-to-transparent" />
        <WhySection />
        <div className="h-16 section-fade-from-transparent" />
        <NewsSection />
        <div className="h-16 section-fade-to-transparent" />
        <PricingSection />
        <div className="h-16 section-fade-from-transparent" />
        <FAQSection faqs={faqs} />
        <div className="h-16 section-fade-from-transparent" />
        <CTASection />
      </main>
      <LandingChatbotScript />
    </div>
  );
}

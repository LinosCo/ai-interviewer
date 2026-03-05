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
} from '@/components/landing';
import { useEffect } from 'react';

const CHATBOT_BOT_ID = 'cmkfq2fuq0001q5yy3wnk6yvq';

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
      // Best-effort cleanup if widget injected DOM nodes/iframes
      document.querySelectorAll(`iframe[src*="${scriptBase}"], script[src="${chatbotScriptSrc}"]`).forEach((el) => el.remove());
    };
  }, []);

  return null;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <FluidBackground />
      <main className="relative">
        {/* 1. Hero (colored) */}
        <HeroSection />

        {/* 2. Trust Strip */}
        <TrustStrip />

        {/* 3. Il Problema */}
        <ProblemSection />

        {/* 4. Il Ciclo in Azione (slider multi-scenario) */}
        <HowItWorks />

        {/* 5. Gli Strumenti (tab-based) */}
        <FeaturesSection />

        {/* 6. Per Chi */}
        <TargetSection />

        {/* 7. Perché BT */}
        <WhySection />

        {/* 8. Pricing */}
        <PricingSection />

        {/* 9. FAQ + CTA Finale */}
        <FAQSection />
        <CTASection />
      </main>
      <LandingChatbotScript />
    </div>
  );
}

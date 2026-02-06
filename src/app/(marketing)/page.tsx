'use client';

import {
  FluidBackground,
  HeroSection,
  ProblemSection,
  FeaturesSection,
  AITipsSection,
  HowItWorks,
  WhySection,
  UseCasesSection,
  PricingSection,
  FAQSection,
  CTASection,
} from '@/components/landing';
import { useEffect } from 'react';

const CHATBOT_SCRIPT_SRC = 'https://businesstuner.voler.ai/embed/chatbot.js';
const CHATBOT_BOT_ID = 'cmkfq2fuq0001q5yy3wnk6yvq';

function LandingChatbotScript() {
  useEffect(() => {
    const existing = document.querySelector(`script[src="${CHATBOT_SCRIPT_SRC}"][data-bot-id="${CHATBOT_BOT_ID}"]`);
    if (existing) return;

    const script = document.createElement('script');
    script.src = CHATBOT_SCRIPT_SRC;
    script.defer = true;
    script.setAttribute('data-bot-id', CHATBOT_BOT_ID);
    document.body.appendChild(script);

    return () => {
      script.remove();
      // Best-effort cleanup if widget injected DOM nodes/iframes
      document.querySelectorAll(`iframe[src*="businesstuner.voler.ai"], script[src="${CHATBOT_SCRIPT_SRC}"]`).forEach((el) => el.remove());
    };
  }, []);

  return null;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden relative">
      <FluidBackground />
      <main className="relative">
        {/* Hero Section */}
        <HeroSection />

        {/* Transition: Hero → Problem (white background) */}
        <div className="h-32 section-fade-from-transparent" />

        {/* Problem Section (white background) */}
        <ProblemSection />

        {/* Transition: Problem (white) → Features (white) - no transition needed */}
        <FeaturesSection />

        {/* Transition: Features (white) → AITips (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <AITipsSection />

        {/* Transition: AITips (transparent) → HowItWorks (white) */}
        <div className="h-24 section-fade-from-transparent" />
        <HowItWorks />

        {/* Transition: HowItWorks (white) → Why (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <WhySection />

        {/* Transition: Why (transparent) → UseCases (white-ish) */}
        <div className="h-24 section-fade-from-transparent" />
        <UseCasesSection />

        {/* Transition: UseCases → Pricing (white) */}
        <PricingSection />
        <FAQSection />

        {/* Transition: FAQ (white) → CTA (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <CTASection />
      </main>
      <LandingChatbotScript />
    </div>
  );
}

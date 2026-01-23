'use client';

import {
  FluidBackground,
  HeroSection,
  ProblemSection,
  FeaturesSection,
  AITipsSection,
  HowItWorks,
  WhySection,
  PricingSection,
  FAQSection,
  CTASection,
} from '@/components/landing';

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

        {/* Transition: Why (transparent) → Pricing (white) */}
        <div className="h-24 section-fade-from-transparent" />
        <PricingSection />
        <FAQSection />

        {/* Transition: FAQ (white) → CTA (transparent) */}
        <div className="h-24 section-fade-to-transparent" />
        <CTASection />
      </main>
    </div>
  );
}

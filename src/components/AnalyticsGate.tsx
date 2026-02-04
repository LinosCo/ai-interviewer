'use client';

import { useEffect, useState } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';

type ConsentState = 'accepted' | 'declined' | null;

export function AnalyticsGate() {
  const [consent, setConsent] = useState<ConsentState>(null);

  useEffect(() => {
    const readConsent = () => {
      const value = localStorage.getItem('cookie-consent');
      if (value === 'accepted' || value === 'declined') {
        setConsent(value);
      } else {
        setConsent(null);
      }
    };

    readConsent();
    const onStorage = () => readConsent();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (consent !== 'accepted') return null;
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-YFHBW5N28B"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-YFHBW5N28B');`}
      </Script>
      <SpeedInsights />
    </>
  );
}

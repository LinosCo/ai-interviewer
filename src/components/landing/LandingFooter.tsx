'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Icons } from '@/components/ui/business-tuner/Icons';

const productLinks = [
  { label: 'Come funziona', href: '#come-funziona' },
  { label: 'Strumenti', href: '#strumenti' },
  { label: 'Per chi', href: '#per-chi' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const companyLinks = [
  { label: 'Chi siamo', href: 'https://voler.ai', external: true },
  { label: 'Programma Partner', href: '/partner', external: false },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'GDPR', href: '/dpa' },
];

const socialLinks = [
  { icon: Mail, href: 'mailto:info@voler.ai', label: 'Email' },
];

function VolerLogo(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 420 84"
      className="h-8 w-auto"
      role="img"
      aria-label="VOLER.AI"
    >
      <text
        x="0"
        y="62"
        fill="currentColor"
        fontFamily="Arial Black, Arial, sans-serif"
        fontSize="64"
        letterSpacing="2"
      >
        VOLER.AI
      </text>
    </svg>
  );
}

export function LandingFooter() {
  return (
    <footer className="bg-[hsl(0_0%_6%)] text-white/90 py-16 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[150px] bg-gradient-to-b from-[hsl(var(--coral)/0.05)] to-transparent blur-3xl" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Icons.Logo size={32} />
              <span className="font-display font-bold text-xl">Business Tuner</span>
            </Link>

            <p className="text-white/60 mb-6 max-w-sm">
              La piattaforma AI per ascoltare segnali, decidere meglio ed eseguire
              con continuita.
            </p>

            <a
              href="https://voler.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-white/70 hover:text-white transition-colors mb-6"
              aria-label="Vai a voler.ai"
            >
              <VolerLogo />
            </a>

            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Prodotto</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Azienda</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-white/60 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legale</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Business Tuner. Tutti i diritti riservati.
          </p>
          <a
            href="https://voler.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            Chi siamo: voler.ai
          </a>
        </div>
      </div>
    </footer>
  );
}

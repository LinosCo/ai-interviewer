'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Icons } from '@/components/ui/business-tuner/Icons';

const productLinks = [
  { label: 'Come funziona', href: '/#come-funziona' },
  { label: 'Strumenti', href: '/#strumenti' },
  { label: 'Insights', href: '/insights' },
  { label: 'Per chi', href: '/#per-chi' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/faq' },
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

export function LandingFooter() {
  return (
    <footer className="relative overflow-hidden bg-[hsl(0_0%_6%)] py-14 text-white/90 md:py-16">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[150px] bg-gradient-to-b from-[hsl(var(--coral)/0.05)] to-transparent blur-3xl" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <div className="max-w-md">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Icons.Logo size={32} />
              <span className="font-display font-bold text-xl">Business Tuner</span>
            </Link>

            <p className="mb-6 max-w-sm text-white/60">
              La piattaforma AI per ascoltare segnali, decidere meglio ed eseguire
              con continuita.
            </p>

            <a
              href="https://voler.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06]"
              aria-label="Vai a voler.ai"
            >
              <Image
                src="/volerai-logo.png"
                alt="Voler.ai"
                className="h-8 w-auto brightness-0 invert"
                width={580}
                height={207}
              />
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

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:pl-8">
            <div>
              <h4 className="mb-4 font-semibold">Prodotto</h4>
              <ul className="space-y-3">
                {productLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/60 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Azienda</h4>
              <ul className="space-y-3">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/60 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-white/60 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h4 className="mb-4 font-semibold">Legale</h4>
              <ul className="space-y-3">
                {legalLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/60 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-left md:flex-row md:items-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Business Tuner. Tutti i diritti riservati.
          </p>
          <a
            href="https://voler.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/50 transition-colors hover:text-white/80"
          >
            Chi siamo: voler.ai
          </a>
        </div>
      </div>
    </footer>
  );
}

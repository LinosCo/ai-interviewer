'use client';

import Link from 'next/link';
import { Linkedin, Twitter, Instagram, Mail } from 'lucide-react';
import { Icons } from '@/components/ui/business-tuner/Icons';

const footerLinks = {
  prodotto: [
    { label: 'Funzionalità', href: '#strumenti' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Changelog', href: '#' },
  ],
  azienda: [
    { label: 'Chi siamo', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Carriere', href: '#' },
    { label: 'Contatti', href: '/contact' },
  ],
  legale: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'GDPR', href: '/dpa' },
  ],
};

const socialLinks = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Mail, href: 'mailto:info@businesstuner.it', label: 'Email' },
];

export function LandingFooter() {
  return (
    <footer className="bg-[hsl(0_0%_6%)] text-white/90 py-16 relative overflow-hidden">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[150px] bg-gradient-to-b from-[hsl(var(--coral)/0.05)] to-transparent blur-3xl" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Icons.Logo size={32} />
              <span className="font-display font-bold text-xl">
                Business Tuner
              </span>
            </Link>
            <p className="text-white/60 mb-6 max-w-sm">
              La piattaforma di marketing e business intelligence nativa AI per
              le imprese italiane.
            </p>
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

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Prodotto</h4>
            <ul className="space-y-3">
              {footerLinks.prodotto.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Azienda</h4>
            <ul className="space-y-3">
              {footerLinks.azienda.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legale</h4>
            <ul className="space-y-3">
              {footerLinks.legale.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Business Tuner. Tutti i diritti riservati.
          </p>
          <p className="text-sm text-white/50">
            Made with love in Italia
          </p>
        </div>
      </div>
    </footer>
  );
}

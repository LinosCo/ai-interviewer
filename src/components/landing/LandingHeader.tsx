'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/business-tuner/Icons';

const navLinks = [
  { label: 'Strumenti', href: '#strumenti' },
  { label: 'Come funziona', href: '#come-funziona' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Diventa Partner', href: '/partner' },
  { label: 'FAQ', href: '#faq' },
];

interface LandingHeaderProps {
  session: any;
}

export function LandingHeader({ session }: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'py-3 glass border-b border-[hsl(var(--border)/0.5)]'
          : 'py-5 bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Icons.Logo size={32} />
          <span className="font-display font-bold text-xl text-[hsl(var(--foreground))]">
            Business Tuner
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors font-medium"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors font-medium"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors font-medium"
            >
              Accedi
            </Link>
          )}
          <Link
            href={session ? '/dashboard' : '/onboarding/preview'}
            className="gradient-bg shadow-glow font-medium text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            {session ? 'Vai alla console' : 'Prova Gratis'}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-[hsl(var(--foreground))]"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]"
          >
            <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-[hsl(var(--border))]">
                <Link
                  href={session ? '/dashboard' : '/login'}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] font-medium py-2 text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {session ? 'Dashboard' : 'Accedi'}
                </Link>
                <Link
                  href={session ? '/dashboard' : '/onboarding/preview'}
                  className="gradient-bg shadow-glow text-white font-medium py-3 rounded-xl text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {session ? 'Vai alla console' : 'Prova Gratis'}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

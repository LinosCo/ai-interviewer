'use client';

import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Change state if scrolled more than 50px
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
                    ? 'bg-stone-900/90 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] py-3'
                    : 'bg-transparent py-6'
                }`}
        >
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem' }}>
                {/* Logo */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                        <defs>
                            <linearGradient id="btLogoGradientHeader" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#D97706" />
                                <stop offset="50%" stopColor="#F59E0B" />
                                <stop offset="100%" stopColor="#FBBF24" />
                            </linearGradient>
                        </defs>
                        <rect width="48" height="48" rx="14" fill="url(#btLogoGradientHeader)" />
                        <g fill="white" opacity="0.9">
                            <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
                            <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
                            <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
                            <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
                            <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
                        </g>
                        <path
                            d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        <circle cx="31.5" cy="16" r="3" fill="white" />
                    </svg>
                    <span className="font-bold text-xl text-white">Business Tuner</span>
                </Link>

                {/* Navigation (Hidden on Mobile) */}
                <nav className="hidden lg:flex items-center gap-8">
                    <Link href="/#how-it-works" className="text-sm font-medium text-stone-300 hover:text-white transition-colors">
                        Come funziona
                    </Link>
                    <Link href="/#use-cases" className="text-sm font-medium text-stone-300 hover:text-white transition-colors">
                        Casi d'uso
                    </Link>
                    <Link href="/#pricing" className="text-sm font-medium text-stone-300 hover:text-white transition-colors">
                        Prezzi
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                        <Link href="/login" className="text-sm font-medium text-white hover:text-amber-400 transition-colors">
                            Accedi
                        </Link>
                        <Link href="/onboarding/preview" style={{ textDecoration: 'none' }}>
                            <button className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-none rounded-xl text-sm font-bold cursor-pointer transition-all hover:scale-105 shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.5)]">
                                Guarda Demo
                            </button>
                        </Link>
                    </div>
                </nav>

                {/* Mobile Demo Button (Only on Mobile) */}
                <div className="lg:hidden">
                    <Link href="/onboarding/preview" style={{ textDecoration: 'none' }}>
                        <button className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-none rounded-xl text-sm font-bold shadow-[0_4px_15px_rgba(245,158,11,0.3)]">
                            Demo
                        </button>
                    </Link>
                </div>
            </div>
        </header>
    );
}

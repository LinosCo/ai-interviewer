'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { gradients, shadows } from '@/lib/design-system';

interface MarketingNavProps {
    session: any;
}

export function MarketingNav({ session }: MarketingNavProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF8]/80 backdrop-blur-md border-b border-stone-200/50">
            <div className="max-w-6xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Icons.Logo size={32} />
                        <span className="text-xl font-semibold text-stone-900 tracking-tight">Business Tuner</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/#how-it-works" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                            Come funziona
                        </Link>
                        <Link href="/#use-cases" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                            Casi d'uso
                        </Link>
                        <Link href="/#pricing" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                            Prezzi
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        {session ? (
                            <Link href="/dashboard" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                                Dashboard
                            </Link>
                        ) : (
                            <Link href="/login" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
                                Accedi
                            </Link>
                        )}
                        <Link
                            href={session ? "/dashboard" : "/onboarding/preview"}
                            className="text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
                            style={{ background: gradients.primary, boxShadow: shadows.amber }}
                        >
                            {session ? "Vai alla console" : "Guarda Demo"}
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="md:hidden p-2 text-stone-600"
                    >
                        {isOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Navigation Dropdown */}
                {isOpen && (
                    <div className="md:hidden pt-4 pb-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
                        <Link href="/#how-it-works" onClick={() => setIsOpen(false)} className="text-stone-600 font-medium py-2">
                            Come funziona
                        </Link>
                        <Link href="/#use-cases" onClick={() => setIsOpen(false)} className="text-stone-600 font-medium py-2">
                            Casi d'uso
                        </Link>
                        <Link href="/#pricing" onClick={() => setIsOpen(false)} className="text-stone-600 font-medium py-2">
                            Prezzi
                        </Link>
                        <div className="pt-4 border-t border-stone-100 flex flex-col gap-3">
                            <Link
                                href={session ? "/dashboard" : "/login"}
                                onClick={() => setIsOpen(false)}
                                className="text-stone-600 font-medium py-2"
                            >
                                {session ? "Dashboard" : "Accedi"}
                            </Link>
                            <Link
                                href={session ? "/dashboard" : "/onboarding/preview"}
                                onClick={() => setIsOpen(false)}
                                className="text-white text-center px-5 py-3 rounded-xl text-sm font-semibold shadow-lg"
                                style={{ background: gradients.primary }}
                            >
                                {session ? "Vai alla console" : "Guarda Demo"}
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

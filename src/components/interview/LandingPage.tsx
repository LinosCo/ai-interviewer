'use client';

import { useState } from 'react';
import { Bot, Project, Organization } from '@prisma/client';
import { colors, gradients, shadows } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { ArrowRight, Play, Clock, Info, Lock } from 'lucide-react';
import Image from 'next/image';

interface LandingPageProps {
    bot: Bot & { project: Project & { organization: Organization | null } };
    onStart: () => void;
}

export default function LandingPage({ bot, onStart }: LandingPageProps) {
    const isPro = bot.project.organization?.plan === 'PRO' || bot.project.organization?.plan === 'BUSINESS' || bot.project.organization?.plan === 'TRIAL';
    const [consentGiven, setConsentGiven] = useState(false);

    // Customization (fallback to defaults)
    const title = (isPro && bot.landingTitle) || bot.name;
    const description = (isPro && bot.landingDescription) || bot.introMessage || bot.researchGoal;
    const imageUrl = (isPro && bot.landingImageUrl) || null;
    const videoUrl = (isPro && bot.landingVideoUrl) || null;
    const primaryColor = bot.primaryColor || colors.amber;
    const logoUrl = bot.logoUrl;

    const estimatedTime = bot.maxDurationMins || 15;

    // Helper to get video embed URL
    const getEmbedUrl = (url: string) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.split('v=')[1] || url.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}?rel=0`;
        }
        if (url.includes('vimeo.com')) {
            const videoId = url.split('/').pop();
            return `https://player.vimeo.com/video/${videoId}`;
        }
        if (url.includes('drive.google.com')) {
            // Convert /view to /preview for embedding
            return url.replace('/view', '/preview');
        }
        return null;
    };

    // Helper to get image URL (handling Drive)
    const getImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.includes('drive.google.com')) {
            // Extract ID and use database export link
            const idMatch = url.match(/\/d\/(.*?)\//);
            if (idMatch && idMatch[1]) {
                return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
            }
        }
        return url;
    };

    const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
    const computedImageUrl = getImageUrl(imageUrl);

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Icons.Logo className="w-8 h-8 text-amber-500" />
                                <span className="text-lg font-bold text-gray-900">Business Tuner</span>
                            </div>
                        )}
                        {!logoUrl && bot.project.organization?.name && (
                            <span className="text-sm text-gray-400 border-l pl-3 ml-1 border-gray-300">
                                {bot.project.organization.name}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-12 flex flex-col gap-12">

                {/* Hero Section */}
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 mb-2">
                            <span className="px-2 py-1 bg-amber-50 rounded-md border border-amber-100">
                                Sessione Interattiva
                            </span>
                            <span>•</span>
                            <span>{estimatedTime} min stimati</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                            {title}
                        </h1>

                        {/* Media Section (Moved Here) */}
                        {(computedImageUrl || embedUrl) && (
                            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-gray-50 aspect-video relative max-h-[400px]">
                                {embedUrl ? (
                                    <iframe
                                        src={embedUrl}
                                        className="absolute inset-0 w-full h-full"
                                        frameBorder="0"
                                        allow="autoplay; fullscreen; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : computedImageUrl ? (
                                    <img
                                        src={computedImageUrl}
                                        alt="Cover"
                                        className="w-full h-full object-cover"
                                    />
                                ) : null}
                            </div>
                        )}

                        <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
                            {description}
                        </p>
                    </div>

                    {/* Start Button & Consent */}
                    <div className="space-y-4">
                        {/* Consent Checkbox */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <input
                                id="consent-checkbox"
                                type="checkbox"
                                checked={consentGiven}
                                onChange={(e) => setConsentGiven(e.target.checked)}
                                style={{ accentColor: primaryColor }}
                                className="w-5 h-5 mt-0.5 cursor-pointer rounded border-gray-300"
                            />
                            <label htmlFor="consent-checkbox" className="text-sm text-gray-700 select-none cursor-pointer leading-relaxed">
                                <span>Ho letto la </span>
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: primaryColor }}
                                    className="font-medium hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Privacy Policy
                                </a>
                                <span> e acconsento al trattamento dei miei dati.</span>
                            </label>
                        </div>

                        <button
                            onClick={onStart}
                            disabled={!consentGiven}
                            className={`w-full group relative inline-flex items-center justify-center px-8 py-4 text-white font-bold text-lg rounded-xl shadow-lg transition-all duration-200 ${!consentGiven ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-0.5'}`}
                            style={{ background: !consentGiven ? '#ccc' : primaryColor }}
                            title={!consentGiven ? "Devi acconsentire per iniziare" : ""}
                        >
                            <span>Inizia Conversazione</span>
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{estimatedTime} minuti</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock className="w-4 h-4" />
                            <span>Risposte sicure</span>
                        </div>
                    </div>
                </div>

                {/* Privacy & Consent Section */}
                <div className="border-t border-gray-100 pt-8 mt-4">
                    <div className="max-w-xl">


                        {/* Legal Links */}
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400 mb-4">
                            <a href="/privacy" className="hover:text-gray-600 underline decoration-dotted">Privacy Policy</a>
                            <a href="/terms" className="hover:text-gray-600 underline decoration-dotted">Termini di utilizzo</a>
                            <span>© {new Date().getFullYear()} Business Tuner</span>
                        </div>

                        {bot.privacyNotice && (
                            <p className="text-xs leading-relaxed text-gray-500">
                                <strong>Nota:</strong> {bot.privacyNotice}
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

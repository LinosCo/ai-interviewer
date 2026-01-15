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
            return url.replace('/view', '/preview').replace('/file/d/', '/file/d/').split('/view')[0] + '/preview';
        }
        return null;
    };

    // Helper to get image URL (handling Drive)
    const getImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.includes('drive.google.com')) {
            // Extract ID and use database export link - handling various drive formats
            const idMatch = url.match(/[-\w]{25,}/);
            if (idMatch) {
                return `https://lh3.googleusercontent.com/u/0/d/${idMatch[0]}=w1000`;
            }
        }
        return url;
    };

    // Customization (fallback to defaults)
    const title = (isPro && (bot as any).landingTitle) ? (bot as any).landingTitle : bot.name;
    const description = (isPro && (bot as any).landingDescription)
        ? (bot as any).landingDescription
        : ((bot as any).welcomeSubtitle || bot.introMessage || bot.researchGoal);
    const imageUrl = (isPro && (bot as any).landingImageUrl) || null;
    const videoUrl = (isPro && (bot as any).landingVideoUrl) || null;
    const primaryColor = bot.primaryColor || colors.amber;
    const logoUrl = getImageUrl(bot.logoUrl);

    const estimatedTime = bot.maxDurationMins || 10;

    const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
    const computedImageUrl = getImageUrl(imageUrl);
    const backgroundColor = bot.backgroundColor || '#ffffff'; // Default to white if not set

    return (
        <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ backgroundColor }}>
            {/* Background Decoration */}
            <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
                    style={{ background: `radial-gradient(circle, ${primaryColor}40 0%, transparent 70%)` }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
                    style={{ background: `radial-gradient(circle, ${primaryColor}20 0%, transparent 70%)` }} />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-100/50 px-6 py-4 transition-all">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Icons.Logo className="w-8 h-8" style={{ color: primaryColor }} />
                                <span className="text-lg font-bold text-gray-900 tracking-tight">Business Tuner</span>
                            </div>
                        )}
                        {!logoUrl && bot.project.organization?.name && (
                            <span className="text-xs text-gray-400 border-l pl-3 ml-1 border-gray-300 uppercase tracking-widest hidden sm:inline-block">
                                {bot.project.organization.name}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 relative z-10 w-full max-w-4xl mx-auto p-6 md:p-12 lg:p-16 flex flex-col items-center text-center gap-12 animate-in fade-in zoom-in-95 duration-1000">

                {/* Hero Section */}
                <div className="w-full space-y-10">
                    <div className="space-y-6 flex flex-col items-center">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: primaryColor }}>
                            <span className="px-3 py-1 rounded-full border border-current bg-white/50 backdrop-blur-sm">
                                Sessione Interattiva
                            </span>
                            <span className="opacity-30">•</span>
                            <span>{estimatedTime} min stimati</span>
                        </div>

                        <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1] max-w-3xl">
                            {title}
                        </h1>

                        <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl font-medium">
                            {description}
                        </p>

                        {/* Media Section */}
                        {(computedImageUrl || embedUrl) && (
                            <div className="w-full rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100/50 bg-gray-50/50 backdrop-blur-md aspect-video relative group transition-all">
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
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        onError={(e) => {
                                            // Fallback if image fails
                                            (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                        }}
                                    />
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Start Button & Consent */}
                    <div className="w-full max-w-lg mx-auto space-y-6">
                        {/* Consent Checkbox */}
                        <div className="group flex items-start gap-4 p-5 bg-white/50 backdrop-blur-md rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200">
                            <div className="relative flex items-center mt-0.5">
                                <input
                                    id="consent-checkbox"
                                    type="checkbox"
                                    checked={consentGiven}
                                    onChange={(e) => setConsentGiven(e.target.checked)}
                                    className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-gray-200 transition-all checked:border-transparent"
                                    style={{ backgroundColor: consentGiven ? primaryColor : 'transparent' }}
                                />
                                <Icons.Check
                                    className={`absolute left-0 top-0 h-6 w-6 text-white pointer-events-none transition-all scale-50 opacity-0 ${consentGiven ? 'scale-100 opacity-100' : ''}`}
                                    size={16}
                                />
                            </div>
                            <label htmlFor="consent-checkbox" className="text-sm text-gray-500 text-left select-none cursor-pointer leading-relaxed font-medium">
                                <span>Ho letto la </span>
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: primaryColor }}
                                    className="font-bold hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Privacy Policy
                                </a>
                                <span> e acconsento al trattamento dei miei dati per le finalità indicate.</span>
                            </label>
                        </div>

                        <button
                            onClick={onStart}
                            disabled={!consentGiven}
                            className={`w-full group relative inline-flex items-center justify-center px-10 py-5 text-white font-black text-xl rounded-2xl shadow-xl transition-all duration-300 transform ${!consentGiven ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:shadow-2xl hover:-translate-y-1 active:scale-95'}`}
                            style={{
                                background: consentGiven ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` : '#999',
                                boxShadow: consentGiven ? `0 20px 40px -15px ${primaryColor}70` : 'none'
                            }}
                        >
                            <span className="relative z-10">Inizia Conversazione</span>
                            <ArrowRight className="relative z-10 ml-3 w-6 h-6 transition-transform group-hover:translate-x-1.5" />
                        </button>

                        <div className="flex items-center justify-center gap-8 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5 transition-colors hover:text-gray-600">
                                <Clock className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                                <span>{estimatedTime} minuti</span>
                            </div>
                            <div className="flex items-center gap-1.5 transition-colors hover:text-gray-600">
                                <Lock className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                                <span>Risposte sicure</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <footer className="w-full pt-12 border-t border-gray-100">
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex flex-col items-center gap-2 mb-4">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Powered by</span>
                            <a
                                href="/"
                                target="_blank"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-all border border-gray-100 hover:border-gray-200 group"
                            >
                                <Icons.Logo className="w-5 h-5" />
                                <span className="font-bold text-gray-700 text-sm tracking-tight group-hover:text-gray-900">Business Tuner AI</span>
                            </a>
                        </div>

                        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                            <a href="/privacy" className="transition-colors hover:text-gray-900">Privacy Policy</a>
                            <a href="/terms" className="transition-colors hover:text-gray-900">Termini</a>
                            <span className="opacity-50">© {new Date().getFullYear()} Business Tuner AI</span>
                        </div>

                        {bot.privacyNotice && (
                            <p className="max-w-lg text-[10px] leading-relaxed text-gray-400 font-medium">
                                <span className="text-gray-900 uppercase tracking-tighter mr-2 font-black">Nota legale:</span>
                                {bot.privacyNotice}
                            </p>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}

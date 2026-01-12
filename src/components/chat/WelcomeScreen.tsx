import React from 'react';
import { Bot, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/business-tuner/Icons';

interface WelcomeScreenProps {
    bot: any; // We can use a more specific type if available, e.g. defined in types
    onStart: () => void;
    onCancel?: () => void;
    brandColor?: string;
}

export function WelcomeScreen({ bot, onStart, onCancel, brandColor = '#F59E0B' }: WelcomeScreenProps) {
    // Helper to get image URL (handling Drive)
    const getImageUrl = (url: string | null) => {
        if (!url) return null;
        if (url.includes('drive.google.com')) {
            const idMatch = url.match(/[-\w]{25,}/);
            if (idMatch) return `https://lh3.googleusercontent.com/u/0/d/${idMatch[0]}=w1000`;
        }
        return url;
    };
    const logoUrl = getImageUrl(bot.logoUrl);

    const title = bot.welcomeTitle || `Benvenuto in ${bot.name}`;
    const subtitle = bot.welcomeSubtitle || bot.description || "Siamo pronti per iniziare questa conversazione.";

    // Format explanation default or override
    const explanation = bot.formatExplanation || `Questa è un'intervista guidata dall'I.A. per raccogliere i tuoi feedback.
  
• Durata stimata: ${bot.maxDurationMins || 10} minuti
• Risposte protette dalla privacy
• Proseguimento fluido e naturale`;

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-4xl mx-auto p-6 md:p-12 text-center animate-in fade-in slide-in-from-bottom-5 duration-1000 relative z-10">

            {/* Logo Section */}
            <div className="mb-10 relative group">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-20 scale-150 transition-all group-hover:opacity-40" style={{ backgroundColor: brandColor }} />
                <div className="relative p-6 rounded-[2rem] bg-white border border-gray-100 shadow-xl overflow-hidden transition-transform duration-500 group-hover:scale-110">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                    ) : (
                        <Bot className="w-16 h-16" style={{ color: brandColor }} />
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-6 mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                    {title}
                </h1>

                <p className="text-xl md:text-2xl text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {/* Explanation Card */}
            <div className="w-full max-w-xl bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[2rem] p-8 mb-12 text-left shadow-lg ring-1 ring-black/5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-900 text-white">
                        <Info size={16} />
                    </div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Cosa aspettarsi</h3>
                </div>
                <div className="text-gray-500 font-medium text-lg whitespace-pre-line leading-relaxed">
                    {explanation}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
                <Button
                    onClick={onStart}
                    size="lg"
                    className="flex-1 rounded-2xl px-10 py-8 text-xl font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
                    style={{
                        backgroundColor: brandColor,
                        boxShadow: `0 20px 30px -10px ${brandColor}60`
                    }}
                >
                    <Play className="w-6 h-6 mr-3 fill-current" />
                    Inizia l'intervista
                </Button>
            </div>

            <div className="mt-16 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">
                <div className="h-px w-8 bg-gray-200" />
                <span>Powered by Business Tuner AI</span>
                <div className="h-px w-8 bg-gray-200" />
            </div>
        </div>
    );
}

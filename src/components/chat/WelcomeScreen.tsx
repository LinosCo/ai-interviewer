import React from 'react';
import { Bot, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
    bot: any; // We can use a more specific type if available, e.g. defined in types
    onStart: () => void;
    onCancel?: () => void;
    brandColor?: string;
}

export function WelcomeScreen({ bot, onStart, onCancel, brandColor = '#F59E0B' }: WelcomeScreenProps) {
    const title = bot.welcomeTitle || `Benvenuto in ${bot.name}`;
    const subtitle = bot.welcomeSubtitle || bot.description || "Partecipa a questa sessione interattiva.";

    // Format explanation default or override
    const explanation = bot.formatExplanation || `Questa è un'intervista guidata dall'intelligenza artificiale.
  
Le tue risposte ci aiuteranno a raccogliere feedback preziosi.
• Durata stimata: ${bot.maxDurationMins} minuti
• Tutte le risposte sono anonime
• Puoi interrompere in qualsiasi momento`;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto p-6 text-center animate-in fade-in duration-500">

            {/* Logo or Icon */}
            <div className="mb-8 p-4 rounded-full" style={{ backgroundColor: `${brandColor}10` }}>
                {bot.logoUrl ? (
                    <img src={bot.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                ) : (
                    <Bot className="w-16 h-16" style={{ color: brandColor }} />
                )}
            </div>

            {/* Main Content */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>

            <p className="text-xl text-gray-600 mb-8 max-w-lg mx-auto">
                {subtitle}
            </p>

            {/* Explanation Box */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 mb-8 text-left w-full">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Cosa aspettarsi</h3>
                <div className="text-gray-600 whitespace-pre-line leading-relaxed">
                    {explanation}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button
                    onClick={onStart}
                    size="lg"
                    className="w-full sm:w-auto px-8 py-6 text-lg text-white shadow-lg transition-all hover:scale-105"
                    style={{ backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}40` }}
                >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Inizia l'Intervista
                </Button>
            </div>

            <div className="mt-8 text-xs text-gray-400">
                Powered by Business Tuner AI
            </div>
        </div>
    );
}

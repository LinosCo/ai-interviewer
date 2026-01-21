'use client';

import { useState } from 'react';
import ChatBubble from '@/components/chatbot/ChatBubble';
import ChatWindow from '@/components/chatbot/ChatWindow';
import { Eye, EyeOff } from 'lucide-react';

interface WidgetPreviewProps {
    bot: any;
}

export default function WidgetPreview({ bot }: WidgetPreviewProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(true);

    return (
        <div className="relative h-[600px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden">
            {/* Preview Controls */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                    onClick={() => setShowBubble(!showBubble)}
                    className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm text-xs font-medium flex items-center gap-2 hover:bg-white transition-colors border border-slate-200"
                >
                    {showBubble ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {showBubble ? 'Nascondi' : 'Mostra'} Bubble
                </button>
                <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700">
                    ● Active
                </div>
            </div>

            {/* Info Text */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <div className="bg-white/60 backdrop-blur-sm px-6 py-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-600 font-medium mb-1">Anteprima Live</p>
                    <p className="text-xs text-slate-400">
                        Il widget dovrebbe apparire nell'angolo in basso a destra di questo riquadro.
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        Prova a cliccare per interagire!
                    </p>
                </div>
            </div>

            {/* Actual Widget */}
            {showBubble && (
                <>
                    <ChatBubble
                        botId={bot.id}
                        primaryColor={bot.primaryColor || '#7C3AED'}
                        welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                        isOpen={isOpen}
                        onToggle={setIsOpen}
                    />
                    <ChatWindow
                        botId={bot.id}
                        isOpen={isOpen}
                        onClose={() => setIsOpen(false)}
                        botName={bot.name}
                        primaryColor={bot.primaryColor || '#7C3AED'}
                        welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                        privacyPolicyUrl={bot.privacyPolicyUrl || ''}
                        companyName={bot.name}
                    />
                </>
            )}
        </div>
    );
}

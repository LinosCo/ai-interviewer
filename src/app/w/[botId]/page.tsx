'use client';

import { useEffect, useState, use } from 'react';
import ChatBubble from '@/components/chatbot/ChatBubble';
import ChatWindow from '@/components/chatbot/ChatWindow';

interface WidgetPageProps {
    params: Promise<{ botId: string }>;
}

export default function PublicWidgetPage({ params }: WidgetPageProps) {
    const { botId } = use(params);
    const [bot, setBot] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check if we are in "full" mode (straight to chat window)
    const isFullMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('full') === 'true';

    useEffect(() => {
        if (isFullMode) {
            setIsOpen(true);
        }
    }, [isFullMode]);

    useEffect(() => {
        async function fetchBot() {
            try {
                const res = await fetch(`/api/chatbot/${botId}/config`);
                if (res.ok) {
                    const data = await res.json();
                    setBot(data);
                }
            } catch (err) {
                console.error('Failed to load bot config:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchBot();
    }, [botId]);

    // Notify parent window of resize
    useEffect(() => {
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'bt-widget-resize',
                isOpen: isOpen
            }, '*');
        }
    }, [isOpen]);

    if (loading) return null;
    if (!bot) return null;

    if (isFullMode) {
        return (
            <div className="w-full h-screen bg-white overflow-hidden">
                <ChatWindow
                    botId={botId}
                    isOpen={true}
                    onClose={() => { }} // No close in full mode
                    botName={bot.name}
                    primaryColor={bot.primaryColor || '#7C3AED'}
                    welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                    privacyPolicyUrl={bot.privacyPolicyUrl}
                />
                <style jsx global>{`
                    body { margin: 0; padding: 0; overflow: hidden; }
                    /* Override the fixed positioning of ChatWindow when in full mode */
                    div[class*="fixed"] {
                        position: relative !important;
                        bottom: auto !important;
                        right: auto !important;
                        width: 100% !important;
                        height: 100% !important;
                        max-width: none !important;
                        max-height: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full min-h-screen bg-transparent">
            <ChatBubble
                botId={botId}
                primaryColor={bot.primaryColor || '#7C3AED'}
                welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                isOpen={isOpen}
                onToggle={setIsOpen}
                position="bottom-right"
            />
            <ChatWindow
                botId={botId}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                botName={bot.name}
                primaryColor={bot.primaryColor || '#7C3AED'}
                welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                privacyPolicyUrl={bot.privacyPolicyUrl}
            />
            {/* Minimal styles for the iframe body */}
            <style jsx global>{`
                body {
                    background: transparent !important;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
}

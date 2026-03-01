'use client';

import { useEffect, useState, use } from 'react';
import ChatBubble from '@/components/chatbot/ChatBubble';
import ChatWindow from '@/components/chatbot/ChatWindow';

interface WidgetPageProps {
    params: Promise<{ botId: string }>;
}

type HostPageContext = {
    url?: string;
    title?: string;
    description?: string;
    mainContent?: string;
};

type PublicBotConfig = {
    id: string;
    name: string;
    primaryColor?: string | null;
    introMessage?: string | null;
    privacyPolicyUrl?: string | null;
    enablePageContext?: boolean | null;
    consentText?: string | null;
    privacyNotice?: string | null;
    dataUsageInfo?: string | null;
    showAnonymityInfo?: boolean | null;
    showDataUsageInfo?: boolean | null;
};

export default function PublicWidgetPage({ params }: WidgetPageProps) {
    const { botId } = use(params);
    const [bot, setBot] = useState<PublicBotConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hostPageContext, setHostPageContext] = useState<HostPageContext | null>(null);
    const forceConsent = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('forceConsent') === 'true';

    // Check if we are in "full" mode (straight to chat window)
    const isFullMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('full') === 'true';
    // data-auto-open: embed host requests widget open immediately
    const autoOpen = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autoOpen') === 'true';

    useEffect(() => {
        if (isFullMode || autoOpen) {
            setIsOpen(true);
        }
    }, [isFullMode, autoOpen]);

    useEffect(() => {
        async function fetchBot() {
            try {
                const res = await fetch(`/api/chatbot/${botId}/config`);
                if (res.ok) {
                    const data: PublicBotConfig = await res.json();
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

    // Ask parent page for context (URL/title/description/main content) when embedded in iframe.
    useEffect(() => {
        if (typeof window === 'undefined' || window.parent === window) return;

        const handleMessage = (event: MessageEvent) => {
            const data = event.data;
            if (data?.type !== 'bt-widget-page-context' || !data.pageContext) return;

            const pageContext = data.pageContext as HostPageContext;
            setHostPageContext({
                url: typeof pageContext.url === 'string' ? pageContext.url : '',
                title: typeof pageContext.title === 'string' ? pageContext.title : '',
                description: typeof pageContext.description === 'string' ? pageContext.description : '',
                mainContent: typeof pageContext.mainContent === 'string' ? pageContext.mainContent : ''
            });
        };

        window.addEventListener('message', handleMessage);
        window.parent.postMessage({ type: 'bt-widget-get-context' }, '*');

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // Notify parent window of resize
    useEffect(() => {
        if (window.parent === window) return;

        const notifyResize = () => {
            window.parent.postMessage({
                type: 'bt-widget-resize',
                isOpen
            }, '*');
        };

        // Send immediately and repeat briefly to avoid missed first handshake.
        notifyResize();
        const t1 = window.setTimeout(notifyResize, 120);
        const t2 = window.setTimeout(notifyResize, 420);

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
        };
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
                    privacyPolicyUrl={bot.privacyPolicyUrl ?? undefined}
                    hostPageContext={hostPageContext}
                    enablePageContext={bot.enablePageContext !== false}
                    forceConsentScreen={forceConsent}
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
            {!isOpen && (
                <ChatBubble
                    botId={botId}
                    primaryColor={bot.primaryColor || '#7C3AED'}
                    welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                    isOpen={isOpen}
                    onToggle={setIsOpen}
                    position="bottom-right"
                />
            )}
            <ChatWindow
                botId={botId}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                botName={bot.name}
                primaryColor={bot.primaryColor || '#7C3AED'}
                welcomeMessage={bot.introMessage || 'Ciao! Come posso aiutarti?'}
                privacyPolicyUrl={bot.privacyPolicyUrl ?? undefined}
                consentText={bot.consentText ?? undefined}
                privacyNotice={bot.privacyNotice ?? undefined}
                dataUsageInfo={bot.dataUsageInfo ?? undefined}
                showAnonymityInfo={bot.showAnonymityInfo ?? undefined}
                showDataUsageInfo={bot.showDataUsageInfo ?? undefined}
                hostPageContext={hostPageContext}
                enablePageContext={bot.enablePageContext !== false}
                forceConsentScreen={forceConsent}
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

'use client';

import { useState, useEffect } from 'react';
import ChatBubble from '@/components/chatbot/ChatBubble';
import ChatWindow from '@/components/chatbot/ChatWindow';

export default function WidgetPage({ params }: { params: { botId: string } }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        // Fetch bot config specifically for the widget
        // We can reuse the start endpoint or a new one to get just config
        // Or we assume the parent passed it? No, widget loads independently.
        // Let's call a simple config endpoint or use /api/bots/[id]
        const fetchConfig = async () => {
            try {
                // We use the bots API but we might need public access
                // src/app/api/bots/[botId] might be protected.
                // Let's use /api/chatbot/start to get initial config + conv?
                // Actually start gives us welcome message but not full styling config if not in response.
                // Let's fetch /api/bots/[botId] assuming it allows public read for widgets OR create a specific endpoint.
                // For now, let's use /api/chatbot/start which we can modify to return config, 
                // OR we just use defaults until we fetch.

                // Better: Use /api/bots/[botId] but check if it's public.
                // If it's protected, we need a public endpoint. 
                // Let's use /api/chatbot/start for now to get minimal info or create /api/chatbot/config/[botId]

                // Minimal Mock for now to get it rendering, then we connect real config
                const res = await fetch(`/api/bots/${params.botId}/public-config`);
                // Note: I need to create this endpoint or use existing.
                // Let's use the one we have or hardcode defaults if it fails.
            } catch (e) {
                console.error(e);
            }
        };
        // fetchConfig();
    }, [params.botId]);

    // Communication with Parent (chatbot.js)
    useEffect(() => {
        if (window.parent) {
            window.parent.postMessage({
                type: 'bt-widget-resize',
                isOpen
            }, '*');
        }
    }, [isOpen]);

    // Handle initial open state from URL or parent?

    return (
        <div className="bg-transparent">
            {/* We render both bubble and window here */}
            {/* If isOpen, the parent iframe should be large. If !isOpen, small. */}

            <ChatWindow
                botId={params.botId}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                botName="Assistente" // Todo: get from config
                primaryColor="#7C3AED" // Todo: get from config
                welcomeMessage="Ciao! Come posso aiutarti?" // Todo: get from config
            />

            {/* We hide the bubble logic inside ChatBubble but we need to trigger isOpen */}
            {/* ChatBubble component manages its own isOpen state internally? 
                In my implementation it does: const [isOpen, setIsOpen] = useState(initialIsOpen);
                But here we need to lift state up to resize iframe.
            */}

            {/* I need to modify ChatBubble to accept isOpen/onToggle props or control it. */}
            {/* My ChatBubble implementation uses internal state. I should refactor it slightly or force it. */}

            {/* Let's wrap ChatBubble to control it */}
            <div className="fixed bottom-0 right-0 p-6">
                {/* Re-implement bubble button here or use component if it accepts props */}
                {/* The ChatBubble component I wrote has internal state. I should update it to be controlled. */}
                {/* Or I just click it and it sets internal state, but I need to know in parent. */}
            </div>
        </div>
    );
}

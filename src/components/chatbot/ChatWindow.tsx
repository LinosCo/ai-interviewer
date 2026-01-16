'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Paperclip, Image as ImageIcon, Loader2, Bot, User } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
    botName: string;
    primaryColor?: string;
    welcomeMessage?: string;
    botId: string;
}

export default function ChatWindow({
    isOpen,
    onClose,
    botName,
    primaryColor = '#7C3AED',
    welcomeMessage,
    botId
}: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [conversationId, setConversationId] = useState<string | null>(null);

    // Initial conversation start
    useEffect(() => {
        const initChat = async () => {
            if (conversationId) return;

            try {
                // Generate or retrieve session ID
                let sessionId = localStorage.getItem('bt_sid');
                if (!sessionId) {
                    sessionId = 's_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('bt_sid', sessionId);
                }

                const res = await fetch('/api/chatbot/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        botId,
                        sessionId,
                        pageContext: {
                            url: window.location.href,
                            title: document.title
                        }
                    })
                });

                if (!res.ok) throw new Error('Failed to start chat');
                const data = await res.json();
                setConversationId(data.conversationId);

                // Only set welcome message if we don't have messages yet
                if (data.welcomeMessage && messages.length === 0) {
                    setMessages([
                        {
                            id: 'welcome',
                            role: 'assistant',
                            content: data.welcomeMessage,
                            timestamp: new Date()
                        }
                    ]);
                }
            } catch (err) {
                console.error('Failed to init chat:', err);
            }
        };

        if (isOpen) {
            initChat();
        }
    }, [isOpen, botId, conversationId, messages.length]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading || !conversationId) return;

        const userMsg = inputValue;
        setInputValue('');

        // Add user message
        const newMessages = [
            ...messages,
            {
                id: Date.now().toString(),
                role: 'user' as const,
                content: userMsg,
                timestamp: new Date()
            }
        ];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Call API
            const res = await fetch('/api/chatbot/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId, // Use the real conversation ID
                    message: userMsg,
                    // History is handled by backend usually, but if needed:
                    history: newMessages.slice(-6)
                })
            });

            if (!res.ok) throw new Error('Failed to send message');

            const data = await res.json();

            // Add bot response
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: data.response || data.message, // handle both keys if API varies
                    timestamp: new Date()
                }
            ]);

        } catch (err) {
            console.error(err);
            // Add error message
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: 'Mi dispiace, si è verificato un errore. Riprova più tardi.',
                    timestamp: new Date()
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 z-[9999] flex flex-col font-sans"
                >
                    {/* Header */}
                    <div
                        className="p-4 flex items-center justify-between text-white shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg leading-tight">{botName}</h3>
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    <span className="text-xs font-medium">Online adesso</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200">
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs shadow-sm mt-auto
                                            ${msg.role === 'user' ? 'bg-gray-800' : ''}`}
                                        style={msg.role === 'assistant' ? { backgroundColor: primaryColor } : {}}
                                    >
                                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>

                                    {/* Bubble */}
                                    <div
                                        className={`p-3.5 rounded-2xl shadow-sm text-sm leading-relaxed
                                            ${msg.role === 'user'
                                                ? 'bg-gray-900 text-white rounded-br-none'
                                                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-2 bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm items-center">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t bg-white">
                        <div className="flex gap-2 items-end bg-gray-100 p-2 rounded-xl border border-transparent focus-within:border-gray-300 focus-within:bg-white transition-all">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Scrivi un messaggio..."
                                className="flex-1 bg-transparent border-none focus:ring-0 p-2 max-h-32 text-sm text-gray-800 placeholder-gray-500"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading}
                                className={`p-2 rounded-lg transition-all ${inputValue.trim()
                                    ? 'bg-gray-900 text-white shadow-md hover:bg-gray-800'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                style={inputValue.trim() ? { backgroundColor: primaryColor } : {}}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="text-center mt-2 pb-1">
                            <a
                                href="https://businesstuner.voler.ai"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-gray-400 font-medium hover:text-gray-600 transition-colors"
                            >
                                Powered by Business Tuner
                            </a>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

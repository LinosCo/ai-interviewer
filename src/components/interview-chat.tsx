'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface InterviewChatProps {
    conversationId: string;
    botId: string;
    botName: string;
    botDescription?: string;
    estimatedDuration?: string;
    privacyLevel?: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    backgroundColor?: string | null;
}

export default function InterviewChat({
    conversationId,
    botId,
    botName,
    botDescription,
    estimatedDuration,
    privacyLevel,
    logoUrl,
    primaryColor = '#6366f1',
    backgroundColor = '#f9fafb',
}: InterviewChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus input
    useEffect(() => {
        if (hasStarted && inputRef.current) {
            inputRef.current.focus();
        }
    }, [hasStarted, messages]);

    const handleStart = async () => {
        setHasStarted(true);
        await handleSendMessage("I'm ready to start the interview.");
    };

    const handleSendMessage = async (messageContent: string) => {
        if (!messageContent.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    conversationId,
                    botId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to get response');
            }

            const assistantText = await response.text();

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: assistantText
            }]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: error.message || 'Sorry, there was an error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    if (!hasStarted) {
        return (
            <div
                className="min-h-screen flex items-center justify-center p-4"
                style={{
                    background: `linear-gradient(135deg, ${primaryColor || '#6366f1'}15 0%, ${primaryColor || '#6366f1'}05 100%)`,
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl w-full"
                >
                    <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
                        {logoUrl && (
                            <div className="flex justify-center mb-6">
                                <img src={logoUrl} alt={botName} className="h-16 object-contain" />
                            </div>
                        )}

                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
                            {botName}
                        </h1>

                        {botDescription && (
                            <p className="text-lg text-gray-600 text-center mb-8">
                                {botDescription}
                            </p>
                        )}

                        {estimatedDuration && (
                            <div className="bg-blue-50 rounded-lg p-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-blue-900">Duration</span>
                                    <span className="text-sm text-blue-700">{estimatedDuration}</span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleStart}
                            className="w-full py-4 px-6 rounded-xl font-semibold text-white text-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                            style={{ backgroundColor: primaryColor }}
                        >
                            Start Interview →
                        </button>

                        <div className="mt-8 text-center text-sm text-gray-500">
                            {privacyLevel && (
                                <p className="mb-2">
                                    Privacy Level: <span className="font-medium">{privacyLevel}</span>
                                </p>
                            )}
                            <p>
                                Your responses will be used for research purposes.
                                <a href="/privacy" className="text-blue-600 hover:underline ml-1">Learn more</a>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    const currentMessage = messages[messages.length - 1];
    const isUserMessage = currentMessage?.role === 'user';

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: `linear-gradient(135deg, ${primaryColor}10 0%, ${backgroundColor} 100%)`,
            }}
        >
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logoUrl && (
                            <img src={logoUrl} alt={botName} className="h-8 object-contain" />
                        )}
                        <div>
                            <h1 className="font-semibold text-gray-900">{botName}</h1>
                            <p className="text-xs text-gray-500">AI Interview</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">
                        {messages.filter(m => m.role === 'assistant').length} questions
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    <AnimatePresence mode="popLayout">
                        {messages.map((msg, index) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-6 py-4 ${msg.role === 'user'
                                        ? 'text-white shadow-lg'
                                        : 'bg-white text-gray-900 shadow-md'
                                        }`}
                                    style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}
                                >
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {msg.content}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                        >
                            <div className="bg-white rounded-2xl px-6 py-4 shadow-md">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Input */}
            <div className="bg-white/80 backdrop-blur-sm border-t border-gray-200 p-4 md:p-6">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="Type your answer..."
                            rows={1}
                            className="w-full resize-none rounded-2xl border-2 border-gray-200 px-6 py-4 pr-14 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                            style={{
                                minHeight: '60px',
                                maxHeight: '200px',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-3 bottom-3 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-xs text-gray-500 text-center mt-3">
                        Press Enter to send • Shift+Enter for new line
                    </p>
                </div>
            </div>
        </div>
    );
}

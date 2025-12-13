'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

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
    rewardConfig?: {
        enabled: boolean;
        type: string;
        displayText?: string | null;
        showOnLanding: boolean;
    } | null;
    privacyNotice?: string | null;
    dataUsageInfo?: string | null;
    showAnonymityInfo?: boolean;
    showDataUsageInfo?: boolean;
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
    rewardConfig,
    privacyNotice,
    dataUsageInfo,
    showAnonymityInfo = true,
    showDataUsageInfo = true,
}: InterviewChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [showLanding, setShowLanding] = useState(true);

    // Start interview when user clicks button
    const handleStart = async () => {
        setShowLanding(false);
        setHasStarted(true);
        setStartTime(Date.now());
        await handleSendMessage("I'm ready to start the interview.", true);
    };

    // Auto-focus input when question changes
    useEffect(() => {
        if (inputRef.current && !isLoading) {
            inputRef.current.focus();
        }
    }, [currentQuestionIndex, isLoading]);

    const handleSendMessage = async (messageContent: string, isInitial = false) => {
        if ((!messageContent.trim() || isLoading) && !isInitial) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent
        };

        if (!isInitial) {
            setMessages(prev => [...prev, userMessage]);
        }

        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: isInitial ? [] : [...messages, userMessage],
                    conversationId,
                    botId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to get response');
            }

            const assistantText = await response.text();

            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: assistantText
            };

            setMessages(prev => isInitial ? [assistantMessage] : [...prev, assistantMessage]);
            setCurrentQuestionIndex(prev => prev + 1);
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

    // Get current question (last assistant message)
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const currentQuestion = assistantMessages[assistantMessages.length - 1];
    const totalQuestions = assistantMessages.length;
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);

    // Calculate progress (rough estimate based on estimated duration)
    const estimatedMinutes = parseInt(estimatedDuration?.replace(/\D/g, '') || '10');
    const progress = Math.min((elapsedMinutes / estimatedMinutes) * 100, 95);

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: `linear-gradient(135deg, ${primaryColor || '#6366f1'}08 0%, ${backgroundColor || '#f9fafb'} 100%)`,
            }}
        >
            {/* Progress bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
                <motion.div
                    className="h-full"
                    style={{ backgroundColor: primaryColor || '#6366f1' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Header - minimal */}
            <header className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {logoUrl && (
                        <img src={logoUrl} alt={botName} className="h-8 object-contain" />
                    )}
                    <div>
                        <h1 className="font-semibold text-gray-900">{botName}</h1>
                    </div>
                </div>
                <div className="text-sm text-gray-500">
                    {elapsedMinutes} / ~{estimatedMinutes} min
                </div>
            </header>

            {/* Question area - centered, one at a time */}
            <div className="flex-1 flex items-center justify-center p-4 pb-32">
                <div className="max-w-3xl w-full">
                    <AnimatePresence mode="wait">
                        {currentQuestion && (
                            <motion.div
                                key={currentQuestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-6"
                            >
                                {/* Question number */}
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>{totalQuestions}</span>
                                    <span>→</span>
                                </div>

                                {/* Question text */}
                                <div className="prose prose-lg max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => (
                                                <p className="text-2xl md:text-3xl font-medium text-gray-900 leading-relaxed mb-4">
                                                    {children}
                                                </p>
                                            ),
                                            strong: ({ children }) => (
                                                <strong className="font-bold text-gray-900">{children}</strong>
                                            ),
                                            em: ({ children }) => (
                                                <em className="italic">{children}</em>
                                            ),
                                        }}
                                    >
                                        {currentQuestion.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Show user's last answer if exists */}
                                {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="mt-8 p-4 rounded-xl bg-white/50 border border-gray-200"
                                    >
                                        <div className="text-xs text-gray-500 mb-2">Your answer:</div>
                                        <div className="text-gray-700">
                                            {messages[messages.length - 2].content}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {isLoading && !currentQuestion && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-4"
                            >
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <p className="text-gray-500 text-sm">Loading question...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Input area - ALWAYS fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 md:p-6">
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
                            className="w-full resize-none rounded-2xl border-2 border-gray-300 px-6 py-4 pr-14 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-lg transition-all"
                            style={{
                                minHeight: '60px',
                                maxHeight: '200px',
                                borderColor: isLoading ? '#d1d5db' : (primaryColor || '#6366f1'),
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-3 bottom-3 w-12 h-12 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 active:scale-95 shadow-lg"
                            style={{ backgroundColor: primaryColor || '#6366f1' }}
                            aria-label="Send answer"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    </form>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span>Press Enter to send • Shift+Enter for new line</span>
                        <span>Question {totalQuestions}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

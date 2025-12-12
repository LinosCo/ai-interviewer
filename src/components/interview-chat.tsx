'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InterviewChatProps {
    conversationId: string;
    botId: string;
    botName: string;
    initialMessages: any[];
    topics: any[];
    // Branding
    logoUrl?: string | null;
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
}

export default function InterviewChat({
    conversationId,
    botId,
    botName,
    initialMessages,
    topics,
    logoUrl,
    primaryColor = '#6366f1',
    backgroundColor = '#ffffff',
    textColor = '#1f2937',
}: InterviewChatProps) {
    const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
        api: '/api/chat',
        body: { conversationId, botId },
        initialMessages: initialMessages.length > 0 ? initialMessages : undefined,
        onError: (error) => {
            console.error('Chat error:', error);
        },
    });

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentQuestionIndex]);

    // Calculate progress
    const totalTopics = topics.length || 1;
    const progress = messages.length > 0 ? Math.min(100, (messages.length / (totalTopics * 5)) * 100) : 0;

    // Get current question (last assistant message)
    const currentQuestion = messages.filter((m: any) => m.role === 'assistant').slice(-1)[0];

    // Handle form submission
    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        handleSubmit(e);
        setCurrentQuestionIndex(prev => prev + 1);
    };

    // Handle Enter key (submit) vs Shift+Enter (new line)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as any);
        }
    };

    // Start chat if no messages
    const startChat = () => {
        console.log('Start chat clicked, append:', typeof append, append);
        if (append) {
            append({
                role: 'user',
                content: "I'm ready to start the interview."
            });
        } else {
            console.error('Append function not available!');
        }
    };

    // Debug: Log append availability
    useEffect(() => {
        console.log('InterviewChat mounted. Append available:', !!append, typeof append);
        if (!append) {
            console.error('useChat did not initialize append function. Check API route.');
        }
    }, [append]);

    return (
        <div
            className="h-screen flex flex-col"
            style={{
                backgroundColor,
                color: textColor
            }}
        >
            {/* Header with logo and progress */}
            <header className="p-6 flex items-center justify-between border-b" style={{ borderColor: `${primaryColor}20` }}>
                <div className="flex items-center gap-3">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={botName}
                            className="h-10 w-10 object-contain rounded"
                        />
                    )}
                    <h1 className="font-semibold text-lg">{botName}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm opacity-60">
                        {Math.round(progress)}% complete
                    </span>
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: primaryColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-3xl">
                    <AnimatePresence mode="wait">
                        {messages.length === 0 && !isLoading ? (
                            // Welcome screen
                            <motion.div
                                key="welcome"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center space-y-6"
                            >
                                <h2 className="text-4xl font-bold mb-4">Welcome! 👋</h2>
                                <p className="text-xl opacity-80 mb-8">
                                    Ready to share your thoughts? This will take about 5-10 minutes.
                                </p>
                                <button
                                    onClick={startChat}
                                    className="px-8 py-4 rounded-xl font-semibold text-white text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Start Interview →
                                </button>
                                {!append && (
                                    <p className="text-xs text-red-500 mt-2">
                                        Note: Chat initialization may be slow. Check console for errors.
                                    </p>
                                )}
                            </motion.div>
                        ) : currentQuestion ? (
                            // Current question
                            <motion.div
                                key={currentQuestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-8"
                            >
                                {/* Question number */}
                                <div className="flex items-center gap-2 text-sm opacity-60">
                                    <span style={{ color: primaryColor }}>●</span>
                                    <span>Question {messages.filter((m: any) => m.role === 'assistant').length}</span>
                                </div>

                                {/* Question text */}
                                <h2 className="text-3xl font-medium leading-relaxed">
                                    {currentQuestion.content}
                                </h2>

                                {/* Input form */}
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        disabled={isLoading}
                                        placeholder="Type your answer here..."
                                        className="w-full p-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-0 resize-none disabled:opacity-50 transition"
                                        style={{
                                            borderColor: input ? primaryColor : '#e5e7eb',
                                            backgroundColor: `${backgroundColor}`,
                                            color: textColor,
                                        }}
                                        rows={3}
                                    />
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm opacity-60">
                                            Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Enter</kbd> to submit
                                        </p>
                                        <button
                                            type="submit"
                                            disabled={!input.trim() || isLoading}
                                            className="px-6 py-3 rounded-xl font-semibold text-white shadow-md hover:shadow-lg transform hover:scale-105 transition disabled:opacity-50 disabled:transform-none"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {isLoading ? 'Sending...' : 'OK ✓'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        ) : isLoading ? (
                            // Loading state
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-center space-y-4"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <motion.div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: primaryColor }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                    />
                                    <motion.div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: primaryColor }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                    />
                                    <motion.div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: primaryColor }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                    />
                                </div>
                                <p className="text-lg opacity-60">Thinking...</p>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>

            {/* Footer hint */}
            <footer className="p-4 text-center text-sm opacity-40">
                Powered by {botName}
            </footer>
        </div>
    );
}

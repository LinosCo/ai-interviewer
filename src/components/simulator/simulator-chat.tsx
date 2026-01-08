'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface GeneratedConfig {
    name?: string;
    researchGoal: string;
    targetAudience: string;
    language: string;
    tone: string;
    maxDurationMins: number;
    introMessage: string;
    topics: any[];
}

interface SimulatorChatProps {
    config: GeneratedConfig;
    onClose?: () => void;
}

export default function SimulatorChat({ config, onClose }: SimulatorChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
    const [effectiveDuration, setEffectiveDuration] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isTyping, setIsTyping] = useState(false);

    // Initial Start
    useEffect(() => {
        if (messages.length === 0) {
            handleStart();
        }
    }, [messages.length]);

    // Timer for active tracking
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((isTyping || isLoading) && messages.length > 0) {
            interval = setInterval(() => {
                setEffectiveDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTyping, isLoading, messages.length]);

    // Auto-focus logic
    useEffect(() => {
        if (!isLoading && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isLoading]);

    const handleStart = async () => {
        if (config.introMessage) {
            setMessages([{
                id: 'intro',
                role: 'assistant',
                content: config.introMessage
            }]);
        } else {
            await sendMessage([], true);
        }
    };

    const sendMessage = async (currentMessages: Message[], isInitial = false) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages,
                    config,
                    currentTopicIndex,
                    effectiveDuration
                })
            });

            if (!response.ok) throw new Error('Simulation failed');

            const data = await response.json();
            const assistantText = data.content;

            // Calculate Reading Time: ~225 words per minute
            const wordCount = assistantText.split(/\s+/).length;
            const readingTimeSeconds = Math.ceil((wordCount / 225) * 60);
            setEffectiveDuration(prev => prev + readingTimeSeconds);

            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: assistantText
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (data.nextTopicIndex !== undefined && data.nextTopicIndex !== null) {
                setCurrentTopicIndex(data.nextTopicIndex);
            } else if (data.meta?.newTopicIndex !== undefined) {
                setCurrentTopicIndex(data.meta.newTopicIndex);
            }

        } catch (err) {
            console.error(err);
            // Show error in chat
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "⚠️ Si è verificato un errore nella simulazione. Riprova o modifica la configurazione."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsTyping(false);

        await sendMessage(newMessages);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // Derived state for display
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const currentQuestion = assistantMessages[assistantMessages.length - 1];
    const totalQuestions = assistantMessages.length;
    const progress = Math.min((effectiveDuration / 60 / (config.maxDurationMins || 10)) * 100, 95);

    return (
        <div className="flex flex-col h-full bg-slate-50 relative" style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FFF 100%)' }}>
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-10">
                <motion.div
                    className="h-full bg-amber-500"
                    style={{ background: 'linear-gradient(90deg, #FBBF24, #F59E0B)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Header */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-b border-gray-100 flex justify-between items-center shadow-sm z-10 relative">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{config.name || 'Anteprima Intervista'}</h3>
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium text-xs">
                                Modalità Simulatore
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                                Topic {currentTopicIndex + 1}/{config.topics.length}
                            </span>
                            <span>{Math.floor(effectiveDuration / 60)} min</span>
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>

            {/* Chat Area - CENTERED LAYOUT matching InterviewChat */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                <div className="max-w-3xl w-full pb-32"> {/* pb-32 for input area space */}
                    <AnimatePresence mode="wait">
                        {currentQuestion && (
                            <motion.div
                                key={currentQuestion.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.4 }}
                                className="space-y-6 mt-8"
                            >
                                {/* Question number */}
                                <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                                    <span>Domanda {totalQuestions}</span>
                                    <span>→</span>
                                </div>

                                {/* Previous Answer from User (if exists) */}
                                {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-8 p-6 rounded-2xl bg-white/60 backdrop-blur-sm border border-orange-100 shadow-sm"
                                    >
                                        <div className="text-xs text-amber-600 font-bold mb-2 uppercase tracking-wide">La tua risposta</div>
                                        <div className="text-gray-700 text-lg leading-relaxed font-serif">
                                            "{messages[messages.length - 2].content}"
                                        </div>
                                    </motion.div>
                                )}

                                {/* Current Question */}
                                <div className="prose prose-lg max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => {
                                                const length = String(children).length;
                                                let textSizeClass = 'text-lg md:text-xl';
                                                if (length > 300) textSizeClass = 'text-base md:text-lg';
                                                else if (length > 200) textSizeClass = 'text-lg md:text-xl';

                                                return (
                                                    <p className={`${textSizeClass} font-medium text-gray-900 leading-relaxed mb-4 tracking-tight`}>
                                                        {children}
                                                    </p>
                                                );
                                            }
                                        }}
                                    >
                                        {currentQuestion.content}
                                    </ReactMarkdown>
                                </div>
                            </motion.div>
                        )}

                        {/* Loading State */}
                        {isLoading && !currentQuestion && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-4 mt-12"
                            >
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-3 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-3 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <p className="text-gray-400 text-sm font-medium">L'IA sta pensando...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area - FIXED BOTTOM */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pb-8 bg-gradient-to-t from-white via-white/95 to-transparent pt-12 z-20">
                <div className="max-w-3xl mx-auto relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-300 to-orange-400 rounded-[20px] blur opacity-20 transition-opacity duration-500" />
                    <form onSubmit={handleSubmit} className="relative bg-white rounded-[18px] shadow-2xl flex items-end overflow-hidden transition-all ring-1 ring-black/5 focus-within:ring-amber-500/50">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (!isTyping) setIsTyping(true);
                                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                                typingIntervalRef.current = setTimeout(() => setIsTyping(false), 2000);
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder="Scrivi la tua risposta..."
                            rows={1}
                            className="w-full resize-none border-none bg-transparent px-6 py-5 pr-16 text-lg text-gray-900 placeholder-gray-400 focus:ring-0"
                            style={{
                                minHeight: '72px',
                                maxHeight: '200px',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-md"
                            style={{ background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)' }}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    </form>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400 font-medium px-2">
                        <span>Premi <strong>Invio</strong> per inviare</span>
                        <span>Domanda {totalQuestions}</span>
                    </div>

                    {/* Footer - Business Tuner Branding */}
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span>Powered by</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                                </svg>
                            </div>
                            <span className="font-semibold text-gray-600">Business Tuner</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

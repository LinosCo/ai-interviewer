'use client';

import { saveBotMessageAction } from '@/app/actions';
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
    language?: string;
    introMessage?: string | null;
    initialMessages?: Message[];
}

const TRANSLATIONS: Record<string, any> = {
    it: {
        duration: 'Durata',
        reward: 'Ricompensa',
        start: 'Inizia Intervista',
        privacy: 'Privacy Policy',
        skip: 'Puoi saltare qualsiasi domanda',
        typePlaceholder: 'Scrivi la tua risposta...',
        pressEnter: 'Premi Invio per inviare • Shift+Invio per a capo',
        question: 'Domanda',
        loading: 'Caricamento domanda...',
        aiNotice: 'Avviso AI: Stai interagendo con un sistema di intelligenza artificiale automatizzato.',
        yourAnswer: 'La tua risposta:',
        consentPrefix: 'Ho letto la ',
        consentLinkText: 'Privacy Policy',
        consentSuffix: ' e acconsento al trattamento dei miei dati per finalità di ricerca.',
        pleaseConsent: 'Devi acconsentire per continuare'
    },
    en: {
        duration: 'Duration',
        reward: 'Reward',
        start: 'Start Interview',
        privacy: 'Privacy Policy',
        skip: 'You can skip any question',
        typePlaceholder: 'Type your answer...',
        pressEnter: 'Press Enter to send • Shift+Enter for new line',
        question: 'Question',
        loading: 'Loading question...',
        aiNotice: 'AI Notice: You are interacting with an automated AI system.',
        yourAnswer: 'Your answer:',
        consentPrefix: 'I have read the ',
        consentLinkText: 'Privacy Policy',
        consentSuffix: ' and consent to the processing of my data for research purposes.',
        pleaseConsent: 'You must consent to continue'
    }
};

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
    language = 'en',
    introMessage,
    initialMessages = []
}: InterviewChatProps) {
    const t = TRANSLATIONS[language?.toLowerCase().startsWith('it') ? 'it' : 'en'];
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [hasStarted, setHasStarted] = useState(initialMessages.length > 0);
    const [showLanding, setShowLanding] = useState(initialMessages.length === 0);
    const [consentGiven, setConsentGiven] = useState(false);

    // Effective Time Tracking
    const [effectiveSeconds, setEffectiveSeconds] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Active Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((isTyping || isLoading) && hasStarted) {
            interval = setInterval(() => {
                setEffectiveSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTyping, isLoading, hasStarted]);

    const handleStart = async () => {
        setShowLanding(false);
        setHasStarted(true);
        setStartTime(Date.now());

        // If we have a custom intro message, use it immediately as the assistant's first message
        if (introMessage) {
            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: introMessage
            };
            setMessages([assistantMessage]);

            // Persist the intro message to DB so history is preserved
            try {
                await saveBotMessageAction(conversationId, introMessage);
            } catch (err) {
                console.error("Failed to save intro message", err);
            }
        } else {
            // Default behavior: trigger the AI to start
            await handleSendMessage("I'm ready to start the interview.", true);
        }
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
                    botId,
                    effectiveDuration: Math.floor(effectiveSeconds)
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to get response');
            }

            const assistantText = await response.text();

            // Calculate Reading Time: ~225 words per minute
            const wordCount = assistantText.split(/\s+/).length;
            const readingTimeSeconds = Math.ceil((wordCount / 225) * 60);
            setEffectiveSeconds(prev => prev + readingTimeSeconds);

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

    // Check for completion token whenever messages change
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.content.includes('INTERVIEW_COMPLETED')) {
            // Strip the token for display
            const cleanContent = lastMessage.content.replace('INTERVIEW_COMPLETED', '').trim();

            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: cleanContent
                };
                return newMessages;
            });

            // Redirect to claim page or show completion UI
            // For now, we rely on the link in the message, but we could auto-redirect
            if (cleanContent === '') {
                // If the message was ONLY the token, maybe show a generic "Interview Completed" or redirect immediately
            }
        }
    }, [messages]);

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
    // Use effective time for display
    const elapsedMinutes = Math.floor(effectiveSeconds / 60);

    // Calculate progress (rough estimate based on estimated duration)
    const estimatedMinutes = parseInt(estimatedDuration?.replace(/\D/g, '') || '10');
    const progress = Math.min((elapsedMinutes / estimatedMinutes) * 100, 95);

    // Show landing page first
    if (showLanding) {
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

                        {/* Duration */}
                        {estimatedDuration && (
                            <div className="bg-blue-50 rounded-lg p-4 mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-blue-900">{t.duration}</span>
                                    <span className="text-sm text-blue-700">{estimatedDuration}</span>
                                </div>
                            </div>
                        )}

                        {/* Reward Info */}
                        {rewardConfig?.enabled && rewardConfig.showOnLanding && rewardConfig.displayText && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-green-900 mb-1">{t.reward}</div>
                                        <div className="text-sm text-green-700">{rewardConfig.displayText}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Privacy & Legal Info */}
                        <div className="space-y-3 mb-8">
                            {showAnonymityInfo && (
                                <div className="text-sm text-gray-600 flex items-start gap-2">
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span>
                                        {privacyNotice || `Your responses are ${privacyLevel} and will be used for research purposes.`}
                                    </span>
                                </div>
                            )}

                            {showDataUsageInfo && dataUsageInfo && (
                                <div className="text-sm text-gray-600 flex items-start gap-2">
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{dataUsageInfo}</span>
                                </div>
                            )}
                        </div>

                        {/* AI Act Compliance Notice */}
                        <div className="text-xs text-gray-500 flex items-start gap-2 mt-4 bg-gray-50 p-2 rounded border border-gray-100">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>{t.aiNotice}</span>
                        </div>

                        {/* GDPR Active Consent Checkbox */}
                        <div className="mb-6 flex items-start gap-3">
                            <div className="flex items-center h-5">
                                <input
                                    id="consent-checkbox"
                                    type="checkbox"
                                    checked={consentGiven}
                                    onChange={(e) => setConsentGiven(e.target.checked)}
                                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                            </div>
                            <label htmlFor="consent-checkbox" className="text-sm text-gray-700 select-none cursor-pointer">
                                {t.consentPrefix}
                                <a
                                    href={`/privacy?lang=${language === 'it' ? 'it' : 'en'}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {t.consentLinkText}
                                </a>
                                {t.consentSuffix}
                            </label>
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={!consentGiven}
                            className={`w-full py-4 px-6 rounded-xl font-semibold text-white text-lg transition-all shadow-lg ${consentGiven
                                ? 'hover:scale-105 active:scale-95'
                                : 'opacity-50 cursor-not-allowed'
                                }`}
                            style={{ backgroundColor: primaryColor || '#6366f1' }}
                            title={!consentGiven ? t.pleaseConsent : ''}
                        >
                            Start Interview →
                        </button>

                        <div className="mt-6 text-center text-xs text-gray-500">
                            <a href="/privacy" className="hover:underline">{t.privacy}</a>
                            {' • '}
                            <span>{t.skip}</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

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

                                {/* Show user's last answer if exists (Rendered ABOVE current question for natural flow) */}
                                {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-8 p-4 rounded-xl bg-white/50 border border-gray-200"
                                    >
                                        <div className="text-xs text-gray-500 mb-2">{t.yourAnswer}</div>
                                        <div className="text-gray-700 italic">
                                            "{messages[messages.length - 2].content}"
                                        </div>
                                    </motion.div>
                                )}

                                {/* Question text */}
                                <div className="prose prose-lg max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => {
                                                // Helper to extract text length recursively
                                                const getTextLength = (node: React.ReactNode): number => {
                                                    if (typeof node === 'string') return node.length;
                                                    if (typeof node === 'number') return String(node).length;
                                                    if (Array.isArray(node)) return node.reduce((acc, child) => acc + getTextLength(child), 0);
                                                    if (node && typeof node === 'object' && 'props' in node && (node as any).props?.children) {
                                                        return getTextLength((node as any).props.children);
                                                    }
                                                    return 0;
                                                };

                                                const length = getTextLength(children);
                                                let textSizeClass = 'text-2xl md:text-3xl'; // Default

                                                if (length > 300) {
                                                    textSizeClass = 'text-lg md:text-xl';
                                                } else if (length > 200) {
                                                    textSizeClass = 'text-xl md:text-2xl';
                                                }

                                                return (
                                                    <p className={`${textSizeClass} font-medium text-gray-900 leading-relaxed mb-4`}>
                                                        {children}
                                                    </p>
                                                );
                                            },
                                            strong: ({ children }) => (
                                                <strong className="font-bold text-gray-900">{children}</strong>
                                            ),
                                            em: ({ children }) => (
                                                <em className="italic">{children}</em>
                                            ),
                                            a: ({ href, children }) => (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 underline hover:text-blue-800 break-all"
                                                >
                                                    {children}
                                                </a>
                                            ),

                                        }}
                                    >
                                        {currentQuestion.content}
                                    </ReactMarkdown>
                                </div>
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
                                <p className="text-gray-500 text-sm">{t.loading}</p>
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
                            onChange={(e) => {
                                setInput(e.target.value);
                                if (!isTyping) {
                                    setIsTyping(true);
                                }
                                if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                                typingIntervalRef.current = setTimeout(() => setIsTyping(false), 2000);
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            placeholder={t.typePlaceholder}
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
                        <span>{t.pressEnter}</span>
                        <span>{t.question} {totalQuestions}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

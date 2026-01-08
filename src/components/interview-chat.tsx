'use client';

import { saveBotMessageAction } from '@/app/actions';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { colors, gradients, shadows, radius } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import { SemanticProgressBar } from '@/components/chat/SemanticProgressBar';
import { WarmupQuestion } from '@/components/chat/WarmupQuestion';

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

    // Onboarding
    welcomeTitle?: string | null;
    welcomeSubtitle?: string | null;
    formatExplanation?: string | null;
    showProgressBar?: boolean;
    progressBarStyle?: string; // "semantic" | "numeric" | "minimal" | "hidden"
    showTopicPreview?: boolean;

    // Context
    topics?: { id: string; label: string; orderIndex: number }[];
    currentTopicId?: string | null;

    // Warm-up
    useWarmup?: boolean;
    warmupStyle?: string;
    warmupChoices?: any;
    warmupIcebreaker?: string | null;
    warmupContextPrompt?: string | null;
    warmupFollowup?: boolean;
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
    primaryColor = colors.amber, // Default to brand color if not set
    backgroundColor,
    rewardConfig,
    privacyNotice,
    dataUsageInfo,
    showAnonymityInfo = true,
    showDataUsageInfo = true,
    language = 'en',
    introMessage,
    initialMessages = [],

    // Onboarding defaults
    welcomeTitle,
    welcomeSubtitle,
    formatExplanation,
    showProgressBar = true,
    progressBarStyle = 'semantic',
    showTopicPreview = false,

    // Context
    topics = [],
    currentTopicId,

    // Warm-up defaults
    useWarmup = false,
    warmupStyle = 'open',
    warmupChoices,
    warmupIcebreaker,
    warmupContextPrompt,
    warmupFollowup = true
}: InterviewChatProps) {
    const t = TRANSLATIONS[language?.toLowerCase().startsWith('it') ? 'it' : 'en'];
    // State for local topic tracking
    const [activeTopicId, setActiveTopicId] = useState<string | null>(currentTopicId || (topics[0]?.id) || null);

    // Sync activeTopicId if prop changes (though mainly we update it locally)
    useEffect(() => {
        if (currentTopicId) setActiveTopicId(currentTopicId);
    }, [currentTopicId]);

    // ... (rest of the file) ...

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [hasStarted, setHasStarted] = useState(initialMessages.length > 0);
    const [showLanding, setShowLanding] = useState(initialMessages.length === 0);
    const [consentGiven, setConsentGiven] = useState(false);

    // Warm-up State
    const [showWarmup, setShowWarmup] = useState(false);
    const [warmupCompleted, setWarmupCompleted] = useState(false);

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

        // Check if we need warm-up
        if (useWarmup && warmupStyle && warmupStyle !== 'none' && !warmupCompleted && initialMessages.length === 0) {
            setShowWarmup(true);
            return;
        }

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

    const handleWarmupAnswer = async (answer: string) => {
        setShowWarmup(false);
        setWarmupCompleted(true);
        setHasStarted(true);
        setStartTime(Date.now());
        await handleSendMessage(answer, true);
    };

    const handleWarmupSkip = async () => {
        setShowWarmup(false);
        setWarmupCompleted(true);
        setHasStarted(true);
        setStartTime(Date.now());

        if (introMessage) {
            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: introMessage
            };
            setMessages([assistantMessage]);
            try { await saveBotMessageAction(conversationId, introMessage); } catch (e) { }
        } else {
            await handleSendMessage("I'm ready to start.", true);
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

            const data = await response.json();
            const assistantText = data.text || '';

            // Update Active Topic
            if (data.currentTopicId) {
                setActiveTopicId(data.currentTopicId);
            }

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

    const [isCompleted, setIsCompleted] = useState(false);

    // Check for completion token whenever messages change
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.content.includes('INTERVIEW_COMPLETED')) {
            const cleanContent = lastMessage.content.replace('INTERVIEW_COMPLETED', '').trim();
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: cleanContent
                };
                return newMessages;
            });
            setIsCompleted(true);
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
    const elapsedMinutes = Math.floor(effectiveSeconds / 60);
    const estimatedMinutes = parseInt(estimatedDuration?.replace(/\D/g, '') || '10');
    const progress = Math.min((elapsedMinutes / estimatedMinutes) * 100, 95);

    // Dynamic Background logic
    const brandColor = primaryColor || colors.amber;
    const mainBackground = backgroundColor || gradients.mesh;



    if (showWarmup) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: mainBackground }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none', background: `radial-gradient(circle at 50% 50%, ${brandColor}15 0%, transparent 70%)` }} />
                <WarmupQuestion
                    warmupStyle={warmupStyle}
                    warmupChoices={warmupChoices}
                    warmupIcebreaker={warmupIcebreaker}
                    warmupContextPrompt={warmupContextPrompt}
                    onAnswer={handleWarmupAnswer}
                    onSkip={handleWarmupSkip}
                    brandColor={brandColor}
                    language={language || 'it'}
                />
            </div>
        );
    }

    // Show landing page first
    // If new onboarding props are present, use WelcomeScreen
    if (showLanding && (welcomeTitle || formatExplanation)) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: mainBackground }}>
                <div className="bg-white/80 backdrop-blur-md p-2 rounded-3xl shadow-xl border border-white max-w-3xl w-full">
                    <WelcomeScreen
                        bot={{
                            name: botName,
                            logoUrl: logoUrl,
                            welcomeTitle,
                            welcomeSubtitle,
                            description: botDescription,
                            formatExplanation,
                            maxDurationMins: estimatedMinutes
                        }}
                        onStart={handleStart}
                        brandColor={brandColor}
                    />
                </div>
            </div>
        );
    }

    // Fallback to existing landing if no new props provided (backward compatibility)
    if (showLanding) {
        // ... existing code ...
        return (
            <div
                className="min-h-screen flex items-center justify-center p-4 relative"
                style={{
                    background: mainBackground,
                    fontFamily: "'Inter', sans-serif"
                }}
            >
                {/* ... existing landing content ... */}
                {/* To keep diff small, I won't delete the existing code in this block, just return it. */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8) 0%, transparent 70%)' }} />

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full max-w-2xl relative z-10"
                >
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.75)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                        borderRadius: radius['3xl'],
                        boxShadow: shadows.lg,
                        padding: '3rem'
                    }}>
                        {logoUrl && (
                            <div className="flex justify-center mb-8">
                                <img src={logoUrl} alt={botName} className="h-20 object-contain drop-shadow-sm" />
                            </div>
                        )}

                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4 tracking-tight">
                            {botName}
                        </h1>

                        {botDescription && (
                            <p className="text-lg text-gray-600 text-center mb-10 leading-relaxed">
                                {botDescription}
                            </p>
                        )}

                        {/* Info Pills */}
                        <div className="flex flex-wrap justify-center gap-4 mb-10">
                            {estimatedDuration && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-full border border-stone-100 text-stone-800 text-sm font-medium">
                                    <Icons.Play size={16} /> {estimatedDuration}
                                </div>
                            )}

                            {rewardConfig?.enabled && rewardConfig.showOnLanding && rewardConfig.displayText && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-800 text-sm font-medium">
                                    <Icons.Gift size={16} /> {rewardConfig.displayText}
                                </div>
                            )}
                        </div>

                        {/* Privacy & Legal Info */}
                        <div className="space-y-4 mb-8 p-6 bg-white/50 rounded-2xl border border-white/50">
                            {showAnonymityInfo && (
                                <div className="text-sm text-gray-600 flex items-start gap-3">
                                    <Icons.Shield size={18} className="text-gray-400 mt-0.5" />
                                    <span>
                                        {privacyNotice || `Your responses are ${privacyLevel} and will be used for research purposes.`}
                                    </span>
                                </div>
                            )}

                            {showDataUsageInfo && dataUsageInfo && (
                                <div className="text-sm text-gray-600 flex items-start gap-3">
                                    <Icons.Database size={18} className="text-gray-400 mt-0.5" />
                                    <span>{dataUsageInfo}</span>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 flex items-start gap-3 pt-2 border-t border-gray-100/50">
                                <Icons.Zap size={16} style={{ color: brandColor }} className="mt-0.5" />
                                <span>{t.aiNotice}</span>
                            </div>
                        </div>

                        {/* GDPR Active Consent Checkbox */}
                        <div className="mb-8 flex items-start gap-3 p-2">
                            <input
                                id="consent-checkbox"
                                type="checkbox"
                                checked={consentGiven}
                                onChange={(e) => setConsentGiven(e.target.checked)}
                                style={{ accentColor: brandColor }}
                                className="w-5 h-5 mt-0.5 cursor-pointer rounded border-gray-300"
                            />
                            <label htmlFor="consent-checkbox" className="text-sm text-gray-700 select-none cursor-pointer leading-normal">
                                {t.consentPrefix}
                                <a
                                    href={`/privacy?lang=${language === 'it' ? 'it' : 'en'}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: brandColor }}
                                    className="font-medium hover:underline"
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
                            className={`w-full py-4 px-8 rounded-full font-bold text-white text-lg transition-all shadow-xl relative overflow-hidden group ${!consentGiven ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                            style={{
                                background: consentGiven ? brandColor : '#ccc',
                                boxShadow: consentGiven ? `0 10px 30px -10px ${brandColor}60` : undefined
                            }}
                            title={!consentGiven ? t.pleaseConsent : ''}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {t.start} <Icons.ArrowRight size={20} />
                            </span>
                            {consentGiven && (
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            )}
                        </button>

                        <div className="mt-8 text-center text-xs text-gray-400 font-medium">
                            <a href="/privacy" className="hover:text-stone-900 transition-colors">{t.privacy}</a>
                            <span className="mx-2">•</span>
                            <span>{t.skip}</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex flex-col font-sans relative overflow-x-hidden"
            style={{
                background: mainBackground,
                color: colors.text
            }}
        >
            {/* Dynamic Background Elements */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none', background: `radial-gradient(circle at 80% 90%, ${brandColor}25 0%, transparent 40%)` }} />

            {/* Progress bar */}
            {showProgressBar && (
                <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-sm pt-14 pb-2">
                    <div className="max-w-7xl mx-auto px-8 md:px-12">
                        {progressBarStyle === 'semantic' && topics.length > 0 ? (
                            <SemanticProgressBar
                                progress={progress}
                                topics={topics}
                                currentTopicId={activeTopicId || (topics[0]?.id)}
                                brandColor={brandColor}
                            />
                        ) : (
                            <div className="h-1.5 bg-gray-100/50 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full relative"
                                    style={{ background: brandColor }}
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                >
                                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite]" style={{ transform: 'skewX(-20deg)' }} />
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header - Moved lower to avoid overlap with progress bar labels */}
            <header className="fixed top-28 left-0 right-0 z-50 p-6 flex items-center justify-between pointer-events-none transition-all duration-300">
                <div className="flex items-center gap-3 bg-white border border-stone-200 p-2.5 pl-3.5 pr-5 rounded-full shadow-xl pointer-events-auto transition-all hover:shadow-2xl hover:scale-105">
                    {logoUrl ? (
                        <div className="h-8 w-8 rounded-full overflow-hidden border border-stone-100 flex-shrink-0 bg-stone-50">
                            <img
                                src={logoUrl}
                                alt={botName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    // Fallback if image fails to load
                                    (e.target as any).style.display = 'none';
                                    (e.target as any).parentElement.innerHTML = `<div class="w-full h-full rounded-full flex items-center justify-center text-white" style="background: ${brandColor}">?</div>`;
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: brandColor }}>
                            <Icons.Chat size={18} />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">Sessione Live</span>
                        <span className="font-bold text-sm text-gray-900 tracking-tight truncate max-w-[200px]">{botName}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full border border-stone-200 shadow-md text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                        <Icons.Clock size={12} className="text-gray-400" />
                        <span>{elapsedMinutes}m</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-gray-400 font-medium">~{estimatedMinutes}m</span>
                    </div>
                    {privacyLevel === 'anonymous' && (
                        <div className="bg-green-50 text-[10px] font-bold text-green-600 px-3 py-1 rounded-full border border-green-100 uppercase tracking-wide">
                            Anonimo
                        </div>
                    )}
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pt-64 pb-48 w-full max-w-4xl mx-auto relative z-10">
                <AnimatePresence mode="wait">
                    {currentQuestion && (
                        <motion.div
                            key={currentQuestion.id}
                            initial={{ opacity: 0, y: 30, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.98 }}
                            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                            className="w-full max-w-2xl"
                        >
                            {/* Previous Answer Context */}
                            {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-8 ml-auto max-w-[85%]"
                                >
                                    <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl rounded-tr-sm shadow-sm text-right">
                                        <div className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: brandColor }}>{t.yourAnswer}</div>
                                        <div className="text-gray-700 font-medium leading-relaxed">
                                            "{messages[messages.length - 2].content}"
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Bot Question Card */}
                            <div className="relative">
                                {/* Decor */}
                                <div className="absolute -left-12 top-0 hidden md:block" style={{ color: brandColor, opacity: 0.3 }}>
                                    <Icons.Chat size={32} />
                                </div>

                                <div className="space-y-6">
                                    {/* Question Index */}
                                    <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-widest" style={{ color: brandColor }}>
                                        <span>{t.question} {totalQuestions}</span>
                                        <div className="h-px w-12" style={{ background: brandColor, opacity: 0.4 }} />
                                    </div>

                                    {/* Question Text */}
                                    <div className="prose prose-lg max-w-none prose-headings:font-bold prose-p:text-gray-900 prose-p:font-medium prose-a:font-semibold">
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => {
                                                    const text = String(children);
                                                    const isShort = text.length < 80;
                                                    const isLong = text.length > 200;

                                                    return (
                                                        <p className={`
                                                            ${isShort ? 'text-3xl md:text-4xl font-bold tracking-tight text-gray-900' : ''} 
                                                            ${!isShort && !isLong ? 'text-2xl md:text-3xl font-semibold text-gray-900' : ''}
                                                            ${isLong ? 'text-xl md:text-2xl font-medium text-gray-800' : ''}
                                                            leading-tight mb-6
                                                        `} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                            {children}
                                                        </p>
                                                    );
                                                },
                                                strong: ({ children }) => <span style={{ color: brandColor }}>{children}</span>,
                                                a: ({ href, children }) => <a href={href} style={{ color: brandColor }}>{children}</a>
                                            }}
                                        >
                                            {currentQuestion.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {isLoading && !currentQuestion && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-6 mt-12"
                        >
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: `${brandColor}20` }}></div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: brandColor, borderTopColor: 'transparent' }}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Icons.Logo size={24} />
                                </div>
                            </div>
                            <p className="text-gray-400 font-medium tracking-wide text-sm uppercase animate-pulse">{t.loading}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area or Completion Screen */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pb-8 bg-gradient-to-t from-white via-white/95 to-transparent pt-12">
                <div className="max-w-3xl mx-auto w-full relative">
                    {isCompleted ? (
                        <div className="bg-white rounded-[18px] shadow-2xl p-8 text-center border ring-1 ring-black/5 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                                <Icons.Check size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Intervista Completata!</h2>
                            <p className="text-gray-600 mb-6">Grazie per il tuo prezioso contributo.</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
                                style={{ background: brandColor }}
                            >
                                Nuova Intervista
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="relative group">
                            <div className="absolute -inset-1 rounded-[20px] blur opacity-20 group-focus-within:opacity-40 transition-opacity duration-500"
                                style={{ background: `linear-gradient(to right, ${brandColor}, ${brandColor}90)` }} />

                            <div className="relative bg-white rounded-[18px] shadow-2xl flex items-end overflow-hidden transition-all ring-1 ring-black/5 group-focus-within:ring-2"
                                style={{ '--tw-ring-color': `${brandColor}50` } as any}>
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        if (!isTyping) { setIsTyping(true); }
                                        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                                        typingIntervalRef.current = setTimeout(() => setIsTyping(false), 2000);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    disabled={isLoading}
                                    placeholder={t.typePlaceholder}
                                    rows={1}
                                    className="w-full resize-none border-none bg-transparent px-6 py-5 pr-16 text-lg text-gray-900 placeholder-gray-400 focus:ring-0 max-h-[200px]"
                                    style={{ minHeight: '72px' }}
                                />

                                <div className="pb-3 pr-3">
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all transform disabled:opacity-50 disabled:scale-95 disabled:shadow-none hover:scale-105 active:scale-95"
                                        style={{
                                            background: brandColor,
                                            boxShadow: `0 4px 14px 0 ${brandColor}50`
                                        }}
                                        aria-label="Send answer"
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Icons.ArrowRight size={24} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {!isCompleted && (
                        <div className="mt-4 flex items-center justify-between px-2 opacity-60 text-xs font-medium text-gray-500">
                            <span className="hidden md:inline-block">{t.pressEnter}</span>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <div className={`w-2 h-2 rounded-full ${isTyping ? 'animate-pulse' : 'bg-gray-300'}`}
                                    style={isTyping ? { background: brandColor } : undefined} />
                                <span>{isTyping ? 'Typing...' : 'Ready'}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

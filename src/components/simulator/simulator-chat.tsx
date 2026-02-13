'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, gradients, shadows } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
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

interface SimulationState {
    phase: 'INTERVIEW' | 'DATA_COLLECTION_CONSENT' | 'DATA_COLLECTION_FIELDS' | 'COMPLETED';
    consentGiven: boolean | null;
    currentFieldIndex: number;
    collectedFields: Record<string, string>;
}

export default function SimulatorChat({ config, onClose }: SimulatorChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
    const [effectiveDuration, setEffectiveDuration] = useState(0);
    const [simulationState, setSimulationState] = useState<SimulationState>({
        phase: 'INTERVIEW',
        consentGiven: null,
        currentFieldIndex: 0,
        collectedFields: {}
    });
    const [isCompleted, setIsCompleted] = useState(false);
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
                    effectiveDuration,
                    simulationState
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
            if (data.simulationState) {
                setSimulationState(data.simulationState);
            }
            if (data.isCompleted) {
                setIsCompleted(true);
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
        if (!input.trim() || isLoading || isCompleted) return;

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
        <div className="flex flex-col h-full bg-slate-50 relative" style={{ background: gradients.mesh }}>
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-10">
                <motion.div
                    className="h-full bg-amber-500"
                    style={{ background: 'linear-gradient(90deg, #E85D3B 0%, #F5A623 100%)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Header - Aligned with InterviewChat */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-b border-gray-100 flex justify-between items-center shadow-sm z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E85D3B 0%, #F5A623 100%)' }}>
                        <Icons.Chat size={20} />
                    </div>
                    <div>
                        <div className="flex flex-col">
                            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5" style={{ fontSize: '0.6rem' }}>Sessione Live Demo</span>
                            <span className="font-bold text-sm text-gray-900 tracking-tight">{config.name || 'Anteprima Intervista'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold text-[11px] shadow-sm border border-amber-100/50">
                        Topic {currentTopicIndex + 1}/{config.topics.length}
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Chat Area - CENTERED LAYOUT matching InterviewChat */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                <div className="max-w-3xl w-full pb-32">
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
                                {/* Question number indicator */}
                                <div className="flex items-center gap-2 text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                                    <span>Domanda {totalQuestions}</span>
                                    <span>•</span>
                                    <span className="text-amber-500/80">Simulator</span>
                                </div>

                                {/* Previous Answer Context */}
                                {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="ml-auto max-w-[85%] mb-8"
                                    >
                                        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl rounded-tr-sm shadow-sm text-right">
                                            <div className="text-[10px] font-black mb-1 uppercase tracking-widest text-amber-600">La tua risposta</div>
                                            <div className="text-gray-700 font-medium leading-relaxed">
                                                "{messages[messages.length - 2].content}"
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Current Question Bubble */}
                                <div className="prose prose-lg max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => {
                                                const length = String(children).length;
                                                let textSizeClass = 'text-xl md:text-2xl';
                                                if (length > 300) textSizeClass = 'text-lg md:text-xl';
                                                else if (length > 200) textSizeClass = 'text-xl md:text-2xl';

                                                return (
                                                    <p className={`${textSizeClass} font-bold text-gray-900 leading-tight mb-4 tracking-tight`}>
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
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-4 mt-12"
                            >
                                <div className="flex space-x-2">
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">L&apos;IA sta elaborando...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area - FIXED BOTTOM */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pb-8 bg-gradient-to-t from-white via-white/95 to-transparent pt-12 z-20">
                <div className="max-w-3xl mx-auto relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-300 to-orange-400 rounded-[20px] blur opacity-15 transition-opacity duration-500" />
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
                            disabled={isLoading || isCompleted}
                            placeholder={isCompleted ? "Simulazione completata" : "Scrivi la tua risposta..."}
                            rows={1}
                            className="w-full resize-none border-none bg-transparent px-6 py-5 pr-16 text-lg text-gray-900 placeholder-gray-400 focus:ring-0"
                            style={{
                                minHeight: '72px',
                                maxHeight: '200px',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading || isCompleted}
                            className="absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-md"
                            style={{ background: 'linear-gradient(135deg, #E85D3B 0%, #F5A623 100%)' }}
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
                    <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest px-2">
                        <span>{isCompleted ? 'Simulazione completata' : <>Premi <strong>Invio</strong> per inviare</>}</span>
                        <span>Domanda {totalQuestions}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

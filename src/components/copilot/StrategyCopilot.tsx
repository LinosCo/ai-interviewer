'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Lightbulb, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolsUsed?: string[];
}

interface StrategyCopilotProps {
    userTier: string;
}

const QUICK_ACTIONS = [
    { label: 'Come creo un\'intervista?', icon: Lightbulb, category: 'help' },
    { label: 'Mostra il mio utilizzo', icon: MessageSquare, category: 'account' },
];

const QUICK_ACTIONS_PRO = [
    { label: 'Riassumi le ultime conversazioni', icon: MessageSquare, category: 'data' },
    { label: 'Quali sono i temi emergenti?', icon: Lightbulb, category: 'data' },
    { label: 'Ci sono knowledge gaps?', icon: Lightbulb, category: 'data' },
];

const BASE_LOADING_STAGES = [
    'Analizzo la richiesta...',
    'Raccolgo dati dai sistemi...',
    'Organizzo i risultati...',
];

function buildLoadingStages(prompt: string): string[] {
    const normalized = prompt.toLowerCase();

    if (
        normalized.includes('connession') ||
        normalized.includes('routing') ||
        normalized.includes('mcp') ||
        normalized.includes('wordpress') ||
        normalized.includes('woocommerce') ||
        normalized.includes('n8n')
    ) {
        return [
            'Verifico connessioni e routing...',
            'Controllo stato e test tecnici...',
            'Preparo il riepilogo operativo...',
        ];
    }

    if (
        normalized.includes('tema') ||
        normalized.includes('conversaz') ||
        normalized.includes('insight') ||
        normalized.includes('intervist')
    ) {
        return [
            'Analizzo conversazioni e insight...',
            'Cerco pattern ricorrenti...',
            'Preparo le priorita suggerite...',
        ];
    }

    if (
        normalized.includes('credit') ||
        normalized.includes('utilizzo') ||
        normalized.includes('piano') ||
        normalized.includes('billing')
    ) {
        return [
            'Recupero stato piano e crediti...',
            'Verifico i dettagli di utilizzo...',
            'Preparo il riepilogo...',
        ];
    }

    return BASE_LOADING_STAGES;
}

export function StrategyCopilot({ userTier }: StrategyCopilotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingTitle, setLoadingTitle] = useState(BASE_LOADING_STAGES[0]);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const loadingStageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { selectedProject } = useProject();
    const hasProjectAccess = ['PRO', 'BUSINESS', 'ENTERPRISE', 'ADMIN', 'PARTNER'].includes(userTier.toUpperCase());

    const clearLoadingTimers = () => {
        if (loadingStageTimerRef.current) {
            clearInterval(loadingStageTimerRef.current);
            loadingStageTimerRef.current = null;
        }
        if (requestTimeoutRef.current) {
            clearTimeout(requestTimeoutRef.current);
            requestTimeoutRef.current = null;
        }
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        return () => {
            clearLoadingTimers();
        };
    }, []);

    // Welcome message
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcomeMsg = hasProjectAccess && selectedProject
                ? `Ciao! Sono lo Strategy Copilot. Sto guardando il progetto **${selectedProject.name}**.\n\nPosso aiutarti a esplorare i dati, trovare insight o creare contenuti. Oppure chiedimi come usare la piattaforma.`
                : `Ciao! Sono lo Strategy Copilot di Business Tuner.\n\nPosso aiutarti a usare la piattaforma, spiegarti le funzionalita e risolvere problemi. Cosa ti serve?`;

            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: welcomeMsg,
                timestamp: new Date()
            }]);
        }
    }, [isOpen, messages.length, hasProjectAccess, selectedProject]);

    const sendMessage = async (content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent || isLoading) return;

        setError(null);

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmedContent,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const loadingStages = buildLoadingStages(trimmedContent);
        setLoadingTitle(loadingStages[0]);
        let stageIndex = 0;
        clearLoadingTimers();
        loadingStageTimerRef.current = setInterval(() => {
            stageIndex = Math.min(stageIndex + 1, loadingStages.length - 1);
            setLoadingTitle(loadingStages[stageIndex]);
        }, 3500);

        const controller = new AbortController();
        requestTimeoutRef.current = setTimeout(() => controller.abort(), 65000);

        try {
            const res = await fetch('/api/copilot/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    message: trimmedContent,
                    history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                    projectId: selectedProject?.id !== '__ALL__' ? selectedProject?.id : null
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Errore nella risposta');
            }

            const assistantResponse = typeof data?.response === 'string'
                ? data.response
                : (typeof data?.message === 'string' ? data.message : 'Risposta non disponibile. Riprova.');

            setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date(),
                toolsUsed: data.toolsUsed
            }]);
        } catch (err: unknown) {
            const isAbort = err instanceof DOMException && err.name === 'AbortError';
            const fallbackError = err instanceof Error ? err.message : 'Si e verificato un errore. Riprova.';
            const errorMessage = isAbort
                ? 'La richiesta sta richiedendo troppo tempo. Riprova con una domanda piu specifica.'
                : fallbackError;

            setError(errorMessage);
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `Mi dispiace, c'e stato un problema: ${errorMessage}. Riprova tra poco.`,
                timestamp: new Date()
            }]);
        } finally {
            clearLoadingTimers();
            setIsLoading(false);
            setLoadingTitle(BASE_LOADING_STAGES[0]);
        }
    };

    const quickActions = hasProjectAccess
        ? [...QUICK_ACTIONS, ...QUICK_ACTIONS_PRO]
        : QUICK_ACTIONS;

    return (
        <>
            {/* Floating Bubble */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-4 md:right-6 w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center text-white hover:shadow-xl transition-shadow z-40"
                        title="Strategy Copilot"
                    >
                        <Sparkles className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-4 md:right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[min(600px,calc(100vh-6rem))] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 border border-stone-200"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Strategy Copilot</h3>
                                        <p className="text-xs text-white/80">
                                            {selectedProject && selectedProject.id !== '__ALL__'
                                                ? selectedProject.name
                                                : 'Business Tuner'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {hasProjectAccess && (!selectedProject || selectedProject.id === '__ALL__') && (
                                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Vista multi-progetto attiva: il Copilot userà tutti i progetti a cui hai accesso
                                </div>
                            )}

                            {isLoading && (
                                <div className="mt-3 bg-white/10 rounded-lg px-3 py-2 text-xs flex items-center gap-2" title={loadingTitle}>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {loadingTitle}
                                </div>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                            ? 'bg-stone-900 text-white rounded-br-md'
                                            : 'bg-white border border-stone-200 rounded-bl-md'
                                            }`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-sm prose-stone max-w-none">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ children }) => <p className="text-sm mb-2 last:mb-0">{children}</p>,
                                                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                        ul: ({ children }) => <ul className="text-sm list-disc list-inside mb-2">{children}</ul>,
                                                        ol: ({ children }) => <ol className="text-sm list-decimal list-inside mb-2">{children}</ol>,
                                                        li: ({ children }) => <li className="mb-1">{children}</li>,
                                                        code: ({ children }) => <code className="bg-stone-100 px-1 py-0.5 rounded text-xs">{children}</code>,
                                                        blockquote: ({ children }) => (
                                                            <blockquote className="border-l-2 border-amber-500 pl-3 italic text-stone-600 my-2">
                                                                {children}
                                                            </blockquote>
                                                        ),
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-3" title={loadingTitle}>
                                        <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                            <span>{loadingTitle}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Actions (only show when few messages) */}
                        {messages.length <= 1 && (
                            <div className="px-4 py-2 border-t border-stone-100 bg-white">
                                <p className="text-xs text-stone-400 mb-2">Suggerimenti</p>
                                <div className="flex flex-wrap gap-2">
                                    {quickActions.slice(0, 3).map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(action.label)}
                                            className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-full transition-colors"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-4 border-t border-stone-200 bg-white">
                            <div className="flex gap-2">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                                    placeholder="Chiedi qualcosa..."
                                    className="flex-1 px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => sendMessage(input)}
                                    disabled={isLoading || !input.trim()}
                                    className="px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {error && (
                                <p className="mt-2 text-xs text-red-600" role="alert">
                                    {error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

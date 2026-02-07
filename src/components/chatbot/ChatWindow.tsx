'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2, Bot, User, Shield, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
    companyName?: string; // For GDPR disclosure
    privacyPolicyUrl?: string;
    termsUrl?: string;
    consentText?: string;
    privacyNotice?: string;
    dataUsageInfo?: string;
    showAnonymityInfo?: boolean;
    showDataUsageInfo?: boolean;
    hostPageContext?: {
        url?: string;
        title?: string;
        description?: string;
        mainContent?: string;
    } | null;
    enablePageContext?: boolean;
}

const LEAKED_INSTRUCTION_PATTERN =
    /Acknowledge what they said|Format your output in TWO parts|Part 1:|Part 2:|\[\[LEAD_QUESTION\]\]|IMPORTANT:/i;

function sanitizeAssistantMessage(input: unknown): string {
    if (typeof input !== 'string') return '';
    const normalized = input.trim();
    if (!normalized) return '';
    if (LEAKED_INSTRUCTION_PATTERN.test(normalized)) return '';
    return normalized;
}

function sanitizePageContextValue(value: unknown, maxLen: number): string {
    if (typeof value !== 'string') return '';
    const cleaned = value
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen)}...`;
}

type ChatApiErrorPayload = {
    error?: string;
    message?: string;
    code?: string;
};

function toUserFacingError(status: number, payload: unknown): string {
    const data: ChatApiErrorPayload =
        payload && typeof payload === 'object' ? (payload as ChatApiErrorPayload) : {};

    if (status === 401 && data.error === 'API_KEY_MISSING') {
        return 'Il servizio non è configurato correttamente. Riprova tra poco.';
    }
    if (status === 403 || status === 429 || data.code === 'LIMIT_REACHED') {
        return 'Il servizio è momentaneamente non disponibile. Riprova tra qualche minuto.';
    }

    const fromBackend = typeof data.message === 'string' ? data.message : data.error;
    if (typeof fromBackend === 'string' && fromBackend.trim()) {
        return fromBackend.trim();
    }

    return 'Mi dispiace, si è verificato un errore. Riprova più tardi.';
}

// GDPR Consent Welcome Screen Component
function GDPRWelcomeScreen({
    botName,
    companyName,
    primaryColor,
    privacyPolicyUrl,
    termsUrl,
    consentText,
    privacyNotice,
    dataUsageInfo,
    showAnonymityInfo,
    showDataUsageInfo,
    onAccept,
    onClose
}: {
    botName: string;
    companyName: string;
    primaryColor: string;
    privacyPolicyUrl: string;
    termsUrl: string;
    consentText?: string;
    privacyNotice?: string;
    dataUsageInfo?: string;
    showAnonymityInfo?: boolean;
    showDataUsageInfo?: boolean;
    onAccept: (marketingConsent: boolean) => void;
    onClose: () => void;
}) {
    const [dataConsent, setDataConsent] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);

    return (
        <div className="flex flex-col h-full">
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
                            <Shield className="w-3 h-3" />
                            <span className="text-xs font-medium">Assistente AI</span>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
                    {/* AI Disclosure */}
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: primaryColor }}>
                            <Bot className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">Stai parlando con un assistente AI</p>
                            <p className="text-xs text-gray-600 mt-1">
                                Questo è un chatbot basato su intelligenza artificiale, non un operatore umano.
                            </p>
                        </div>
                    </div>

                    {/* Welcome */}
                    <div>
                        <h4 className="font-bold text-gray-900 mb-2">Benvenuto!</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            Prima di iniziare la conversazione, ti chiediamo di leggere e accettare le seguenti informazioni sul trattamento dei tuoi dati.
                        </p>
                    </div>

                    {/* Data Processing Info */}
                    <div className="space-y-4">
                        {(showAnonymityInfo ?? true) && (
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <h5 className="font-semibold text-gray-800 text-sm mb-2">📋 Conservazione della conversazione</h5>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {privacyNotice || 'La tua conversazione verrà conservata in forma anonima per migliorare il servizio e analizzare le domande frequenti. I dati anonimi vengono conservati per massimo 90 giorni.'}
                                </p>
                            </div>
                        )}

                        {(showDataUsageInfo ?? true) && (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <h5 className="font-semibold text-amber-800 text-sm mb-2">👤 Dati personali (opzionale)</h5>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    {dataUsageInfo || 'Se durante la conversazione sceglierai di fornire dati personali (nome, email, telefono) per essere ricontattato, questi verranno conservati e trattati secondo il GDPR e la nostra Privacy Policy. Potrai richiederne la modifica o cancellazione in qualsiasi momento.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Consent Checkboxes */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={dataConsent}
                                onChange={(e) => setDataConsent(e.target.checked)}
                                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">
                                {consentText || 'Acconsento alla conservazione e al trattamento dei dati della conversazione come descritto sopra.'} <span className="text-red-500">*</span>
                            </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={marketingConsent}
                                onChange={(e) => setMarketingConsent(e.target.checked)}
                                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                style={{ accentColor: primaryColor }}
                            />
                            <span className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900">
                                Desidero ricevere comunicazioni commerciali (opzionale)
                            </span>
                        </label>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-4 pt-2 text-xs">
                        <a
                            href={privacyPolicyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors underline"
                        >
                            Privacy Policy <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                            href={termsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors underline"
                        >
                            Termini di Servizio <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Data Controller Info */}
                    <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                        <p>
                            <strong>Titolare del trattamento:</strong> {companyName}. Per esercitare i tuoi diritti (accesso, rettifica, cancellazione) contatta il supporto.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer with Accept Button */}
            <div className="p-4 border-t bg-white">
                <button
                    onClick={() => onAccept(marketingConsent)}
                    disabled={!dataConsent}
                    className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all ${dataConsent
                            ? 'text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    style={dataConsent ? { backgroundColor: primaryColor } : {}}
                >
                    {dataConsent ? 'Inizia la conversazione' : 'Accetta per continuare'}
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                    Puoi ritirare il consenso in qualsiasi momento
                </p>
            </div>
        </div>
    );
}

export default function ChatWindow({
    isOpen,
    onClose,
    botName,
    primaryColor = '#7C3AED',
    welcomeMessage,
    botId,
    companyName = 'Business Tuner',
    privacyPolicyUrl = '/privacy',
    termsUrl = '/terms',
    consentText,
    privacyNotice,
    dataUsageInfo,
    showAnonymityInfo = true,
    showDataUsageInfo = true,
    hostPageContext = null,
    enablePageContext = true
}: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [conversationId, setConversationId] = useState<string | null>(null);

    // GDPR Consent State
    const [hasConsented, setHasConsented] = useState(false);
    const [marketingConsent, setMarketingConsentState] = useState(false);

    // Check for existing consent on mount
    useEffect(() => {
        const consentKey = `bt_consent_${botId}`;
        const existingConsent = localStorage.getItem(consentKey);
        if (existingConsent) {
            try {
                const consent = JSON.parse(existingConsent);
                // Consent is valid for 365 days
                if (consent.timestamp && Date.now() - consent.timestamp < 365 * 24 * 60 * 60 * 1000) {
                    setHasConsented(true);
                    setMarketingConsentState(consent.marketing || false);
                }
            } catch {
                // Invalid consent, require new one
            }
        }
    }, [botId]);

    // Handle consent acceptance
    const handleConsentAccept = (marketing: boolean) => {
        const consentKey = `bt_consent_${botId}`;
        const consentData = {
            timestamp: Date.now(),
            data: true,
            marketing
        };
        localStorage.setItem(consentKey, JSON.stringify(consentData));
        setHasConsented(true);
        setMarketingConsentState(marketing);
    };

    // Initial conversation start - only after consent
    useEffect(() => {
        const initChat = async () => {
            if (conversationId || !hasConsented) return;

            try {
                // Generate or retrieve session ID
                let sessionId = localStorage.getItem('bt_sid');
                if (!sessionId) {
                    sessionId = 's_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('bt_sid', sessionId);
                }

                const fallbackDescription =
                    document.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute('content') || '';
                const fallbackContext = {
                    url: window.parent !== window && document.referrer ? document.referrer : window.location.href,
                    title: document.title || '',
                    description: fallbackDescription,
                    mainContent: ''
                };

                const resolvedContext = {
                    url: sanitizePageContextValue(hostPageContext?.url || fallbackContext.url, 700),
                    title: sanitizePageContextValue(hostPageContext?.title || fallbackContext.title, 400),
                    description: sanitizePageContextValue(hostPageContext?.description || fallbackContext.description, 800),
                    mainContent: sanitizePageContextValue(hostPageContext?.mainContent || fallbackContext.mainContent, 3500)
                };

                const res = await fetch('/api/chatbot/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        botId,
                        sessionId,
                        pageContext: enablePageContext ? resolvedContext : undefined,
                        gdprConsent: {
                            data: true,
                            marketing: marketingConsent,
                            timestamp: Date.now()
                        }
                    })
                });

                if (!res.ok) throw new Error('Failed to start chat');
                const data = await res.json();
                setConversationId(data.conversationId);

                // Only set welcome message if we don't have messages yet
                const initialGreeting = sanitizeAssistantMessage(data.welcomeMessage) || sanitizeAssistantMessage(welcomeMessage);
                if (initialGreeting && messages.length === 0) {
                    setMessages([
                        {
                            id: 'welcome',
                            role: 'assistant',
                            content: initialGreeting,
                            timestamp: new Date()
                        }
                    ]);
                }
            } catch (err) {
                console.error('Failed to init chat:', err);
            }
        };

        if (isOpen && hasConsented) {
            initChat();
        }
    }, [isOpen, botId, conversationId, messages.length, hasConsented, marketingConsent, hostPageContext, enablePageContext, welcomeMessage]);

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

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(toUserFacingError(res.status, data));
            }

            // Add bot response(s)
            if (Array.isArray(data.responses) && data.responses.length > 0) {
                const sanitized = data.responses
                    .map((content: string) => sanitizeAssistantMessage(content))
                    .filter(Boolean);
                const safeResponses = sanitized.length > 0
                    ? sanitized
                    : ['Grazie, continuo subito ad aiutarti. Potresti riprovare con la tua richiesta?'];

                setMessages(prev => [
                    ...prev,
                    ...safeResponses.map((content: string, idx: number) => ({
                        id: `${Date.now()}_${idx}`,
                        role: 'assistant' as const,
                        content,
                        timestamp: new Date()
                    }))
                ]);
            } else {
                const content = sanitizeAssistantMessage(data?.response || data?.message)
                    || 'Grazie, continuo subito ad aiutarti. Potresti riprovare con la tua richiesta?';
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content,
                        timestamp: new Date()
                    }
                ]);
            }

        } catch (err) {
            console.error(err);
            // Add error message
            const errorMessage = err instanceof Error && err.message
                ? err.message
                : 'Mi dispiace, si è verificato un errore. Riprova più tardi.';
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: errorMessage,
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
                    className="fixed bottom-0 right-0 sm:bottom-24 sm:right-6 w-full sm:w-96 sm:max-w-[calc(100vw-48px)] h-full sm:h-[600px] sm:max-h-[calc(100vh-120px)] bg-white sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200 z-[9999] flex flex-col font-sans"
                >
                    {/* GDPR Welcome Screen - shown before consent */}
                    {!hasConsented ? (
                        <GDPRWelcomeScreen
                            botName={botName}
                            companyName={companyName}
                            primaryColor={primaryColor}
                            privacyPolicyUrl={privacyPolicyUrl}
                            termsUrl={termsUrl}
                            consentText={consentText}
                            privacyNotice={privacyNotice}
                            dataUsageInfo={dataUsageInfo}
                            showAnonymityInfo={showAnonymityInfo}
                            showDataUsageInfo={showDataUsageInfo}
                            onAccept={handleConsentAccept}
                            onClose={onClose}
                        />
                    ) : (
                        <>
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
                        {messages.map((msg) => (
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
                                        <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''} 
                                            prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-strong:font-bold prose-ul:list-disc prose-ol:list-decimal`}>
                                            <ReactMarkdown>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
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
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

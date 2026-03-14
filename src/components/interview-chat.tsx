'use client';

import { saveBotMessageAction } from '@/app/actions';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { colors, gradients, shadows, radius } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import { SemanticProgressBar } from '@/components/chat/SemanticProgressBar';
import { WarmupQuestion } from '@/components/chat/WarmupQuestion';
import { StructuredInterviewInput } from '@/components/chat/StructuredInterviewInput';
import type { InterviewInteractionPayload, StructuredInterviewSubmission } from '@/lib/interview/structured-interactions';
import { getStructuredSubmissionDisplayText } from '@/lib/interview/structured-interactions';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    interactionPayload?: InterviewInteractionPayload | null;
    replyToClientMessageId?: string | null;
    latencyMetrics?: {
        clientTurnLatencyMs?: number | null;
        serverTurnLatencyMs?: number | null;
    } | null;
}

interface ChatApiResponse {
    text: string;
    currentTopicId?: string | null;
    isCompleted: boolean;
    degraded?: boolean;
    error?: string;
    interactionPayload?: InterviewInteractionPayload | null;
    serverResponseLatencyMs?: number | null;
    phase?: string | null;
    candidateProfile?: Record<string, unknown> | null;
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
        payload?: string;
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
    skipWelcome?: boolean;
    isEmbedded?: boolean;
}

function toUserFacingInterviewError(status: number, payload: unknown, language?: string): string {
    const isItalian = (language || 'it').toLowerCase().startsWith('it');
    const fallback = isItalian
        ? 'Intervista temporaneamente non disponibile. Riprova tra poco.'
        : 'Interview temporarily unavailable. Please try again shortly.';

    if (!payload || typeof payload !== 'object') return fallback;
    const data = payload as Record<string, unknown>;
    const code = typeof data.code === 'string' ? data.code : '';

    if (code === 'ACCESS_DENIED' || status === 401 || status === 403) {
        return isItalian
            ? 'Intervista non disponibile per limiti di accesso o crediti. Riprova più tardi.'
            : 'Interview unavailable due to access or credit limits. Please try again later.';
    }

    return fallback;
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
    warmupFollowup = true,
    skipWelcome = false,
    isEmbedded = false
}: InterviewChatProps) {
    const router = useRouter();
    const t = TRANSLATIONS[language?.toLowerCase().startsWith('it') ? 'it' : 'en'];
    // State for local topic tracking
    const [activeTopicId, setActiveTopicId] = useState<string | null>(currentTopicId || (topics[0]?.id) || null);

    // Sync activeTopicId if prop changes (though mainly we update it locally)
    useEffect(() => {
        if (currentTopicId) setActiveTopicId(currentTopicId);
    }, [currentTopicId]);

    // ... (rest of the file) ...

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const messagesRef = useRef<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [hasStarted, setHasStarted] = useState(initialMessages.length > 0 || skipWelcome);
    const [showLanding, setShowLanding] = useState(initialMessages.length === 0 && !skipWelcome);
    const [consentGiven, setConsentGiven] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);
    const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
    const [visualViewportWidth, setVisualViewportWidth] = useState<number | null>(null);
    const [footerHeight, setFooterHeight] = useState(isEmbedded ? 96 : 148);
    const chatViewportRef = useRef<HTMLDivElement>(null);
    const questionCardRef = useRef<HTMLDivElement>(null);
    const dockedQuestionContentRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const visualViewportRestHeightRef = useRef<number | null>(null);

    // Warm-up State
    const [showWarmup, setShowWarmup] = useState(false);
    const [warmupCompleted, setWarmupCompleted] = useState(false);

    // Auto-start for welcome message if skipping landing
    useEffect(() => {
        if (skipWelcome && initialMessages.length === 0 && messages.length === 0 && !showLanding) {
            handleStart();
        }
    }, [skipWelcome, initialMessages.length, messages.length]);

    // Effective Time Tracking
    const [effectiveSeconds, setEffectiveSeconds] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showCompletionActions, setShowCompletionActions] = useState(false);
    const inFlightRequestRef = useRef(false);
    const keyboardAnchorTimersRef = useRef<number[]>([]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!isCompleted) {
            setShowCompletionActions(false);
            return;
        }
        const timer = setTimeout(() => setShowCompletionActions(true), 2200);
        return () => clearTimeout(timer);
    }, [isCompleted]);

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

    useEffect(() => {
        if (typeof window === 'undefined' || isEmbedded) return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        const handleViewportChange = () => {
            const viewportHeight = Math.round(viewport.height);
            const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
            const normalizedInset = inset > 96 ? inset : 0;

            if (!isInputFocused && normalizedInset === 0) {
                visualViewportRestHeightRef.current = viewportHeight;
            }

            setMobileKeyboardInset(normalizedInset);
            setVisualViewportHeight(viewportHeight);
            setVisualViewportWidth(Math.round(viewport.width));

            const restHeight = visualViewportRestHeightRef.current;
            const heightDrop = restHeight ? Math.max(0, restHeight - viewportHeight) : 0;
            const keyboardLikelyOpen = isInputFocused && (normalizedInset > 0 || heightDrop > 120);

            if (keyboardLikelyOpen) {
                requestAnimationFrame(() => scheduleKeyboardAnchoring());
            }
        };

        handleViewportChange();
        viewport.addEventListener('resize', handleViewportChange);
        viewport.addEventListener('scroll', handleViewportChange);

        return () => {
            viewport.removeEventListener('resize', handleViewportChange);
            viewport.removeEventListener('scroll', handleViewportChange);
        };
    }, [isEmbedded]);

    useEffect(() => {
        if (typeof window === 'undefined' || isEmbedded) return;
        const footerEl = footerRef.current;
        if (!footerEl) return;

        const updateFooterHeight = () => {
            const rect = footerEl.getBoundingClientRect();
            setFooterHeight(Math.round(rect.height));
        };

        updateFooterHeight();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateFooterHeight);
            return () => window.removeEventListener('resize', updateFooterHeight);
        }

        const observer = new ResizeObserver(() => updateFooterHeight());
        observer.observe(footerEl);
        window.addEventListener('resize', updateFooterHeight);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateFooterHeight);
        };
    }, [isEmbedded, isCompleted, isLoading, input, language, showCompletionActions]);

    const handleStart = async () => {
        setShowLanding(false);

        // Check if we need warm-up
        if (useWarmup && warmupStyle && warmupStyle !== 'none' && !warmupCompleted && initialMessages.length === 0) {
            setShowWarmup(true);
            return;
        }

        setHasStarted(true);
        setStartTime(Date.now());

        if (introMessage) {
            // Show intro immediately
            const introMsgObj: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: introMessage
            };
            setMessages([introMsgObj]);

            try {
                // Save it to DB so the AI sees it in history when the user eventually responds
                await saveBotMessageAction(conversationId, introMessage);
                // DO NOT trigger handleSendMessage here. 
                // The introMessage IS the first question/turn. We wait for user input.
            } catch (err) {
                console.error("Intro Saving Error", err);
            }
        } else {
            // Default behavior
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
            const introMsgObj: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: introMessage
            };
            setMessages([introMsgObj]);
            try {
                await saveBotMessageAction(conversationId, introMessage);
                // DO NOT trigger handleSendMessage. Wait for user.
            } catch (e) { }
        } else {
            await handleSendMessage("I'm ready to start.", true);
        }
    };

    const resizeRafRef = useRef<number | null>(null);
    const lastTextareaHeightRef = useRef<number | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const INPUT_MAX_HEIGHT_PX = 280;

    // Auto-resize textarea function (deferred to next frame to avoid blocking input)
    const autoResizeTextarea = () => {
        if (!inputRef.current) return;
        if (resizeRafRef.current) {
            cancelAnimationFrame(resizeRafRef.current);
        }
        resizeRafRef.current = requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            el.style.height = 'auto';
            const nextHeight = Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX);
            el.style.height = `${nextHeight}px`;
            lastTextareaHeightRef.current = nextHeight;
            if (isInputFocused) {
                requestAnimationFrame(() => scheduleKeyboardAnchoring());
            }
        });
    };

    // Auto-focus input when question changes
    useEffect(() => {
        if (inputRef.current && !isLoading) {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                inputRef.current?.focus();
                autoResizeTextarea();
            }, 100);
        }
    }, [currentQuestionIndex, isLoading]);

    // Auto-resize on input change
    useEffect(() => {
        autoResizeTextarea();
        return () => {
            if (resizeRafRef.current) {
                cancelAnimationFrame(resizeRafRef.current);
                resizeRafRef.current = null;
            }
        };
    }, [input]);

    // Typing indicator debounce (avoid heavy work in onChange)
    useEffect(() => {
        if (!input) {
            setIsTyping(false);
            return;
        }
        setIsTyping(true);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [input]);

    const handleSendMessage = async (
        messageContent: string,
        isInitial = false,
        overrideHistory?: Message[],
        structuredSubmission?: StructuredInterviewSubmission
    ) => {
        if ((!messageContent.trim() || isLoading || inFlightRequestRef.current) && !isInitial) return;
        if (inFlightRequestRef.current) return;

        // If isInitial=true and we have overrideHistory (intro), we DON'T add a user message to UI
        // We just use 'messageContent' as a hidden trigger for the AI

        const isHiddenTrigger = isInitial && overrideHistory && overrideHistory.length > 0;

        const userMessageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const userMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: messageContent
        };

        if (!isInitial && !isHiddenTrigger) {
            setMessages(prev => [...prev, userMessage]);
        }

        if (!isHiddenTrigger) {
            setInput('');
        }

        setIsLoading(true);
        inFlightRequestRef.current = true;
        const requestStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

        try {
            // Construct payload
            // If isHiddenTrigger, we send [overrideHistory..., userMessage(hidden)]

            let messagesPayload: Message[];
            if (isHiddenTrigger && overrideHistory) {
                // Intro (Assistant) -> User (Hidden "I am ready")
                messagesPayload = [...overrideHistory, userMessage];
            } else if (isInitial) {
                messagesPayload = [];
            } else {
                messagesPayload = [...messagesRef.current, userMessage];
            }

            const requestClientMessageId = (!isInitial || isHiddenTrigger) ? userMessage.id : undefined;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesPayload,
                    conversationId,
                    botId,
                    effectiveDuration: Math.floor(effectiveSeconds),
                    clientMessageId: requestClientMessageId,
                    structuredSubmission
                })
            });

            if (!response.ok) {
                let payload: unknown = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }
                throw new Error(toUserFacingInterviewError(response.status, payload, language));
            }

            const contentType = response.headers.get('Content-Type') || '';
            const isSSE = contentType.includes('text/event-stream');

            let assistantText = '';
            let data: Partial<ChatApiResponse> = {};

            if (isSSE && response.body) {
                // SSE streaming path: read chunks, accumulate text, get metadata from final event
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    // Process complete SSE lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? ''; // keep incomplete line in buffer
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        try {
                            const event = JSON.parse(jsonStr);
                            if (event.t !== undefined) {
                                // Text chunk
                                assistantText += event.t;
                            } else if (event.done) {
                                // Final metadata
                                data = {
                                    text: assistantText,
                                    isCompleted: event.isCompleted ?? false,
                                    currentTopicId: event.currentTopicId ?? null,
                                    phase: event.phase ?? null,
                                    candidateProfile: event.candidateProfile ?? {},
                                    interactionPayload: event.interactionPayload ?? null,
                                    serverResponseLatencyMs: event.serverResponseLatencyMs ?? null,
                                };
                            }
                        } catch {
                            // ignore malformed SSE event
                        }
                    }
                }
                if (!data.text) {
                    data.text = assistantText;
                    data.isCompleted = data.isCompleted ?? false;
                }
            } else {
                // Non-streaming path (DATA_COLLECTION, timeouts, etc.)
                data = await response.json();
                assistantText = data.text || '';
            }

            if (data.isCompleted || assistantText.includes('INTERVIEW_COMPLETED')) {
                setIsCompleted(true);
            }

            // Update Active Topic
            if (data.currentTopicId) {
                setActiveTopicId(data.currentTopicId);
            }

            // Calculate Reading Time
            const wordCount = assistantText.split(/\s+/).length;
            const readingTimeSeconds = Math.ceil((wordCount / 225) * 60);
            setEffectiveSeconds(prev => prev + readingTimeSeconds);

            const assistantMessage: Message = {
                id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                    ? crypto.randomUUID()
                    : Date.now().toString(),
                role: 'assistant',
                content: assistantText,
                interactionPayload: data.interactionPayload ?? null,
                replyToClientMessageId: requestClientMessageId ?? null,
                latencyMetrics: {
                    clientTurnLatencyMs: null,
                    serverTurnLatencyMs: data.serverResponseLatencyMs ?? null
                }
            };

            setMessages(prev => [...prev, assistantMessage]);
            setCurrentQuestionIndex(prev => prev + 1);

            if (typeof window !== 'undefined') {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
                        const clientTurnLatencyMs = Math.round(endedAt - requestStartedAt);
                        setMessages(prev => prev.map(message =>
                            message.id === assistantMessage.id
                                ? {
                                    ...message,
                                    latencyMetrics: {
                                        ...(message.latencyMetrics || {}),
                                        clientTurnLatencyMs
                                    }
                                }
                                : message
                        ));
                    });
                });
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: error.message || 'Sorry, there was an error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
            inFlightRequestRef.current = false;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    const handleStructuredSubmit = (submission: StructuredInterviewSubmission) => {
        const displayText = getStructuredSubmissionDisplayText(submission, language);
        handleSendMessage(displayText, false, undefined, submission);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(input);
        }
    };

    // Get current question (last assistant message)
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const currentQuestion = assistantMessages[assistantMessages.length - 1];
    const currentInteraction = currentQuestion?.interactionPayload ?? null;
    const currentQuestionId = currentQuestion?.id || null;
    const totalQuestions = assistantMessages.length;
    const elapsedMinutes = Math.floor(effectiveSeconds / 60);
    const estimatedMinutes = parseInt(estimatedDuration?.replace(/\D/g, '') || '10');
    const progress = Math.min((elapsedMinutes / estimatedMinutes) * 100, 95);
    const supportsVisualViewport = typeof window !== 'undefined' && Boolean(window.visualViewport);
    const effectiveViewportHeight = !isEmbedded && visualViewportHeight ? Math.round(visualViewportHeight) : null;
    const effectiveViewportWidth = !isEmbedded
        ? (visualViewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : null))
        : null;
    const isMobileViewport = Boolean(effectiveViewportWidth && effectiveViewportWidth < 768);
    const visualViewportHeightDrop = visualViewportHeight && visualViewportRestHeightRef.current
        ? Math.max(0, visualViewportRestHeightRef.current - visualViewportHeight)
        : 0;
    const keyboardHeightGuess = Math.max(mobileKeyboardInset, visualViewportHeightDrop);
    const anchorQuestionNearComposer = (behavior: ScrollBehavior = 'auto') => {
        const viewportEl = chatViewportRef.current;
        const cardEl = questionCardRef.current;
        if (!viewportEl || !cardEl) return;
        const questionAnchorOffsetPx = footerHeight + 20;
        const targetTop = Math.max(
            0,
            cardEl.offsetTop + cardEl.offsetHeight - viewportEl.clientHeight + questionAnchorOffsetPx
        );
        viewportEl.scrollTo({ top: targetTop, behavior });
    };

    const scheduleKeyboardAnchoring = () => {
        keyboardAnchorTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
        anchorQuestionNearComposer('auto');
        keyboardAnchorTimersRef.current = [60, 180, 340, 560].map((delay, index) =>
            window.setTimeout(() => anchorQuestionNearComposer(index === 0 ? 'auto' : 'smooth'), delay)
        );
    };

    useEffect(() => {
        if (!currentQuestionId || !chatViewportRef.current || !questionCardRef.current) return;
        if (!isInputFocused || (!keyboardHeightGuess && supportsVisualViewport)) return;
        const timer = window.setTimeout(() => {
            scheduleKeyboardAnchoring();
        }, 120);
        return () => window.clearTimeout(timer);
    }, [currentQuestionId, footerHeight, isInputFocused, supportsVisualViewport, keyboardHeightGuess]);

    // Dynamic Background logic
    const brandColor = primaryColor || colors.amber;
    const mainBackground = backgroundColor || gradients.mesh;
    const isMobileKeyboardOpen = !isEmbedded && isInputFocused && (keyboardHeightGuess > 120 || !supportsVisualViewport);
    const chatVerticalAlignClass = isMobileKeyboardOpen ? 'justify-end md:justify-center' : 'justify-center';
    const chatTopPaddingClass = isEmbedded
        ? 'pt-16'
        : isMobileKeyboardOpen
            ? 'pt-14 md:pt-40'
            : 'pt-32 md:pt-40';
    const inputTopPaddingClass = isEmbedded
        ? 'pt-4'
        : isMobileKeyboardOpen
            ? 'pt-1 md:pt-12'
            : 'pt-8 md:pt-12';
    const footerBottomOffsetPx = isEmbedded ? 0 : (supportsVisualViewport ? 0 : keyboardHeightGuess);
    const chatBottomPaddingPx = isEmbedded
        ? footerHeight
        : footerHeight + (isMobileKeyboardOpen ? 18 : 34);
    const questionScrollMarginBottomPx = footerHeight + (isMobileKeyboardOpen ? 20 : 28);
    const showDockedQuestion = isMobileViewport && isInputFocused && Boolean(currentQuestion) && !isCompleted;
    const dockedQuestionMaxHeightPx = effectiveViewportHeight
        ? Math.max(120, Math.min(280, Math.round(effectiveViewportHeight * 0.32)))
        : 220;
    const dockedQuestionCompactText = dockedQuestionMaxHeightPx <= 170;
    const questionSpacingClass = isMobileKeyboardOpen ? 'space-y-4 md:space-y-6' : 'space-y-6';

    useEffect(() => {
        if (!isMobileKeyboardOpen) return;
        const timer = window.setTimeout(() => {
            scheduleKeyboardAnchoring();
        }, 80);
        return () => window.clearTimeout(timer);
    }, [footerHeight, isMobileKeyboardOpen]);

    useEffect(() => {
        return () => {
            keyboardAnchorTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            keyboardAnchorTimersRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!showDockedQuestion) return;
        const timer = window.setTimeout(() => {
            const contentEl = dockedQuestionContentRef.current;
            if (!contentEl) return;
            contentEl.scrollTop = contentEl.scrollHeight;
        }, 50);
        return () => window.clearTimeout(timer);
    }, [currentQuestionId, dockedQuestionMaxHeightPx, showDockedQuestion]);

    const renderQuestionCard = (docked = false) => {
        if (!currentQuestion) return null;
        return (
            <motion.div
                key={`${currentQuestion.id}-${docked ? 'docked' : 'flow'}`}
                initial={{ opacity: 0, y: 20, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className={`w-full max-w-2xl ${!docked && isMobileKeyboardOpen ? 'mt-auto' : ''}`}
                style={docked ? undefined : { scrollMarginBottom: `${questionScrollMarginBottomPx}px` }}
                ref={docked ? undefined : questionCardRef}
            >
                <div className={`relative ${docked ? 'rounded-[24px] bg-white/92 px-5 py-4 shadow-2xl ring-1 ring-black/5 backdrop-blur-md' : ''}`}>
                    {!docked && (
                        <div className="absolute -left-12 top-0 hidden md:block" style={{ color: brandColor, opacity: 0.3 }}>
                            <Icons.Chat size={32} />
                        </div>
                    )}

                    <div className={docked ? 'space-y-3' : questionSpacingClass}>
                        <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-widest" style={{ color: brandColor }}>
                            <span>{t.question} {totalQuestions}</span>
                            <div className="h-px w-12" style={{ background: brandColor, opacity: 0.4 }} />
                        </div>

                        <div
                            ref={docked ? dockedQuestionContentRef : undefined}
                            className={`prose max-w-none prose-headings:font-bold prose-p:text-gray-900 prose-p:font-medium prose-a:font-semibold ${docked ? 'prose-base overflow-y-auto overscroll-contain pr-1' : 'prose-lg'}`}
                            style={docked ? { maxHeight: `${dockedQuestionMaxHeightPx}px` } : undefined}
                        >
                            <ReactMarkdown
                                components={{
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-gray-200 pl-4 py-2 my-4 text-gray-500 bg-gray-50 rounded-r-lg italic [&>p]:!text-base [&>p]:!font-medium [&>p]:!text-gray-500 [&>p]:!mb-0">
                                            {children}
                                        </blockquote>
                                    ),
                                    p: ({ children }) => {
                                        const text = String(children);
                                        const isShort = text.length < 80;
                                        const isLong = text.length > 200;

                                        return (
                                            <p className={`
                                                ${isShort ? (docked && dockedQuestionCompactText ? 'text-base font-semibold text-gray-900' : 'text-lg md:text-xl font-semibold text-gray-900') : ''}
                                                ${!isShort && !isLong ? (docked && dockedQuestionCompactText ? 'text-sm font-medium text-gray-800' : 'text-base md:text-lg font-medium text-gray-800') : ''}
                                                ${isLong ? (docked && dockedQuestionCompactText ? 'text-sm text-gray-700' : 'text-base md:text-lg text-gray-700') : ''}
                                                ${docked ? 'leading-relaxed mb-4' : 'leading-relaxed mb-6'}
                                            `} style={{ textShadow: 'none' }}>
                                                {children}
                                            </p>
                                        );
                                    },
                                    strong: ({ children }) => <span style={{ color: brandColor, fontWeight: 700 }}>{children}</span>,
                                    a: ({ href, children }) => <a href={href} style={{ color: brandColor, textDecoration: 'underline' }}>{children}</a>
                                }}
                            >
                                {currentQuestion.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    const renderLoadingIndicator = (docked = false) => {
        if (!currentQuestion) return null;

        if (docked) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-2 flex items-center justify-center"
                >
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
                        <motion.div
                            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white"
                            style={{ border: `2px solid ${brandColor}30` }}
                            animate={{ scale: [1, 1.04, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <motion.div
                                className="absolute inset-0 rounded-full"
                                style={{ border: `2px solid ${brandColor}22` }}
                                animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.2, 0.55] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            {logoUrl ? (
                                <div className="flex h-5 w-5 items-center justify-center">
                                    <img src={logoUrl} alt={botName} className="max-h-full max-w-full object-contain" />
                                </div>
                            ) : (
                                <Icons.Logo size={16} style={{ color: brandColor }} />
                            )}
                        </motion.div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.loading}</span>
                    </div>
                </motion.div>
            );
        }

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-2xl mt-5 md:mt-8"
            >
                <div className="flex items-center justify-center">
                    <motion.div
                        className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/78 px-4 py-4 shadow-[0_24px_50px_-32px_rgba(15,23,42,0.45)] backdrop-blur-xl"
                        style={{ boxShadow: `0 24px 50px -32px ${brandColor}35` }}
                    >
                        <motion.div
                            className="absolute inset-0 rounded-[28px]"
                            style={{ boxShadow: `inset 0 0 0 1px ${brandColor}20` }}
                            animate={{
                                opacity: [0.82, 1, 0.82],
                                boxShadow: [
                                    `inset 0 0 0 1px ${brandColor}20`,
                                    `inset 0 0 0 6px ${brandColor}08`,
                                    `inset 0 0 0 1px ${brandColor}20`,
                                ],
                            }}
                            transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        />
                        <div className="relative flex items-center gap-4">
                            <div
                                className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border bg-white shadow-sm"
                                style={{
                                    borderColor: `${brandColor}40`,
                                    boxShadow: `0 12px 24px -18px ${brandColor}80`,
                                }}
                            >
                                <motion.div
                                    className="absolute inset-[-5px] rounded-[22px] border"
                                    style={{ borderColor: `${brandColor}28` }}
                                    animate={{
                                        scale: [1, 1.06, 1],
                                        opacity: [0.42, 0.1, 0.42],
                                    }}
                                    transition={{
                                        duration: 1.8,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }}
                                />
                                {logoUrl ? (
                                    <img src={logoUrl} alt={botName} className="relative z-10 w-8 h-8 object-contain" />
                                ) : (
                                    <Icons.Logo size={26} style={{ color: brandColor }} className="relative z-10" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    {[0, 1, 2].map((dot) => (
                                        <motion.span
                                            key={dot}
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ background: brandColor }}
                                            animate={{
                                                opacity: [0.25, 0.95, 0.25],
                                                y: [0, -2, 0],
                                                scale: [0.92, 1.08, 0.92],
                                            }}
                                            transition={{
                                                duration: 1.1,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                                delay: dot * 0.14,
                                            }}
                                        />
                                    ))}
                                    <span className="ml-2 text-sm font-semibold text-gray-600">
                                        {language?.toLowerCase().startsWith('it') ? 'Sto preparando la prossima domanda…' : 'Preparing the next question...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        );
    };



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
                color: colors.text,
                minHeight: effectiveViewportHeight ? `${effectiveViewportHeight}px` : undefined,
                height: effectiveViewportHeight ? `${effectiveViewportHeight}px` : undefined
            }}
        >
            {/* Dynamic Background Elements */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none', background: `radial-gradient(circle at 80% 90%, ${brandColor}25 0%, transparent 40%)` }} />

            {/* Progress bar */}
            {showProgressBar && (
                <div className={`${isEmbedded ? 'absolute' : 'fixed'} top-0 left-0 right-0 z-30 backdrop-blur-sm ${isEmbedded ? 'pt-8' : 'pt-20 md:pt-16'} pb-2`}>
                    <div className="max-w-7xl mx-auto px-4 md:px-12">
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

            {/* Header - Moved to top for mobile, custom position for larger screens */}
            <header className={`${isEmbedded ? 'absolute' : 'fixed'} top-2 left-0 right-0 z-50 px-3 py-2 md:p-4 flex items-start justify-between pointer-events-none transition-all duration-300`}>
                <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md border border-stone-200/50 p-2 pl-3 pr-4 rounded-full shadow-lg pointer-events-auto transition-all hover:shadow-xl hover:scale-105">
                    {logoUrl ? (
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-stone-100 flex-shrink-0 bg-white">
                            <img
                                src={logoUrl}
                                alt={botName}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                    // Fallback if image fails to load - XSS safe
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallbackDiv = document.createElement('div');
                                    fallbackDiv.className = 'w-full h-full rounded-lg flex items-center justify-center text-white';
                                    fallbackDiv.style.background = brandColor;
                                    fallbackDiv.textContent = '?';
                                    img.parentElement?.appendChild(fallbackDiv);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: brandColor }}>
                            <Icons.Chat size={16} />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0 pr-1">
                        <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5" style={{ fontSize: '0.6rem' }}>Sessione Live</span>
                        <span className="font-bold text-sm text-gray-900 tracking-tight truncate max-w-[120px] md:max-w-[200px]">{botName}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 mt-1 pointer-events-auto">
                    <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-200/50 shadow-md text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                        <Icons.Clock size={12} className="text-gray-400" />
                        <span>{elapsedMinutes}m</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-gray-400 font-medium">~{estimatedMinutes}m</span>
                    </div>
                    {privacyLevel === 'anonymous' && (
                        <div className="bg-green-50/90 backdrop-blur-sm text-[10px] font-bold text-green-600 px-2.5 py-1 rounded-full border border-green-100 uppercase tracking-wide shadow-sm">
                            Anonimo
                        </div>
                    )}
                </div>
            </header>

            {/* Chat Area */}
            <div
                ref={chatViewportRef}
                className={`flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center ${chatVerticalAlignClass} px-4 ${chatTopPaddingClass} w-full max-w-4xl mx-auto relative z-10`}
                style={{ paddingBottom: `${chatBottomPaddingPx}px` }}
            >

                {/* Previous Answer Context - Moved outside keyed motion.div to prevent duplication */}
                {messages.length > 1 && messages[messages.length - 2]?.role === 'user' && !isLoading && !showDockedQuestion && (
                    <div className={`w-full max-w-2xl ${isMobileKeyboardOpen ? 'mb-2' : 'mb-4'}`}>
                        <motion.div
                            key={`answer-${messages[messages.length - 2].id}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="ml-auto max-w-[85%]"
                        >
                            <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl rounded-tr-sm shadow-sm text-right">
                                <div className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: brandColor }}>{t.yourAnswer}</div>
                                <div className="text-gray-700 font-medium leading-relaxed">
                                    "{messages[messages.length - 2].content}"
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isLoading && currentQuestion && !showDockedQuestion && renderLoadingIndicator(false)}

                <AnimatePresence mode="wait">
                    {currentQuestion && !isLoading && !showDockedQuestion && renderQuestionCard(false)}

                    {isLoading && !currentQuestion && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center gap-6 mt-12"
                        >
                            <div className="relative flex h-20 w-20 items-center justify-center">
                                <motion.div
                                    className="absolute inset-0 rounded-[28px] border-2"
                                    style={{ borderColor: `${brandColor}22` }}
                                    animate={{
                                        scale: [1, 1.05, 1],
                                        opacity: [0.45, 0.12, 0.45],
                                    }}
                                    transition={{
                                        duration: 1.6,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }}
                                />
                                <div
                                    className="relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-lg"
                                    style={{ borderColor: `${brandColor}38` }}
                                >
                                    {logoUrl ? (
                                        <img src={logoUrl} alt={botName} className="h-8 w-8 object-contain" />
                                    ) : (
                                        <Icons.Logo size={24} style={{ color: brandColor }} />
                                    )}
                                </div>
                            </div>
                            <p className="text-gray-400 font-medium tracking-wide text-sm uppercase animate-pulse">{t.loading}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area or Completion Screen */}
            <div
                ref={footerRef}
                className={`${isEmbedded ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 z-50 p-3 md:p-6 ${isEmbedded ? 'pb-4' : 'pb-4 md:pb-8'} bg-gradient-to-t from-white via-white/95 to-transparent ${inputTopPaddingClass}`}
                style={isEmbedded ? undefined : { bottom: `${footerBottomOffsetPx}px` }}
            >
                <div className="max-w-3xl mx-auto w-full relative">
                    {showDockedQuestion && isLoading && currentQuestion && !isCompleted && (
                        <div className="pointer-events-none">
                            {renderLoadingIndicator(true)}
                        </div>
                    )}

                    {showDockedQuestion && !isCompleted && (
                        <div className="mb-3 pointer-events-auto">
                            {renderQuestionCard(true)}
                        </div>
                    )}

                    {isCompleted ? (
                        <div className="bg-white rounded-[18px] shadow-2xl p-8 text-center border ring-1 ring-black/5 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                                {rewardConfig?.enabled ? <Icons.Gift size={32} /> : <Icons.Check size={32} />}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {language?.toLowerCase().startsWith('it') ? 'Intervista Completata!' : 'Interview Completed!'}
                            </h2>
                            <p className="text-gray-600 mb-4">
                                {language?.toLowerCase().startsWith('it')
                                    ? 'Grazie per il tuo prezioso contributo.'
                                    : 'Thank you for your valuable contribution.'}
                            </p>
                            {showCompletionActions && rewardConfig?.enabled && rewardConfig.displayText && (
                                <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-center gap-2">
                                    <Icons.Gift size={18} />
                                    <span className="font-medium">{rewardConfig.displayText}</span>
                                </div>
                            )}
                            {rewardConfig?.enabled ? (
                                showCompletionActions ? (
                                rewardConfig.type === 'redirect' && rewardConfig.payload ? (
                                    <button
                                        onClick={() => window.open(rewardConfig.payload, '_blank')}
                                        className="px-6 py-3 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
                                        style={{ background: brandColor }}
                                    >
                                        {language?.toLowerCase().startsWith('it') ? 'Scopri' : 'Discover'} →
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => router.push(`/claim/${conversationId}`)}
                                        className="px-6 py-3 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
                                        style={{ background: brandColor }}
                                    >
                                        {language?.toLowerCase().startsWith('it') ? 'Richiedi il tuo premio' : 'Claim your reward'}
                                    </button>
                                )
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        {language?.toLowerCase().startsWith('it')
                                            ? 'Sto preparando la tua ricompensa...'
                                            : 'Preparing your reward...'}
                                    </p>
                                )
                            ) : (
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
                                    style={{ background: brandColor }}
                                >
                                    {language?.toLowerCase().startsWith('it') ? 'Nuova Intervista' : 'New Interview'}
                                </button>
                            )}
                        </div>
                    ) : currentInteraction ? (
                        <StructuredInterviewInput
                            interaction={currentInteraction}
                            brandColor={brandColor}
                            language={language}
                            loading={isLoading}
                            onSubmit={handleStructuredSubmit}
                        />
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
                                        autoResizeTextarea();
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => {
                                        setIsInputFocused(true);
                                        requestAnimationFrame(() => scheduleKeyboardAnchoring());
                                    }}
                                    onBlur={() => {
                                        setIsInputFocused(false);
                                        keyboardAnchorTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
                                        keyboardAnchorTimersRef.current = [];
                                    }}
                                    readOnly={isLoading}
                                    aria-disabled={isLoading}
                                    placeholder={t.typePlaceholder}
                                    rows={1}
                                    inputMode="text"
                                    enterKeyHint="send"
                                    autoComplete="off"
                                    autoCorrect="on"
                                    spellCheck="true"
                                    className="w-full resize-none border-none bg-transparent px-4 md:px-6 py-4 md:py-5 pr-16 text-base md:text-lg text-gray-900 placeholder-gray-400 focus:ring-0 focus:outline-none overflow-y-auto"
                                    style={{ minHeight: '56px', maxHeight: `${INPUT_MAX_HEIGHT_PX}px` }}
                                />

                                <div className="pb-2 md:pb-3 pr-2 md:pr-3 flex items-end">
                                    <button
                                        type="submit"
                                        onPointerDown={(e) => e.preventDefault()}
                                        disabled={!input.trim() || isLoading}
                                        className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white shadow-lg transition-all transform disabled:opacity-50 disabled:scale-95 disabled:shadow-none hover:scale-105 active:scale-95"
                                        style={{
                                            background: brandColor,
                                            boxShadow: `0 4px 14px 0 ${brandColor}50`
                                        }}
                                        aria-label="Send answer"
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Icons.ArrowRight size={20} className="md:w-6 md:h-6" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {!isCompleted && (
                        <div className="mt-4 flex items-center justify-between px-2 opacity-60 text-xs font-medium text-gray-500">
                            <span className="hidden md:inline-block">{!isLoading && !currentInteraction ? t.pressEnter : ''}</span>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <div className={`w-2 h-2 rounded-full ${isLoading ? 'animate-pulse' : isTyping ? 'animate-pulse' : 'bg-gray-300'}`}
                                    style={(isLoading || isTyping) ? { background: brandColor } : undefined} />
                                <span>
                                    {isLoading
                                        ? (language?.toLowerCase().startsWith('it') ? 'Elaborazione...' : 'Processing...')
                                        : isTyping
                                            ? 'Typing...'
                                            : 'Ready'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

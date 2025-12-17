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

    // Initial Start
    useEffect(() => {
        if (messages.length === 0) {
            handleStart();
        }
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setEffectiveDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleStart = async () => {
        if (config.introMessage) {
            setMessages([{
                id: 'intro',
                role: 'assistant',
                content: config.introMessage
            }]);
        } else {
            // Trigger AI first message
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
            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.content
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (data.meta?.newTopicIndex !== undefined) {
                console.log("Switching to topic:", data.meta.newTopicIndex);
                setCurrentTopicIndex(data.meta.newTopicIndex);
            }

        } catch (err) {
            console.error(err);
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

        await sendMessage(newMessages);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                <div>
                    <h3 className="font-semibold text-gray-800">{config.name || 'Preview'}</h3>
                    <p className="text-xs text-gray-500">
                        Topic {currentTopicIndex + 1}/{config.topics.length} • {Math.floor(effectiveDuration / 60)}m
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((msg, idx) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-br-none'
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                }`}
                        >
                            <ReactMarkdown components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                            }}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    </motion.div>
                ))}

                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-white rounded-2xl rounded-bl-none p-4 border border-gray-100 shadow-sm flex gap-2 items-center">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-75" />
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150" />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your answer..."
                        className="w-full bg-gray-50 text-gray-800 rounded-xl px-4 py-3 pr-12 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32"
                        rows={1}
                        style={{ minHeight: '52px' }}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 hover:bg-purple-700 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}

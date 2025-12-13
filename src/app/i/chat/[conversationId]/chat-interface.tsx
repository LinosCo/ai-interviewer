'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export default function ChatInterface({ conversationId, botId, initialMessages, topics }: any) {
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-start conversation if no messages
    useEffect(() => {
        if (messages.length === 0 && !isLoading) {
            handleSendMessage("I'm ready to start the interview.");
        }
    }, []);

    const handleSendMessage = async (messageContent: string) => {
        if (!messageContent.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    conversationId,
                    botId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            // Read plain text response
            const assistantText = await response.text();

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: assistantText
            }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: 'Sorry, there was an error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto">
            <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-24">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <p>Starting interview...</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-800'
                                }`}
                        >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                            placeholder="Type your answer..."
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

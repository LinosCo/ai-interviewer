'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { TopicBlock } from '@prisma/client';

export default function ChatInterface({ conversationId, botId, initialMessages, topics }: any) {
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: '/api/chat',
        body: { conversationId, botId },
        initialMessages: initialMessages,
        onFinish: () => {
            // Maybe refresh to get new state/topics?
        }
    } as any) as any;

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-scroll on mount too
    useEffect(() => {
        scrollToBottom();
    }, []);

    return (
        <div className="flex flex-col h-full max-w-2xl mx-auto">
            <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-24">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <p>Connecting to interviewer...</p>
                        {/* We might want to auto-trigger the initial message from the bot if it's empty */}
                        {/* Implementation detail: user sends empty message or server sends initial greeting? 
                             Usually easier if user says "Hi" or we have a specialized 'start' call.
                             Or we can use `useEffect` to append a system message or trigger an empty submit? 
                             Let's assume the server `runInterviewTurn` handles the first turn if history is empty.
                             But `useChat` waits for user input.
                             I'll add a "Start" button overlay or auto-trigger.
                         */}
                    </div>
                )}

                {messages.map((m: any) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${m.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                            }`}>
                            {m.content}

                            {/* If we support structured answers (like chips) they would be rendered here based on message metadata? 
                                Vercel AI SDK 'data' field support.
                            */}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-4 py-2 text-xs animate-pulse">
                            Interview is thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Type your answer..."
                            className="flex-grow border rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !(input || '').trim()}
                            className="bg-blue-600 text-white rounded-full p-3 w-12 h-12 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                            →
                        </button>
                    </form>
                    <div className="text-center mt-2">
                        <button className="text-xs text-gray-400 hover:text-gray-600">Skip this question</button>
                    </div>
                </div>
            </div>

            {/* Auto-start logic if empty */}
            {messages.length === 0 && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur z-20 flex items-center justify-center">
                    <button
                        onClick={() => {
                            // "system" message to kick off? Or just empty submit?
                            // append({ role: 'system', content: 'START_INTERVIEW' }) // No, system msgs not meant for that.
                            // We usually want the BOT to speak first.
                            // I'll manually call API to get greeting, then add to messages?
                            // Or simpler: User clicks "I'm ready" -> Sends "Hi" invisible? 
                            // Let's make the USER say "I'm ready".
                            handleSubmit({ preventDefault: () => { } } as any, { data: { command: 'START' } });
                            // Wait, handleSubmit expects event.
                            // `append({ role: 'user', content: "I'm ready to start." })`
                        }}
                        className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl animate-bounce"
                    >
                        Start Chat
                    </button>
                </div>
            )}
        </div>
    );
}

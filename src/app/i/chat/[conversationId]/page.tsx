import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import ChatInterface from './chat-interface';

export default async function ChatPage({ params }: { params: { conversationId: string } }) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: params.conversationId },
        include: {
            bot: {
                include: { topics: { orderBy: { orderIndex: 'asc' } } }
            },
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!conversation) notFound();

    if (conversation.status === 'COMPLETED') {
        // Redirect to thank you / summary? Or show read-only.
        // For MVP, just show "Interview Completed" message in UI handled by Interface or here.
    }

    // Transform Prisma messages to AI SDK CoreMessage format if needed, or pass as is
    // AI SDK expects { id, role, content }
    const initialMessages = conversation.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
    }));

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
                <div>
                    <h1 className="font-bold text-gray-800">{conversation.bot.name}</h1>
                    <div className="text-xs text-gray-500">AI Interviewer</div>
                </div>
                {/* Progress Bar Placeholder */}
                <div className="hidden md:block text-xs text-gray-400">
                    Topic: {conversation.currentTopicId ? 'In Progress' : 'Starting'}
                </div>
            </header>

            <div className="flex-grow overflow-hidden relative">
                <ChatInterface
                    conversationId={conversation.id}
                    botId={conversation.botId}
                    initialMessages={initialMessages}
                    topics={conversation.bot.topics}
                />
            </div>
        </div>
    );
}

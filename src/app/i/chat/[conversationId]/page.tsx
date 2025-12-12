import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ChatInterface from './chat-interface';

export default async function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = await params;
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
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

    // Transform Prisma messages to AI SDK CoreMessage format
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

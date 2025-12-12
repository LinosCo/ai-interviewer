import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InterviewChat from '@/components/interview-chat';

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
        <InterviewChat
            conversationId={conversation.id}
            botId={conversation.botId}
            botName={conversation.bot.name}
            initialMessages={initialMessages}
            topics={conversation.bot.topics}
            logoUrl={conversation.bot.logoUrl}
            primaryColor={conversation.bot.primaryColor}
            backgroundColor={conversation.bot.backgroundColor}
            textColor={conversation.bot.textColor}
        />
    );
}

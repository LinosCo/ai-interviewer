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

    // Calculate estimated duration (rough estimate based on topics)
    const estimatedMinutes = conversation.bot.topics.reduce((acc, t) => acc + (t.maxTurns || 5), 0);
    const estimatedDuration = `~${estimatedMinutes} mins`;

    return (
        <InterviewChat
            conversationId={conversation.id}
            botId={conversation.botId}
            botName={conversation.bot.name}
            botDescription={conversation.bot.description || undefined}
            estimatedDuration={estimatedDuration}
            privacyLevel={conversation.bot.privacyLevel || 'Partial'}
            logoUrl={conversation.bot.logoUrl}
            primaryColor={conversation.bot.primaryColor}
            backgroundColor={conversation.bot.backgroundColor}
        />
    );
}


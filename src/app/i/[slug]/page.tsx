import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const bot = await prisma.bot.findUnique({
        where: { slug },
    });

    if (!bot) notFound();

    // Create a new conversation and redirect directly to chat
    const conversation = await prisma.conversation.create({
        data: {
            botId: bot.id,
            participantId: `anon-${Date.now()}`,
            status: 'STARTED',
        }
    });

    redirect(`/i/chat/${conversation.id}`);
}

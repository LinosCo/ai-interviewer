import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ConversationTranscriptPage({ params }: { params: Promise<{ botId: string; conversationId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId, conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            bot: true
        }
    });

    if (!conversation || conversation.botId !== botId) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        Transcript
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {conversation.status}
                        </span>
                    </h1>
                    <p className="text-sm text-gray-500">
                        Started: {new Date(conversation.startedAt).toLocaleString()}
                        {conversation.durationSeconds && ` • Duration: ${Math.floor(conversation.durationSeconds / 60)}m`}
                    </p>
                </div>
                <Link
                    href={`/dashboard/bots/${botId}/analytics`}
                    className="text-sm text-blue-600 hover:underline"
                >
                    Back to Analytics
                </Link>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 max-w-3xl mx-auto space-y-4 shadow-inner min-h-[500px]">
                {conversation.messages.length === 0 ? (
                    <div className="text-center text-gray-500 italic py-10">No messages in this conversation.</div>
                ) : (
                    conversation.messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 whitespace-pre-wrap text-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border text-gray-800 shadow-sm'
                                    }`}
                            >
                                <div className="font-xs opacity-70 mb-1 font-bold uppercase tracking-wider text-[10px]">
                                    {msg.role === 'user' ? 'User' : conversation.bot.name}
                                </div>
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

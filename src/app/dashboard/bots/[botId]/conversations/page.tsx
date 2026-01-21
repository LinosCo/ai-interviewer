import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Clock, User, CheckCircle, XCircle, PlayCircle } from 'lucide-react';

export default async function ConversationsListPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            conversations: {
                orderBy: { startedAt: 'desc' },
                include: {
                    messages: {
                        select: { id: true, role: true },
                    },
                },
                take: 100,
            },
        },
    });

    if (!bot) redirect('/dashboard');

    const conversations = bot.conversations;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'ABANDONED':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <PlayCircle className="w-4 h-4 text-yellow-500" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return 'Completata';
            case 'ABANDONED':
                return 'Abbandonata';
            case 'STARTED':
                return 'In corso';
            default:
                return status;
        }
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Trascrizioni Chat</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {conversations.length} conversazioni per {bot.name}
                    </p>
                </div>
                <Link
                    href={`/dashboard/bots/${botId}/analytics`}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                    Vai alle Analytics
                </Link>
            </div>

            {/* Conversations List */}
            {conversations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Nessuna conversazione</h3>
                    <p className="text-sm text-gray-500">
                        Le conversazioni appariranno qui quando gli utenti inizieranno a chattare.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Data
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Stato
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Messaggi
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Durata
                                </th>
                                <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    Azioni
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {conversations.map((conv) => {
                                const userMessages = conv.messages.filter(m => m.role === 'user').length;
                                const totalMessages = conv.messages.length;

                                return (
                                    <tr key={conv.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {new Date(conv.startedAt).toLocaleDateString('it-IT', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(conv.startedAt).toLocaleTimeString('it-IT', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(conv.status)}
                                                <span className="text-sm text-gray-700">
                                                    {getStatusLabel(conv.status)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-700">
                                                    {totalMessages} ({userMessages} utente)
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-700">
                                                    {formatDuration(conv.durationSeconds)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/dashboard/bots/${botId}/conversations/${conv.id}`}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                            >
                                                Leggi trascrizione
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

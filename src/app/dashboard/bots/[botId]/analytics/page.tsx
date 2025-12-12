import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import AnalyticsView from './analytics-view';

export default async function AnalyticsPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            conversations: { orderBy: { startedAt: 'desc' } },
            themes: { include: { occurrences: true } },
            insights: true
        }
    });

    if (!bot) notFound();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Analytics: {bot.name}</h1>
                <Link href={`/dashboard/bots/${bot.id}`} className="text-blue-600 hover:underline">
                    Back to Editor
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded shadow">
                    <div className="text-3xl font-bold">{bot.conversations.length}</div>
                    <div className="text-sm text-gray-500">Total Conversations</div>
                </div>
                <div className="bg-white p-6 rounded shadow">
                    <div className="text-3xl font-bold">
                        {bot.conversations.filter(c => c.status === 'COMPLETED').length}
                    </div>
                    <div className="text-sm text-gray-500">Completed</div>
                </div>
            </div>

            {/* Advanced Analytics View */}
            <AnalyticsView bot={bot} themes={bot.themes} insights={bot.insights} />

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {bot.conversations.map(c => (
                            <tr key={c.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {new Date(c.startedAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m` : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline">
                                    <Link href={`#`}>View Transcript</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

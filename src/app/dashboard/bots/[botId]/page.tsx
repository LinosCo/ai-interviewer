import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import BotConfigForm from './bot-config-form';
import TopicsEditor from './topics-editor';
import Link from 'next/link';

export default async function BotEditorPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { topics: { orderBy: { orderIndex: 'asc' } }, knowledgeSources: true }
    });

    if (!bot) notFound();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Edit Bot: {bot.name}</h1>
                <div className="flex gap-4">
                    <Link href={`/dashboard/bots/${bot.id}/analytics`} className="px-4 py-2 border rounded hover:bg-gray-50">
                        Analytics
                    </Link>
                    <a href={`/i/${bot.slug}`} target="_blank" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Public Link
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <BotConfigForm bot={bot} />

                    {/* Placeholder for Topics Editor */}
                    <TopicsEditor botId={bot.id} topics={bot.topics} />
                </div>

                <div className="space-y-8">
                    {/* Placeholder for Knowledge Sources */}
                    <div className="bg-white p-6 rounded shadow">
                        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Knowledge Sources</h2>
                        <p className="text-sm text-gray-500 mb-4">Upload documents or add text context.</p>
                        <ul className="list-disc pl-5 mb-4">
                            {bot.knowledgeSources.map(ks => (
                                <li key={ks.id} className="text-sm">{ks.title || 'Untitled Source'} ({ks.type})</li>
                            ))}
                        </ul>
                        <button className="w-full border border-dashed p-2 text-sm text-gray-500">
                            + Add Source
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

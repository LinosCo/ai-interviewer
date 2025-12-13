import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import BotConfigForm from './bot-config-form';
import TopicsEditor from './topics-editor';
import KnowledgeSourcesEditor from './knowledge-sources';
import LegalPrivacyEditor from './legal-privacy-editor';
import RewardEditor from './reward-editor';
import Link from 'next/link';

export default async function BotEditorPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            topics: { orderBy: { orderIndex: 'asc' } },
            knowledgeSources: true,
            rewardConfig: true
        }
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
                    <TopicsEditor botId={bot.id} topics={bot.topics} />
                </div>

                <div className="space-y-8">
                    <KnowledgeSourcesEditor botId={bot.id} sources={bot.knowledgeSources} />

                    <LegalPrivacyEditor
                        botId={bot.id}
                        privacyNotice={bot.privacyNotice}
                        dataUsageInfo={bot.dataUsageInfo}
                        consentText={bot.consentText}
                        showAnonymityInfo={bot.showAnonymityInfo}
                        showDataUsageInfo={bot.showDataUsageInfo}
                        anonymizationLevel={bot.anonymizationLevel}
                    />

                    <RewardEditor
                        botId={bot.id}
                        rewardConfig={bot.rewardConfig}
                    />
                </div>
            </div>
        </div>
    );
}

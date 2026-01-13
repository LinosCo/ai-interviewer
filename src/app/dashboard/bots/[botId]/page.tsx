import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import BotConfigForm from './bot-config-form';
import TopicsEditor from './topics-editor';
import KnowledgeSourcesEditor from './knowledge-sources';
import LegalPrivacyEditor from './legal-privacy-editor';
import RewardEditor from './reward-editor';
import LandingPageEditor from './landing-page-editor';
import ProjectSelector from './project-selector';
import Link from 'next/link';
import CopyLinkButton from '@/components/copy-link-button';
import ChatbotSettings from '@/components/chatbot/ChatbotSettings';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { isFeatureEnabled } from '@/lib/usage';

export default async function BotEditorPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: true,
            projectAccess: { include: { project: true } }
        }
    });

    const userProjects = [
        ...(user?.ownedProjects || []),
        ...(user?.projectAccess.map(pa => pa.project) || [])
    ];

    // Unique by ID
    const projects = Array.from(new Map(userProjects.map(p => [p.id, p])).values());

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            topics: { orderBy: { orderIndex: 'asc' } },
            knowledgeSources: true,
            rewardConfig: true,
            project: {
                include: {
                    organization: true
                }
            }
        }
    });

    if (!bot) notFound();

    const organizationId = bot.project?.organizationId || '';

    const canUseKnowledgeBase = await isFeatureEnabled(organizationId, 'knowledgeBase');
    const canUseConditionalLogic = await isFeatureEnabled(organizationId, 'conditionalLogic');
    const canUseBranding = await isFeatureEnabled(organizationId, 'customLogo');

    if ((bot as any).botType === 'chatbot') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <h1 className="text-2xl font-bold">Configurazioni: {bot.name}</h1>
                    <div className="flex gap-2">
                        <Link href={`/dashboard/bots/${bot.id}/analytics`} className="px-3 py-2 border rounded hover:bg-gray-50">
                            Analytics
                        </Link>
                        <Link href={`/dashboard/bots/${bot.id}/embed`} className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-medium flex items-center gap-2">
                            <Icons.Settings2 className="w-4 h-4" />
                            Anteprima Widget
                        </Link>
                    </div>
                </div>
                <ChatbotSettings bot={bot} canUseKnowledgeBase={canUseKnowledgeBase} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                <h1 className="text-2xl font-bold">Edit Bot: {bot.name}</h1>
                <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Link href={`/dashboard/bots/${bot.id}/analytics`} className="px-3 py-2 sm:px-4 sm:py-2 border rounded hover:bg-gray-50 text-sm sm:text-base">
                        Analytics
                    </Link>
                    <Link href={`/dashboard/bots/${bot.id}/claims`} className="px-3 py-2 sm:px-4 sm:py-2 border rounded hover:bg-gray-50 bg-green-50 text-green-700 border-green-200 text-sm sm:text-base">
                        Claims
                    </Link>
                    <Link href={`/dashboard/bots/${bot.id}/profiles`} className="px-3 py-2 sm:px-4 sm:py-2 border rounded hover:bg-gray-50 bg-purple-50 text-purple-700 border-purple-200 text-sm sm:text-base">
                        Profili
                    </Link>
                    <a href={`/i/${bot.slug}`} target="_blank" className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base">
                        Public Link
                    </a>
                    <CopyLinkButton url={`${process.env.NEXT_PUBLIC_APP_URL || ''}/i/${bot.slug}`} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <BotConfigForm bot={bot} canUseBranding={canUseBranding} />
                    {/* Updated Landing/Branding Editor */}
                    <LandingPageEditor bot={bot} plan={bot.project.organization?.plan || 'TRIAL'} />
                    <TopicsEditor botId={bot.id} topics={bot.topics} canUseConditionalLogic={canUseConditionalLogic} />
                </div>

                <div className="space-y-8">
                    <ProjectSelector
                        botId={bot.id}
                        currentProjectId={bot.projectId}
                        projects={projects}
                    />

                    <KnowledgeSourcesEditor
                        botId={bot.id}
                        sources={bot.knowledgeSources}
                        disabled={!canUseKnowledgeBase}
                    />

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

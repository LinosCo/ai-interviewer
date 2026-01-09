import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InterviewChat from '@/components/interview-chat';
import { colors } from '@/lib/design-system';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = await params;
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            bot: {
                include: {
                    topics: { orderBy: { orderIndex: 'asc' } },
                    rewardConfig: true
                }
            },
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!conversation) notFound();

    // Calculate estimated duration based on bot configuration
    const estimatedMinutes = conversation.bot.maxDurationMins || conversation.bot.topics.reduce((acc, t) => acc + (t.maxTurns || 5), 0);
    const estimatedDuration = `~${estimatedMinutes} mins`;

    const bot = conversation.bot as any; // Type cast for optional branding fields

    return (
        <InterviewChat
            conversationId={conversation.id}
            botId={conversation.botId}
            botName={conversation.bot.name}
            botDescription={conversation.bot.description || undefined}
            estimatedDuration={estimatedDuration}
            privacyLevel={bot.anonymizationLevel || 'partial'}
            logoUrl={bot.logoUrl || null}
            primaryColor={bot.primaryColor || colors.amber}
            backgroundColor={bot.backgroundColor || '#f9fafb'}
            rewardConfig={bot.rewardConfig}
            privacyNotice={bot.privacyNotice}
            dataUsageInfo={bot.dataUsageInfo}
            showAnonymityInfo={bot.showAnonymityInfo}
            showDataUsageInfo={bot.showDataUsageInfo}
            language={bot.language}
            introMessage={bot.introMessage ? `Faremo prima una panoramica veloce sui temi principali, e poi approfondiremo i punti più interessanti.\n\n${bot.introMessage}` : null}

            // Onboarding
            welcomeTitle={bot.welcomeTitle}
            welcomeSubtitle={bot.welcomeSubtitle}
            formatExplanation={bot.formatExplanation}
            showProgressBar={bot.showProgressBar}
            progressBarStyle={bot.progressBarStyle}
            showTopicPreview={bot.showTopicPreview}

            // Context
            topics={conversation.bot.topics.map((t: any) => ({
                id: t.id,
                label: t.label,
                orderIndex: t.orderIndex
            }))}
            currentTopicId={conversation.currentTopicId}

            initialMessages={conversation.messages.map(m => ({
                id: m.id,
                role: m.role as any,
                content: m.content
            }))}

            // Warm-up
            useWarmup={bot.useWarmup}
            warmupStyle={bot.warmupStyle}
            warmupChoices={bot.warmupChoices}
            warmupIcebreaker={bot.warmupIcebreaker}
            warmupContextPrompt={bot.warmupContextPrompt}
            warmupFollowup={bot.warmupFollowup}
        />
    );
}

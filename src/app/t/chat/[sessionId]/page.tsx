// Next.js 15: params is a Promise - must await it
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TrainingChat from '@/components/training/TrainingChat'

export const dynamic = 'force-dynamic'

export default async function TrainingChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      trainingBot: { include: { topics: { orderBy: { orderIndex: 'asc' } }, rewardConfig: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!session) notFound()

  const bot = session.trainingBot
  const rawState = session.supervisorState as Record<string, unknown> | null
  const currentTopicIndex = typeof rawState?.currentTopicIndex === 'number' ? rawState.currentTopicIndex : 0
  const topicResults = Array.isArray(rawState?.topicResults) ? rawState.topicResults as import('@/lib/training/training-types').TopicResult[] : []
  const customQuestions = Array.isArray(bot.traineeDataFields)
    ? bot.traineeDataFields.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : []
  const firstCalibrationQuestion = customQuestions[0]
    ?? 'Per personalizzare la lezione: qual è il tuo ruolo e in quale contesto userai questo argomento?'
  const shouldShowCalibration = bot.collectTraineeData && (rawState?.phase === 'DATA_COLLECTION' || !rawState?.phase)
  const computedIntroMessage = shouldShowCalibration
    ? firstCalibrationQuestion
    : (bot.introMessage ?? `Ciao! Iniziamo il percorso su "${bot.name}".`)

  return (
    <TrainingChat
      sessionId={session.id}
      botName={bot.name}
      topics={bot.topics.map(t => ({ id: t.id, label: t.label }))}
      currentTopicIndex={currentTopicIndex}
      topicResults={topicResults}
      primaryColor={bot.primaryColor ?? '#6366f1'}
      logoUrl={bot.logoUrl ?? undefined}
      rewardConfig={bot.rewardConfig ? {
        enabled: bot.rewardConfig.enabled,
        type: bot.rewardConfig.type,
        payload: bot.rewardConfig.payload,
        displayText: bot.rewardConfig.displayText,
      } : null}
      initialMessages={session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        phase: m.phase as string,
      }))}
      introMessage={computedIntroMessage}
    />
  )
}

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
      trainingBot: { include: { topics: { orderBy: { orderIndex: 'asc' } } } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!session) notFound()

  const bot = session.trainingBot
  const state = session.supervisorState as {
    currentTopicIndex?: number
    topicResults?: import('@/lib/training/training-types').TopicResult[]
  } | null

  return (
    <TrainingChat
      sessionId={session.id}
      botName={bot.name}
      topics={bot.topics.map(t => ({ id: t.id, label: t.label }))}
      currentTopicIndex={state?.currentTopicIndex ?? 0}
      topicResults={state?.topicResults ?? []}
      primaryColor={bot.primaryColor ?? '#6366f1'}
      initialMessages={session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        phase: m.phase as string,
      }))}
      introMessage={bot.introMessage ?? `Ciao! Iniziamo il percorso su "${bot.name}".`}
    />
  )
}

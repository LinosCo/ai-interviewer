import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TrainingLandingClient from '@/components/training/TrainingLandingClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TrainingLandingPage({ params }: Props) {
  const { slug } = await params

  const bot = await prisma.trainingBot.findUnique({
    where: { slug, status: 'PUBLISHED' },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  })

  if (!bot) notFound()

  return (
    <TrainingLandingClient
      botId={bot.id}
      botName={bot.name}
      description={bot.description ?? ''}
      learningGoal={bot.learningGoal ?? ''}
      topics={bot.topics.map(t => ({ id: t.id, label: t.label }))}
      estimatedMinutes={bot.maxDurationMins}
      welcomeTitle={bot.welcomeTitle ?? `Benvenuto in ${bot.name}`}
      welcomeSubtitle={bot.welcomeSubtitle ?? ''}
      primaryColor={bot.primaryColor ?? '#6366f1'}
      logoUrl={bot.logoUrl ?? ''}
    />
  )
}

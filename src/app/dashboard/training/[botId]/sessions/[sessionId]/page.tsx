import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { subscriptionTierToPlanType, PlanType } from '@/config/plans'
import Link from 'next/link'
import TrainingSessionProfile from '@/components/training/admin/training-session-profile'
import type { TopicResult } from '@/lib/training/training-types'
import { hasTrainingAccess } from '@/lib/training/plan-gate'

export default async function TrainingSessionDetailPage({
  params,
}: {
  params: Promise<{ botId: string; sessionId: string }>
}) {
  const { botId, sessionId } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('bt_selected_org_id')?.value

  let membership = activeOrgId
    ? await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: activeOrgId,
          },
        },
        include: { organization: { include: { subscription: true } } },
      })
    : await prisma.membership.findFirst({
        where: { userId: session.user.id },
        include: { organization: { include: { subscription: true } } },
      })

  if (!membership?.organization && activeOrgId) {
    membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { organization: { include: { subscription: true } } },
    })
  }

  if (!membership?.organization) redirect('/login')

  const orgId = membership.organization.id
  const planType = membership.organization.subscription
    ? subscriptionTierToPlanType(membership.organization.subscription.tier)
    : PlanType.TRIAL

  const hasTraining = hasTrainingAccess(planType)

  if (!hasTraining) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-4xl mb-4">🎓</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Percorsi Formativi</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          I percorsi formativi AI sono disponibili a partire dal piano Business.
          Aggiorna il tuo piano per accedere a questa funzionalità.
        </p>
        <a
          href="/dashboard/upgrade"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Aggiorna Piano →
        </a>
      </div>
    )
  }

  const bot = await prisma.trainingBot.findUnique({
    where: { id: botId, organizationId: orgId },
    select: { id: true, name: true, traineeCompetenceLevel: true },
  })

  if (!bot) notFound()

  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: sessionId, trainingBotId: botId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!trainingSession) notFound()

  // Read topicResults from the dedicated column (supervisorState may be empty for completed sessions)
  const rawTopicResults = trainingSession.topicResults
  const topicResults: TopicResult[] = Array.isArray(rawTopicResults)
    ? (rawTopicResults as unknown as TopicResult[])
    : []

  // Safe extraction of traineeProfile
  const traineeProfile =
    trainingSession.traineeProfile &&
    typeof trainingSession.traineeProfile === 'object' &&
    !Array.isArray(trainingSession.traineeProfile)
      ? (trainingSession.traineeProfile as Record<string, string>)
      : null

  const sessionData = {
    participantId: trainingSession.participantId,
    status: trainingSession.status,
    overallScore: trainingSession.overallScore,
    passed: trainingSession.passed,
    startedAt: trainingSession.startedAt,
    completedAt: trainingSession.completedAt,
    durationSeconds: trainingSession.durationSeconds,
    detectedCompetenceLevel: trainingSession.detectedCompetenceLevel,
    topicResults,
    traineeProfile,
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/dashboard/training" className="hover:text-gray-700">
            Percorsi Formativi
          </Link>
          <span>/</span>
          <Link href={`/dashboard/training/${botId}`} className="hover:text-gray-700">
            {bot.name}
          </Link>
          <span>/</span>
          <Link href={`/dashboard/training/${botId}/sessions`} className="hover:text-gray-700">
            Sessioni
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-mono text-xs">{sessionId.slice(0, 12)}…</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Dettaglio Sessione</h1>
      </div>

      <TrainingSessionProfile
        session={sessionData}
        configuredCompetenceLevel={bot.traineeCompetenceLevel ?? 'INTERMEDIATE'}
      />
    </div>
  )
}

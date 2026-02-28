import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { subscriptionTierToPlanType, PlanType } from '@/config/plans'
import Link from 'next/link'
import { Settings, Users, BarChart2, ChevronRight } from 'lucide-react'

const BUSINESS_PLANS: string[] = ['BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN']

const statusLabel: Record<string, string> = {
  DRAFT: 'Bozza',
  PUBLISHED: 'Pubblicato',
  PAUSED: 'In pausa',
  ARCHIVED: 'Archiviato',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-red-100 text-red-600',
}

export default async function TrainingBotOverviewPage({
  params,
}: {
  params: Promise<{ botId: string }>
}) {
  const { botId } = await params

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

  const hasTraining = BUSINESS_PLANS.includes(planType)

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
    include: {
      topics: { orderBy: { orderIndex: 'asc' } },
      _count: { select: { sessions: true } },
    },
  })

  if (!bot) notFound()

  const sessions = await prisma.trainingSession.findMany({
    where: { trainingBotId: botId },
    select: { status: true, overallScore: true },
  })

  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length
  const scoredSessions = sessions.filter((s) => s.overallScore !== null)
  const avgScore =
    scoredSessions.length > 0
      ? scoredSessions.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / scoredSessions.length
      : null

  const completionRate =
    sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[bot.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {statusLabel[bot.status] ?? bot.status}
            </span>
          </div>
          {bot.learningGoal && (
            <p className="text-gray-500 text-sm max-w-xl">{bot.learningGoal}</p>
          )}
        </div>
        <Link
          href={`/dashboard/training/${botId}/settings`}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          Impostazioni
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Sessioni totali</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{bot._count.sessions}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Tasso di completamento</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{completionRate}%</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Punteggio medio</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {avgScore !== null ? `${Math.round(avgScore)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/dashboard/training/${botId}/sessions`}
          className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                Sessioni
              </p>
              <p className="text-sm text-gray-500">{completedSessions} completate</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        </Link>

        <Link
          href={`/dashboard/training/${botId}/settings`}
          className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                Impostazioni
              </p>
              <p className="text-sm text-gray-500">{bot.topics.length} argomenti configurati</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
        </Link>
      </div>

      {/* Topics */}
      {bot.topics.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Argomenti del percorso</h2>
          <div className="space-y-2">
            {bot.topics.map((topic, idx) => (
              <div
                key={topic.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{topic.label}</p>
                  {topic.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{topic.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

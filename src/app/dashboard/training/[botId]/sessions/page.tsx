import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { subscriptionTierToPlanType, PlanType } from '@/config/plans'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { hasTrainingAccess, formatDate } from '@/lib/training/plan-gate'

const sessionStatusLabel: Record<string, string> = {
  STARTED: 'In corso',
  COMPLETED: 'Completata',
  FAILED: 'Fallita',
  ABANDONED: 'Abbandonata',
}

const sessionStatusColors: Record<string, string> = {
  STARTED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
  ABANDONED: 'bg-gray-100 text-gray-600',
}


export default async function TrainingSessionsPage({
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
    select: { id: true, name: true },
  })

  if (!bot) notFound()

  const sessions = await prisma.trainingSession.findMany({
    where: { trainingBotId: botId },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <span className="text-gray-900">Sessioni</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Sessioni — {bot.name}</h1>
        <p className="text-gray-500 mt-1">Elenco delle ultime 50 sessioni di formazione.</p>
      </div>

      {sessions.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna sessione</h3>
          <p className="text-gray-500">
            Non ci sono ancora sessioni per questo percorso formativo.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto w-full">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Partecipante</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Stato</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Punteggio</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Superato</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 font-mono text-xs">
                    {s.participantId.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(s.startedAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${sessionStatusColors[s.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {sessionStatusLabel[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.overallScore !== null ? `${Math.round(s.overallScore)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.passed === null ? (
                      <span className="text-gray-400">—</span>
                    ) : s.passed ? (
                      <span className="text-green-600 font-medium">Si</span>
                    ) : (
                      <span className="text-red-500 font-medium">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/training/${botId}/sessions/${s.id}`}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors inline-flex"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

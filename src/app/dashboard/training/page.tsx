import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { subscriptionTierToPlanType, PlanType } from '@/config/plans'
import Link from 'next/link'
import { Plus, Settings, ChevronRight } from 'lucide-react'
import { hasTrainingAccess } from '@/lib/training/plan-gate'

export default async function TrainingBotsPage() {
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

  const bots = await prisma.trainingBot.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  })

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Percorsi Formativi</h1>
          <p className="text-gray-500 mt-1">Crea e gestisci i bot di formazione per il tuo team</p>
        </div>
        <Link
          href="/dashboard/training/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuovo percorso
        </Link>
      </div>

      {/* Bot List */}
      {bots.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🎓</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun percorso formativo</h3>
          <p className="text-gray-500 mb-6">
            Crea il tuo primo percorso formativo per iniziare ad addestrare il tuo team con l'AI.
          </p>
          <Link
            href="/dashboard/training/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            <Plus className="w-4 h-4" />
            Crea il primo percorso
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {bot.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <Link
                    href={`/dashboard/training/${bot.id}`}
                    className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                  >
                    {bot.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[bot.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {statusLabel[bot.status] ?? bot.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {bot._count.sessions} session{bot._count.sessions === 1 ? 'e' : 'i'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/training/${bot.id}/settings`}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title="Impostazioni"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <Link
                  href={`/dashboard/training/${bot.id}`}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

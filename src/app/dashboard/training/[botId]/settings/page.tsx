import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { subscriptionTierToPlanType, PlanType } from '@/config/plans'
import TrainingBotConfigForm from '@/components/training/admin/training-bot-config-form'
import { hasTrainingAccess } from '@/lib/training/plan-gate'

export default async function TrainingBotSettingsPage({
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
    include: {
      topics: { orderBy: { orderIndex: 'asc' } },
    },
  })

  if (!bot) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni — {bot.name}</h1>
        <p className="text-gray-500 mt-1">Modifica la configurazione del percorso formativo.</p>
      </div>

      <TrainingBotConfigForm mode="edit" bot={bot} />
    </div>
  )
}

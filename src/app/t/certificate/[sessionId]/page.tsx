import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function TrainingCertificatePage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      trainingBot: { include: { rewardConfig: true } },
    },
  })

  if (!session) notFound()
  if (!session.completedAt || !session.trainingBot.rewardConfig?.enabled) notFound()

  const completedAt = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(session.completedAt)

  const score = Math.round(Number(session.overallScore ?? 0))
  const certificateTitle = session.trainingBot.rewardConfig.displayText?.trim() || 'Certificato di completamento'

  return (
    <main className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-white border-8 border-amber-100 rounded-2xl shadow-xl p-10 text-center">
        <p className="text-xs tracking-[0.35em] uppercase text-amber-700 font-semibold mb-4">Business Tuner AI</p>
        <h1 className="text-4xl font-black text-gray-900 mb-4">{certificateTitle}</h1>
        <p className="text-gray-600 mb-8">Questo certifica il completamento del percorso formativo</p>

        <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-5 mb-8">
          <p className="text-2xl font-bold text-gray-900">{session.trainingBot.name}</p>
          <p className="text-sm text-gray-500 mt-1">ID sessione: {session.id}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
          <div className="rounded-lg border border-stone-200 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Data completamento</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{completedAt}</p>
          </div>
          <div className="rounded-lg border border-stone-200 p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Punteggio finale</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{score}/100</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-black"
        >
          Stampa / Salva PDF
        </button>
      </div>
    </main>
  )
}

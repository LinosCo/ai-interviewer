import { randomUUID } from 'crypto'
import { describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { processTrainingMessage } from '@/lib/training/training-service'

const runSmoke = process.env.RUN_TRAINING_SMOKE === '1' ? describe : describe.skip

async function cleanupTrainingBot(botId: string) {
  const sessions = await prisma.trainingSession.findMany({
    where: { trainingBotId: botId },
    select: { id: true },
  })
  const sessionIds = sessions.map((s) => s.id)

  if (sessionIds.length > 0) {
    await prisma.trainingMessage.deleteMany({
      where: { trainingSessionId: { in: sessionIds } },
    })
  }

  await prisma.trainingSession.deleteMany({ where: { trainingBotId: botId } })
  await prisma.knowledgeSource.deleteMany({ where: { trainingBotId: botId } })
  await prisma.trainingTopicBlock.deleteMany({ where: { trainingBotId: botId } })
  await prisma.rewardConfig.deleteMany({ where: { trainingBotId: botId } })
  await prisma.trainingBot.deleteMany({ where: { id: botId } })
}

function buildQuizAnswers(questions: Array<{ type: string; correctIndex?: number }>): Array<number | string> {
  return questions.map((q) => {
    if (typeof q.correctIndex === 'number') return q.correctIndex
    if (q.type === 'OPEN_ANSWER') return 'Risposta sintetica coerente con il contenuto spiegato.'
    return 0
  })
}

runSmoke('Training Smoke Suite', () => {
  it(
    'covers creation -> publication -> knowledge -> session -> 2 messages -> completion',
    async () => {
      const orgIdFromEnv = process.env.SMOKE_ORG_ID
      const org = orgIdFromEnv
        ? await prisma.organization.findUnique({ where: { id: orgIdFromEnv }, select: { id: true } })
        : await prisma.organization.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })

      expect(org?.id, 'Nessuna organizzazione trovata. Imposta SMOKE_ORG_ID.').toBeTruthy()

      const suffix = randomUUID().slice(0, 8)
      const slug = `smoke-training-${suffix}`
      const customApiKey = process.env.SMOKE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null

      const created = await prisma.trainingBot.create({
        data: {
          organizationId: org!.id,
          name: `Smoke Training ${suffix}`,
          slug,
          status: 'DRAFT',
          language: 'it',
          tone: 'professional',
          modelProvider: 'openai',
          modelName: 'gpt-4o-mini',
          customApiKey,
          learningGoal: 'Verificare il flusso end-to-end training.',
          topics: {
            create: [
              {
                orderIndex: 0,
                label: 'Fondamenti Smoke Test',
                description: 'Topic sintetico per verifica flusso.',
                learningObjectives: [
                  'Comprendere il concetto base',
                  'Rispondere in modo coerente a una domanda breve',
                ],
                minCheckingTurns: 1,
                maxCheckingTurns: 1,
              },
            ],
          },
        },
        include: { topics: true },
      })

      let botIdForCleanup: string | null = created.id

      try {
        const published = await prisma.trainingBot.update({
          where: { id: created.id },
          data: { status: 'PUBLISHED' },
          select: { id: true, status: true },
        })
        expect(published.status).toBe('PUBLISHED')

        await prisma.knowledgeSource.create({
          data: {
            trainingBotId: created.id,
            type: 'text',
            title: 'Smoke Knowledge',
            content: 'La smoke suite verifica creazione, pubblicazione, sessione e completamento.',
          } as Prisma.KnowledgeSourceUncheckedCreateInput,
        })

        const session = await prisma.trainingSession.create({
          data: {
            trainingBotId: created.id,
            participantId: `smoke-${suffix}`,
            supervisorState: {},
          },
          select: { id: true },
        })

        const first = await processTrainingMessage(session.id, 'Ciao, iniziamo pure.')
        expect(first.text.length).toBeGreaterThan(0)
        expect(first.phase).toBeTruthy()

        const second = await processTrainingMessage(session.id, 'Ok, ho capito il concetto.')
        expect(second.text.length).toBeGreaterThan(0)
        expect(second.phase).toBeTruthy()

        let latest = second
        let turns = 2
        const maxTurns = 16

        while (!latest.sessionComplete && turns < maxTurns) {
          if (latest.phase === 'FINAL_QUIZZING' && latest.quizPayload?.questions?.length) {
            const answers = buildQuizAnswers(latest.quizPayload.questions)
            latest = await processTrainingMessage(session.id, JSON.stringify(answers))
          } else {
            latest = await processTrainingMessage(
              session.id,
              'Proseguo: puoi farmi una domanda breve sul punto appena visto?'
            )
          }
          turns += 1
        }

        const finalSession = await prisma.trainingSession.findUnique({
          where: { id: session.id },
          select: { status: true, completedAt: true, overallScore: true },
        })

        expect(latest.sessionComplete, 'Sessione non completata entro il limite turni').toBe(true)
        expect(finalSession?.completedAt).toBeTruthy()
        expect(['COMPLETED', 'FAILED']).toContain(finalSession?.status ?? '')
      } finally {
        if (botIdForCleanup) {
          await cleanupTrainingBot(botIdForCleanup)
          botIdForCleanup = null
        }
      }
    },
    180_000
  )
})


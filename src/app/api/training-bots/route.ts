import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'
import { Prisma } from '@prisma/client'

async function ensureTrainingTopicDialogueColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TrainingTopicBlock"
      ADD COLUMN IF NOT EXISTS "minCheckingTurns" INTEGER NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS "maxCheckingTurns" INTEGER NOT NULL DEFAULT 6;
  `)
}

async function ensureTrainingRewardSchemaCompatibility() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RewardConfig"
      ADD COLUMN IF NOT EXISTS "trainingBotId" TEXT;
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RewardConfig"
      ALTER COLUMN "botId" DROP NOT NULL;
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "RewardConfig_trainingBotId_key"
    ON "RewardConfig"("trainingBotId");
  `)
}

async function upsertTrainingRewardConfig(
  db: Prisma.TransactionClient | typeof prisma,
  trainingBotId: string,
  rewardConfig?: { enabled: boolean; displayText?: string | null; showOnLanding?: boolean }
) {
  if (!rewardConfig) return
  const displayText = (rewardConfig.displayText ?? 'Certificato di completamento').trim() || 'Certificato di completamento'
  const rewardConfigId = `trw_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  await db.$executeRawUnsafe(
    `
      INSERT INTO "RewardConfig" ("id","trainingBotId","enabled","type","payload","displayText","showOnLanding")
      VALUES ($1, $2, $3, 'certificate', 'training-certificate', $4, $5)
      ON CONFLICT ("trainingBotId")
      DO UPDATE SET
        "enabled" = EXCLUDED."enabled",
        "type" = 'certificate',
        "payload" = 'training-certificate',
        "displayText" = EXCLUDED."displayText",
        "showOnLanding" = EXCLUDED."showOnLanding";
    `,
    rewardConfigId,
    trainingBotId,
    rewardConfig.enabled,
    displayText,
    rewardConfig.showOnLanding ?? false
  )
}

const CreateBotSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  organizationId: z.string(),
  language: z.string().default('it'),
  tone: z.string().nullish().transform(v => v ?? undefined),
  learningGoal: z.string().nullish().transform(v => v ?? undefined),
  targetAudience: z.string().nullish().transform(v => v ?? undefined),
  traineeEducationLevel: z.enum(['PRIMARY', 'SECONDARY', 'UNIVERSITY', 'PROFESSIONAL']).optional(),
  traineeCompetenceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  failureMode: z.enum(['STRICT', 'PERMISSIVE']).optional(),
  primaryColor: z.string().nullish().transform(v => v ?? undefined),
  logoUrl: z.string().nullish().transform(v => v ?? undefined),
  introMessage: z.string().nullish().transform(v => v ?? undefined),
  passScoreThreshold: z.number().int().min(0).max(100).optional(),
  maxRetries: z.number().int().min(0).optional(),
  maxDurationMins: z.number().int().min(10).max(180).optional(),
  collectTraineeData: z.boolean().optional(),
  traineeDataFields: z.array(z.string().min(1)).max(5).optional(),
  rewardConfig: z.object({
    enabled: z.boolean(),
    displayText: z.string().nullish(),
    showOnLanding: z.boolean().optional(),
  }).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED']).optional(),
  topics: z.array(z.object({
    label: z.string().min(1),
    description: z.string().nullish(),
    orderIndex: z.number().int().optional(),
    learningObjectives: z.array(z.string()).optional(),
    minCheckingTurns: z.number().int().min(1).max(12).optional(),
    maxCheckingTurns: z.number().int().min(1).max(12).optional(),
  })).optional(),
})

export async function GET(request: Request) {
  try {
    await ensureTrainingTopicDialogueColumns()
    await ensureTrainingRewardSchemaCompatibility()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId query param is required' }, { status: 400 })
    }

    try {
      await assertOrganizationAccess(session.user.id, organizationId, 'VIEWER')
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bots = await prisma.trainingBot.findMany({
      where: { organizationId },
      include: {
        topics: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ bots })
  } catch (err) {
    console.error('[training-bots GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTrainingTopicDialogueColumns()
    await ensureTrainingRewardSchemaCompatibility()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateBotSchema.parse(body)
    const { topics, rewardConfig, ...botFields } = parsed

    try {
      await assertOrganizationAccess(session.user.id, parsed.organizationId, 'MEMBER')
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bot = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingBot.create({ data: botFields })

      await upsertTrainingRewardConfig(tx, created.id, rewardConfig)

      if (topics && topics.length > 0) {
        await tx.trainingTopicBlock.createMany({
          data: topics.map((t, i) => ({
            label: t.label,
            description: t.description,
            orderIndex: t.orderIndex ?? i,
            trainingBotId: created.id,
            learningObjectives: t.learningObjectives ?? [],
            minCheckingTurns: t.minCheckingTurns ?? 2,
            maxCheckingTurns: t.maxCheckingTurns ?? 6,
          })),
        })
      }

      return created
    })

    return NextResponse.json({ bot }, { status: 201 })
  } catch (err) {
    console.error('[training-bots POST]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'Slug già in uso. Scegli un nome o uno slug diverso.' },
          { status: 409 }
        )
      }
      if (err.code === 'P2003') {
        return NextResponse.json(
          { error: 'Organizzazione non valida o non trovata.' },
          { status: 400 }
        )
      }
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: `Errore validazione database: ${err.message}` },
        { status: 400 }
      )
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'

const UpdateBotSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  language: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  introMessage: z.string().optional(),
  passScoreThreshold: z.number().int().min(0).max(100).optional(),
  maxRetries: z.number().int().min(0).optional(),
  topics: z.array(z.object({
    label: z.string().min(1),
    description: z.string().optional(),
    orderIndex: z.number().int().optional(),
  })).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { botId } = await params

    const bot = await prisma.trainingBot.findUnique({
      where: { id: botId },
      include: {
        topics: { orderBy: { orderIndex: 'asc' } },
        knowledgeSources: true,
        rewardConfig: true,
      },
    })

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'VIEWER')
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ bot })
  } catch (err) {
    console.error('[training-bots/[botId] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { botId } = await params

    const existing = await prisma.trainingBot.findUnique({
      where: { id: botId },
      select: { organizationId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    try {
      await assertOrganizationAccess(session.user.id, existing.organizationId, 'MEMBER')
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = UpdateBotSchema.parse(body)
    const { topics, ...botFields } = parsed

    const bot = await prisma.$transaction(async (tx) => {
      const updated = await tx.trainingBot.update({
        where: { id: botId },
        data: botFields,
      })

      if (topics !== undefined) {
        await tx.trainingTopicBlock.deleteMany({ where: { trainingBotId: botId } })

        if (topics.length > 0) {
          await tx.trainingTopicBlock.createMany({
            data: topics.map((t, i) => ({
              label: t.label,
              description: t.description,
              orderIndex: t.orderIndex ?? i,
              trainingBotId: botId,
            })),
          })
        }
      }

      return updated
    })

    return NextResponse.json({ bot })
  } catch (err) {
    console.error('[training-bots/[botId] PUT]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

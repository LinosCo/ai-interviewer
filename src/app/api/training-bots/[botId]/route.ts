import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

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
    const body = await request.json() as Record<string, unknown>
    const { topics, ...botFields } = body

    const bot = await prisma.$transaction(async (tx) => {
      const updated = await tx.trainingBot.update({
        where: { id: botId },
        data: botFields as Prisma.TrainingBotUpdateInput,
      })

      if (topics !== undefined) {
        await tx.trainingTopicBlock.deleteMany({ where: { trainingBotId: botId } })

        const topicsArray = topics as Record<string, unknown>[]
        if (topicsArray.length > 0) {
          await tx.trainingTopicBlock.createMany({
            data: topicsArray.map((t, i) => ({
              ...t,
              trainingBotId: botId,
              orderIndex: i,
              id: undefined,
            })) as Prisma.TrainingTopicBlockCreateManyInput[],
          })
        }
      }

      return updated
    })

    return NextResponse.json({ bot })
  } catch (err) {
    console.error('[training-bots/[botId] PUT]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

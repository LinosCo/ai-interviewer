import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CreateBotSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  organizationId: z.string(),
  language: z.string().default('it'),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId query param is required' }, { status: 400 })
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
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = CreateBotSchema.parse(body)

    const bot = await prisma.trainingBot.create({ data })

    return NextResponse.json({ bot }, { status: 201 })
  } catch (err) {
    console.error('[training-bots POST]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

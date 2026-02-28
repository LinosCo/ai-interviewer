import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({ botId: z.string() })

const BUSINESS_PLANS = ['BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN']

export async function POST(req: NextRequest) {
  try {
    const { botId } = Schema.parse(await req.json())

    const bot = await prisma.trainingBot.findUnique({
      where: { id: botId, status: 'PUBLISHED' },
      select: {
        id: true,
        organization: { select: { plan: true } },
      },
    })
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    // Plan gate: only Business+ orgs can run training sessions
    if (!BUSINESS_PLANS.includes(bot.organization.plan)) {
      return NextResponse.json(
        { error: 'Training not available for this organization plan' },
        { status: 403 },
      )
    }

    const session = await prisma.trainingSession.create({
      data: {
        trainingBotId: botId,
        participantId: `anon-${crypto.randomUUID()}`,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (err) {
    console.error('[training-sessions]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

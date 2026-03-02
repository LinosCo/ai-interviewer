// src/app/api/training-bots/[botId]/knowledge/route.ts
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'
import { scrapeUrl } from '@/lib/scraping'
import { Prisma } from '@prisma/client'

async function ensureKnowledgeSourceCompatibility() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeSource"
      ADD COLUMN IF NOT EXISTS "trainingBotId" TEXT;
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeSource"
      ALTER COLUMN "botId" DROP NOT NULL;
  `)
}

function isBotIdNotNullError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (err.code !== 'P2011') return false
  return String(err.message).toLowerCase().includes('botid')
}

async function getBot(botId: string) {
  return prisma.trainingBot.findUnique({
    where: { id: botId },
    select: { id: true, organizationId: true },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    await ensureKnowledgeSourceCompatibility()

    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId } = await params
    const bot = await getBot(botId)
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'VIEWER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sourcesRaw = await prisma.knowledgeSource.findMany({
      where: { trainingBotId: botId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true, content: true },
    })

    const sources = sourcesRaw.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      createdAt: s.createdAt,
      charCount: s.content.length,
    }))

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('[training-kb GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const PostSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), title: z.string().min(1), content: z.string().min(1) }),
  z.object({ type: z.literal('text'), title: z.string().min(1), content: z.string().min(1) }),
  z.object({ type: z.literal('url'), url: z.string().url() }),
])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    await ensureKnowledgeSourceCompatibility()

    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId } = await params
    const bot = await getBot(botId)
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'MEMBER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = PostSchema.parse(body)

    let title: string
    let content: string
    let type: string

    if (parsed.type === 'url') {
      try {
        const scrapeData = await scrapeUrl(parsed.url)
        title = scrapeData.title || parsed.url
        content = `URL: ${scrapeData.url}\n\nTitle: ${scrapeData.title}\n\n${scrapeData.content}`
        type = 'url'
      } catch {
        return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 422 })
      }
    } else {
      title = parsed.title
      content = parsed.content
      type = parsed.type
    }

    let source
    try {
      source = await prisma.knowledgeSource.create({
        data: {
          trainingBotId: botId,
          type,
          title,
          content,
          // botId is nullable — training KB sources don't belong to a regular Bot
        },
      })
    } catch (err) {
      if (!isBotIdNotNullError(err)) throw err
      await ensureKnowledgeSourceCompatibility()
      source = await prisma.knowledgeSource.create({
        data: {
          trainingBotId: botId,
          type,
          title,
          content,
        },
      })
    }

    return NextResponse.json({
      source: {
        id: source.id,
        title: source.title,
        type: source.type,
        createdAt: source.createdAt,
        charCount: source.content.length,
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[training-kb POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// src/app/api/training-bots/[botId]/knowledge/[sourceId]/route.ts
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { assertOrganizationAccess, WorkspaceError } from '@/lib/domain/workspace'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string; sourceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId, sourceId } = await params

    const bot = await prisma.trainingBot.findUnique({
      where: { id: botId },
      select: { organizationId: true },
    })
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 })

    try {
      await assertOrganizationAccess(session.user.id, bot.organizationId, 'MEMBER')
    } catch (err) {
      if (err instanceof WorkspaceError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify source belongs to this training bot before deleting
    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, trainingBotId: botId },
    })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    await prisma.knowledgeSource.delete({ where: { id: sourceId } })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[training-kb DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

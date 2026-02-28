// src/app/api/training-chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { processTrainingMessage } from '@/lib/training/training-service'

const RequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, sessionId } = RequestSchema.parse(body)

    const result = await processTrainingMessage(sessionId, message)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[training-chat]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

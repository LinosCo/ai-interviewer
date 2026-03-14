/**
 * POST /api/chat/benchmark-init
 *
 * Lightweight endpoint used exclusively by the agentic regression harness
 * (`scripts/interview-agentic-regression.ts`) to bootstrap a benchmark run
 * without requiring a direct Prisma/DB connection to the stage database.
 *
 * Guards:
 *  - Requires `x-chat-simulate: 1` header (same gate as /api/chat/simulate)
 *  - Only returns the minimum data the harness needs: conversationId + bot config
 *
 * Body: { botId: string; scenarioId: string; personaName: string }
 * Response: { conversationId: string; botName: string; language: string; candidateFields: string[]; apiKey: string }
 */

import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { getConfigValue } from '@/lib/config';
import { LLMService } from '@/services/llmService';

export async function POST(req: NextRequest) {
    // Restrict to simulation harness only
    if (req.headers.get('x-chat-simulate') !== '1') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: { botId?: string; scenarioId?: string; personaName?: string };
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { botId, scenarioId, personaName } = body;
    if (!botId) {
        return Response.json({ error: 'Missing botId' }, { status: 400 });
    }

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: {
            id: true,
            name: true,
            language: true,
            candidateDataFields: true,
            openaiApiKey: true,
            status: true,
        },
    });

    if (!bot) {
        return Response.json({ error: `Bot not found: ${botId}` }, { status: 404 });
    }

    const apiKey: string =
        (await LLMService.getApiKey(bot as any, 'openai')) ||
        (await getConfigValue('openaiApiKey')) ||
        process.env.OPENAI_API_KEY ||
        '';

    if (!apiKey) {
        return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const candidateFields = Array.isArray(bot.candidateDataFields)
        ? bot.candidateDataFields.map((v) => String(v || '').trim()).filter(Boolean)
        : [];

    // Create the conversation record so the chat API can find it
    const conversation = await prisma.conversation.create({
        data: {
            botId: bot.id,
            participantId: `agentic-${scenarioId ?? 'unknown'}-${Date.now()}`,
            status: 'STARTED',
            metadata: {
                simulationHarness: 'agentic-regression',
                scenarioId: scenarioId ?? null,
                persona: personaName ?? null,
            },
        },
        select: { id: true },
    });

    return Response.json({
        conversationId: conversation.id,
        botName: bot.name,
        language: bot.language ?? 'it',
        candidateFields,
        apiKey,
    });
}

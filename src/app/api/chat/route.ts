import { prisma } from '@/lib/prisma';
import { runInterviewTurn } from '@/lib/llm/orchestrator';
import { convertToCoreMessages } from 'ai';

export const maxDuration = 60; // Allow long LLM generation

export async function POST(req: Request) {
    console.log('=== Chat API POST called ===');
    try {
        const body = await req.json();
        console.log('Request body:', JSON.stringify(body, null, 2));
        const { messages, conversationId, botId } = body;

        // Validate messages
        if (!messages || !Array.isArray(messages)) {
            console.error('Invalid messages format:', messages);
            return new Response(
                JSON.stringify({ error: 'Messages must be an array' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: true }
        });

        if (!conversation || conversation.botId !== botId) {
            console.error('Unauthorized: conversation not found or botId mismatch');
            return new Response("Unauthorized", { status: 401 });
        }

        // Save the latest User message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            await prisma.message.create({
                data: {
                    conversationId,
                    role: 'user',
                    content: lastMessage.content
                }
            });
            console.log('Saved user message to DB');
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { topics: { orderBy: { orderIndex: 'asc' } } }
        });

        if (!bot) {
            console.error('Bot not found:', botId);
            return new Response("Bot not found", { status: 404 });
        }

        console.log('Bot loaded:', {
            id: bot.id,
            name: bot.name,
            topicsCount: bot.topics?.length,
            topics: bot.topics
        });

        console.log('Messages received:', messages);

        // Build core messages manually - ensure correct format
        const coreMessages = messages.map((m: any) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content
        }));

        console.log('Core messages built:', coreMessages);

        console.log('Calling runInterviewTurn with:', {
            botId: bot.id,
            conversationId: conversation.id,
            messagesCount: coreMessages.length
        });
        const response = await runInterviewTurn(bot, conversation, coreMessages);
        console.log('runInterviewTurn returned, streaming response');
        return response;
    } catch (error: any) {
        console.error("Chat API Error:", error);
        console.error("Error stack:", error.stack);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

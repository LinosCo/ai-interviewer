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

        // Verify conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: true } // We might need history check
        });

        if (!conversation || conversation.botId !== botId) {
            console.error('Unauthorized: conversation not found or botId mismatch');
            return new Response("Unauthorized", { status: 401 });
        }

        // Save the latest User message (which is in 'messages' but not in DB yet)
        // The 'messages' array from useChat includes all history + new user message.
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
            // Check if already saved? (Deduplication)
            // Simple check: compare with DB last message? 
            // For MVP we assume useChat sends it and we save it here.
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

        console.log('Calling runInterviewTurn...');
        const coreMessages = convertToCoreMessages(messages);

        const response = runInterviewTurn(bot, conversation, coreMessages);
        console.log('runInterviewTurn returned, streaming response');
        return response;
    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

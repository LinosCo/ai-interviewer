import { prisma } from '@/lib/prisma';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { generateText, CoreMessage } from 'ai';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { recordInterviewCompleted, checkInterviewStatus, markInterviewAsCompleted } from '@/lib/usage';
import { LLMService } from '@/services/llmService';

export const maxDuration = 60;

export async function POST(req: Request) {
    console.log('=== Chat API POST (Phase 5: Limits Implementation) ===');
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration } = body;

        // 1. Data Loading & Initial Validation
        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                bot: {
                    include: {
                        topics: { orderBy: { orderIndex: 'asc' } }
                    }
                }
            }
        });

        if (!conversation || conversation.botId !== botId) {
            return new Response("Unauthorized or Not Found", { status: 404 });
        }

        if (conversation.status === 'COMPLETED') {
            return new Response("INTERVIEW_COMPLETED", { status: 200 });
        }

        // 2. Update Progress (Effective Duration & Stats)
        const updatedEffectiveDuration = effectiveDuration !== undefined ? Number(effectiveDuration) : conversation.effectiveDuration;

        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                effectiveDuration: updatedEffectiveDuration,
                exchangeCount: { increment: 1 }
            }
        });

        // 3. Status & Limit Check
        const status = await checkInterviewStatus(conversationId);

        if (status.shouldConclude) {
            console.log(`Interview Limit Reached (${status.reason}) for ${conversationId}`);
            await markInterviewAsCompleted(conversationId);

            // Send a final "Limit Reached" message or signal
            const closingNotice = status.reason === 'TIME'
                ? "Il tempo a disposizione per questa intervista è terminato. Grazie per la partecipazione!"
                : "Abbiamo raccolto sufficienti informazioni per questa fase. Grazie mille!";

            return new Response(`${closingNotice} INTERVIEW_COMPLETED`, { status: 200 });
        }

        // 4. Resolve Model
        const model = await LLMService.getModel(conversation.bot);
        const methodology = LLMService.getMethodology();

        // 5. Build Prompts
        const currentTopic = conversation.bot.topics.find((t: any) => t.id === conversation.currentTopicId) || conversation.bot.topics[0];

        let systemPrompt = PromptBuilder.build(
            conversation.bot,
            conversation,
            currentTopic || null,
            methodology,
            updatedEffectiveDuration
        );

        // --- BUSINESS TUNER MEMORY INTEGRATION ---
        // 1. Update memory with new user message (if applicable)
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            const apiKey = process.env.OPENAI_API_KEY || '';
            const currentTopicLabel = currentTopic?.label || 'Generale';

            // Non-blocking memory update (fire and forget to not slow down response too much, 
            // or await if we want to ensure consistency)
            // Awaiting is safer for the prototype to avoid race conditions on next turn
            await MemoryManager.updateAfterUserResponse(
                conversationId,
                lastMessage.content,
                currentTopic?.id || '',
                currentTopicLabel,
                apiKey
            );
        }

        // 2. Get formatted memory context
        const memory = await MemoryManager.get(conversationId);
        const memoryContext = memory ? MemoryManager.formatForPrompt(memory) : '';

        // 3. Inject into prompt
        // We inject it before the control section
        // -----------------------------------------

        systemPrompt += `

${memoryContext}

## TRANSITION & COMPLETION CONTROL
When topic is covered, add: [TRANSITION_TO_NEXT_TOPIC]
When interview is complete, add: [CONCLUDE_INTERVIEW]

IMPORTANT: Markers must be on THEIR OWN LINE at the very end of your response.
`;

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }) as CoreMessage);
        if (messagesForAI.length === 0) messagesForAI.push({ role: 'user', content: "I am ready." });

        // 6. Generate
        const result = await generateText({
            model,
            system: systemPrompt,
            messages: messagesForAI,
        });

        let responseText = result.text;

        // 7. Post-Processing (Markers & Status)
        if (responseText.includes('[CONCLUDE_INTERVIEW]')) {
            responseText = responseText.replace('[CONCLUDE_INTERVIEW]', '').trim();
            await markInterviewAsCompleted(conversationId);
            responseText += " INTERVIEW_COMPLETED";
        } else if (responseText.includes('[TRANSITION_TO_NEXT_TOPIC]')) {
            responseText = responseText.replace('[TRANSITION_TO_NEXT_TOPIC]', '').trim();
            // Topic transition logic from Bot.topics index...
            const botTopics = await prisma.topicBlock.findMany({
                where: { botId: conversation.bot.id },
                orderBy: { orderIndex: 'asc' }
            });
            const currentIndex = botTopics.findIndex((t: any) => t.id === conversation.currentTopicId);
            const nextTopic = botTopics[currentIndex + 1];

            if (nextTopic) {
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { currentTopicId: nextTopic.id }
                });
            } else {
                await markInterviewAsCompleted(conversationId);
                responseText += " INTERVIEW_COMPLETED";
            }
        }

        // 8. Save Assistant Message
        await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content: responseText
            }
        });

        return new Response(responseText, { status: 200 });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

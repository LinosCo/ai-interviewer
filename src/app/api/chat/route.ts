
import { ChatService } from '@/services/chat-service';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { LLMService } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration } = body;

        // 1. Data Loading & Validation
        const conversation = await ChatService.loadConversation(conversationId, botId);

        // 2. Persist User Message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'user') {
            await ChatService.saveUserMessage(conversationId, lastMessage.content);
        }

        // 3. Update Progress
        await ChatService.updateProgress(conversationId, Number(effectiveDuration || conversation.effectiveDuration));

        // 4. Check Limits
        const statusCheck = await ChatService.checkLimits(conversationId);
        if (statusCheck.shouldConclude) {
            await ChatService.completeInterview(conversationId);
            return Response.json({
                text: "Il tempo a disposizione per questa intervista è terminato. Grazie per la partecipazione! INTERVIEW_COMPLETED",
                isCompleted: true,
                currentTopicId: conversation.currentTopicId
            });
        }

        // 5. Topic Supervision
        const botTopics = conversation.bot.topics;
        // Ensure topics are sorted
        botTopics.sort((a, b) => a.orderIndex - b.orderIndex);

        const currentTopic = botTopics.find(t => t.id === conversation.currentTopicId) || botTopics[0];
        const currentIndex = botTopics.findIndex(t => t.id === conversation.currentTopicId);

        let supervisorInsight = { status: 'SCANNING' };

        // Fetch API Key for Topic Manager
        // Note: TopicManager currently uses OpenAI only for the supervisor/logic tier
        const openAIKey = await LLMService.getApiKey(conversation.bot, 'openai') || process.env.OPENAI_API_KEY || '';

        if (messages.length > 2) {
            try {
                const insight = await TopicManager.evaluateTopicProgress(
                    messages as any[],
                    currentTopic,
                    openAIKey
                );
                supervisorInsight = insight as any;
                console.log("🔍 Supervisor Insight:", supervisorInsight);
            } catch (e) { console.error("Supervisor error", e); }
        }

        // 5.b. Failsafe for Stuck Topic 1
        // If stuck on first topic for > 14 messages (approx 7 turns)
        if (currentIndex === 0 && messages.length > 14) {
            console.log("🚨 FORCE TRANSITION: Stuck on Topic 1");
            supervisorInsight = { status: 'TRANSITION' };
        }

        // 6. Transition Decision & Prompt Building
        const methodology = LLMService.getMethodology();

        // Load the chosen model (OpenAI or Anthropic)
        const model = await LLMService.getModel(conversation.bot);

        let systemPrompt = "";
        let nextTopicId = conversation.currentTopicId;
        let isTransitioning = false;

        // Perform Single-Call Transition Logic
        if (supervisorInsight.status === 'TRANSITION') {
            const nextTopic = botTopics[currentIndex + 1];

            if (nextTopic) {
                // SINGLE CALL TRANSITION: Bridge + New Question
                systemPrompt = PromptBuilder.buildTransitionPrompt(currentTopic, nextTopic, methodology);
                nextTopicId = nextTopic.id;
                isTransitioning = true;
            } else {
                // No more topics -> Conclude
                await ChatService.completeInterview(conversationId);
                return Response.json({
                    text: "Grazie per il tuo tempo. L'intervista è conclusa. INTERVIEW_COMPLETED",
                    isCompleted: true,
                    currentTopicId: conversation.currentTopicId
                });
            }
        } else {
            // STANDARD FLOW (Scanning / Deepening)
            systemPrompt = PromptBuilder.build(
                conversation.bot,
                conversation,
                currentTopic,
                methodology,
                Number(effectiveDuration || 0),
                supervisorInsight as any
            );
        }

        // 7. Generation (Structured Output)
        // User requested JSON markers. We use generateObject to enforce structure.
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional().describe("Internal reasoning (hidden from user)")
        });

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));
        if (messagesForAI.length === 0) messagesForAI.push({ role: 'user', content: "I am ready." });

        const result = await generateObject({
            model,
            schema,
            messages: messagesForAI,
            system: systemPrompt,
            temperature: 0.7
        });

        const responseText = result.object.response;

        // 8. State Updates
        if (isTransitioning && nextTopicId && nextTopicId !== conversation.currentTopicId) {
            await ChatService.updateCurrentTopic(conversationId, nextTopicId);
        }

        // 9. Persistence
        await ChatService.saveAssistantMessage(conversationId, responseText);

        // Memory Update (Background - Fire & Forget)
        const lastUserContent = lastMessage?.role === 'user' ? lastMessage.content : null;
        if (lastUserContent) {
            console.log("🧠 Updating memory...");
            MemoryManager.updateAfterUserResponse(
                conversationId,
                lastUserContent,
                currentTopic.id,
                currentTopic.label,
                openAIKey
            ).catch(err => console.error("Memory update failed", err));
        }

        return Response.json({
            text: responseText,
            currentTopicId: nextTopicId,
            isCompleted: false
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

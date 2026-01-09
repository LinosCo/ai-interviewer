
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
        let currentIndex = botTopics.findIndex(t => t.id === conversation.currentTopicId);
        if (currentIndex === -1) currentIndex = 0;

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
                console.log("🔍 [CHAT] Supervisor Decision:", {
                    currentTopic: currentTopic.label,
                    topicIndex: `${currentIndex + 1}/${botTopics.length}`,
                    status: supervisorInsight.status,
                    messagesCount: messages.length
                });
            } catch (e) {
                console.error("❌ [CHAT] Supervisor error:", e);
            }
        }

        // 5.b. Failsafe for Stuck Topic 1
        // If stuck on first topic for > 30 messages (approx 15 turns)
        if (currentIndex === 0 && messages.length > 30) {
            console.log("🚨 [CHAT] FORCE TRANSITION: Stuck on Topic 1 for too long.");
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
                console.log(`➡️ [CHAT] Transitioning: ${currentTopic.label} → ${nextTopic.label}`);
                systemPrompt = PromptBuilder.buildTransitionPrompt(currentTopic, nextTopic, methodology);
                nextTopicId = nextTopic.id;
                isTransitioning = true;
            } else {
                // No more topics in sequence
                // Check if we should do DEEP DIVE cycle
                console.log("🔄 [CHAT] Reached end of topics. Checking for deep dive opportunities...");

                // Simple heuristic: if interview is short (< 50% of max time), do deep dives
                const maxDurationSeconds = (conversation.bot.maxDurationMins || 10) * 60;
                const timeUsedPercent = (Number(effectiveDuration || 0) / maxDurationSeconds) * 100;

                console.log(`⏱️ [CHAT] Time used: ${timeUsedPercent.toFixed(0)}% (${effectiveDuration}s / ${maxDurationSeconds}s)`);

                if (timeUsedPercent < 70) {
                    // We have time for deep dives - go back to first topic
                    console.log("🔍 [CHAT] Starting DEEP DIVE cycle - returning to first topic");
                    systemPrompt = PromptBuilder.build(
                        conversation.bot,
                        conversation,
                        botTopics[0], // Go back to first topic
                        methodology,
                        Number(effectiveDuration || 0),
                        { status: 'DEEPENING', focusPoint: 'Explore the most interesting points from our conversation' } as any
                    );
                    nextTopicId = botTopics[0].id;
                    isTransitioning = true;
                } else {
                    // Time is up or we've exhausted everything -> Conclude
                    console.log("✅ [CHAT] Interview complete - concluding");
                    await ChatService.completeInterview(conversationId);
                    return Response.json({
                        text: "Grazie per il tuo tempo. L'intervista è conclusa. INTERVIEW_COMPLETED",
                        isCompleted: true,
                        currentTopicId: conversation.currentTopicId
                    });
                }
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
            console.log(`🔄 [CHAT] Updating topic in DB: ${conversation.currentTopicId} → ${nextTopicId}`);
            await ChatService.updateCurrentTopic(conversationId, nextTopicId);
            console.log(`✅ [CHAT] Topic updated successfully`);
        } else {
            console.log(`⏸️ [CHAT] No topic update needed. isTransitioning=${isTransitioning}, nextTopicId=${nextTopicId}, currentTopicId=${conversation.currentTopicId}`);
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

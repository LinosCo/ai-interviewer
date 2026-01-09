
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
        botTopics.sort((a, b) => a.orderIndex - b.orderIndex);

        const currentTopic = botTopics.find(t => t.id === conversation.currentTopicId) || botTopics[0];
        let currentIndex = botTopics.findIndex(t => t.id === conversation.currentTopicId);
        if (currentIndex === -1) currentIndex = 0;

        // Detect Phase from Metadata
        const metadata = conversation.metadata as any || {};
        const currentPhase = metadata.phase || 'SCAN'; // Default to SCAN

        let supervisorInsight = { status: 'SCANNING' };

        // Fetch API Key
        const openAIKey = await LLMService.getApiKey(conversation.bot, 'openai') || process.env.OPENAI_API_KEY || '';

        if (messages.length > 2) {
            try {
                const insight = await TopicManager.evaluateTopicProgress(
                    messages as any[],
                    currentTopic,
                    openAIKey,
                    currentPhase // Pass phase to TopicManager
                );
                supervisorInsight = insight as any;

                console.log("🔍 [CHAT] Supervisor Decision:", {
                    phase: currentPhase,
                    currentTopic: currentTopic.label,
                    status: supervisorInsight.status,
                    messagesCount: messages.length,
                    reason: (supervisorInsight as any).reason
                });
            } catch (e) {
                console.error("❌ [CHAT] Supervisor error:", e);
            }
        }

        // 5.b. Failsafe for Stuck Topic 1 -> Relaxed for DEEP phase
        const limit = currentPhase === 'SCAN' ? 20 : 25;
        if (currentIndex === 0 && messages.length > limit) {
            console.log("🚨 [CHAT] FORCE TRANSITION: Stuck on Topic 1.");
            supervisorInsight = { status: 'TRANSITION' };
        }

        // 6. Transition & Loop Logic
        const methodology = LLMService.getMethodology();
        const model = await LLMService.getModel(conversation.bot);

        let systemPrompt = "";
        let nextTopicId = conversation.currentTopicId;
        let isTransitioning = false;
        let nextPhase = currentPhase;

        if (supervisorInsight.status === 'TRANSITION') {
            const nextTopic = botTopics[currentIndex + 1];

            if (nextTopic) {
                // Normal transition within current loop
                console.log(`➡️ [CHAT] Transition (${currentPhase}): ${currentTopic.label} → ${nextTopic.label}`);
                systemPrompt = PromptBuilder.buildTransitionPrompt(currentTopic, nextTopic, methodology, currentPhase as any);
                nextTopicId = nextTopic.id;
                isTransitioning = true;
            } else {
                // End of Topics List
                console.log(`🔄 [CHAT] End of topics in phase ${currentPhase}`);

                if (currentPhase === 'SCAN') {
                    // End of SCAN -> Start DEEP LOOP
                    console.log("🚀 [CHAT] Switching to DEEP PHASE. Restarting topics.");
                    nextPhase = 'DEEP';
                    nextTopicId = botTopics[0].id; // Back to first
                    isTransitioning = true;

                    // Build a "Bridging" System Prompt
                    systemPrompt = `
You are an expert interviewer. We have just finished the "Scanning Phase" where we touched all topics lightly.
NOW we are entering the "Deep Dive Phase".
We will restart from the first topic: "${botTopics[0].label}".
Your goal: Re-examine the first topic, but this time ask DEEP, contextual questions based on what the user said earlier.
                    `.trim();

                } else {
                    // End of DEEP -> Finish
                    console.log("✅ [CHAT] Deep Dive Complete. Ending Interview.");
                    await ChatService.completeInterview(conversationId);
                    return Response.json({
                        text: "Grazie per la tua partecipazione approfondita. L'intervista è terminata. INTERVIEW_COMPLETED",
                        isCompleted: true,
                        currentTopicId: conversation.currentTopicId
                    });
                }
            }
        } else {
            // Standard Flow
            systemPrompt = PromptBuilder.build(
                conversation.bot,
                conversation,
                currentTopic,
                methodology,
                Number(effectiveDuration || 0),
                supervisorInsight as any
            );
        }

        // 7. Generate Response
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional().describe("Internal reasoning (hidden from user)")
        });

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));
        if (messagesForAI.length === 0) messagesForAI.push({ role: 'user', content: "I am ready." });

        // Inject Phase context into system prompt if generic
        if (!systemPrompt.includes("PHASE")) {
            systemPrompt += `\n\nCURRENT INTERVIEW PHASE: ${currentPhase}\n` +
                (currentPhase === 'SCAN' ? "Keep it brief. Move fast. Only 2-3 questions per topic." : "Dig deep. Use quotes from user history.");
        }

        const result = await generateObject({
            model,
            schema,
            messages: messagesForAI,
            system: systemPrompt,
            temperature: 0.7
        });

        const responseText = result.object.response;

        // 8. Updates
        if (isTransitioning) {
            // Update Topic
            if (nextTopicId && nextTopicId !== conversation.currentTopicId) {
                await ChatService.updateCurrentTopic(conversationId, nextTopicId);
            }
            // Update Metadata if Phase Changed
            if (nextPhase !== currentPhase) {
                const { prisma } = require('@/lib/prisma');
                await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { metadata: { ...metadata, phase: nextPhase } }
                });
            }
        }

        await ChatService.saveAssistantMessage(conversationId, responseText);

        // Memory Update
        const lastUserContent = lastMessage?.role === 'user' ? lastMessage.content : null;
        if (lastUserContent) {
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

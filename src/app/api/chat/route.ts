
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
                    , conversation.bot.collectCandidateData // isRecruiting (Pass correct param)
                    , conversation.bot.language // Language
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
                supervisorInsight = { status: 'TRANSITION' }; // Default to transition on error
            }
        }

        // 5.b. Failsafe for Stuck Topic -> Scale based on loop index & Phase
        const isDeep = currentPhase === 'DEEP';
        // Assume Scan phase takes approx 3 messages per topic.
        const phaseOffset = isDeep ? (botTopics.length * 3) : 0;
        const msgPerTopic = isDeep ? 8 : 5; // Allow more depth in Deep phase

        const globalHeadroom = phaseOffset + ((currentIndex + 1) * msgPerTopic) + 5;

        if (messages.length > globalHeadroom) {
            console.log(`🚨 [CHAT] FORCE TRANSITION: Messages (${messages.length}) > Headroom (${globalHeadroom}).`);
            supervisorInsight = { status: 'TRANSITION' };
        }

        // 6. Transition & Loop Logic
        const methodology = LLMService.getMethodology();
        const model = await LLMService.getModel(conversation.bot);

        let systemPrompt = "";
        let nextTopicId = conversation.currentTopicId;
        let isTransitioning = false;
        let nextPhase = currentPhase;

        // HANDLE COMPLETION / SKIP (User asked to stop/apply)
        if (supervisorInsight.status === 'COMPLETION') {
            console.log("⏩ [CHAT] FAST-TRACK: User asked to complete/apply.");
            const shouldCollectData = conversation.bot.collectCandidateData;

            if (shouldCollectData) {
                nextPhase = 'DATA_COLLECTION';
                isTransitioning = true;

                // Fake Transition Prompt for Data Collection
                systemPrompt = `
You are acting as a Recruiter.
The user has explicitly asked to APPLY or STOP.
Acknowledge their request warmly.
Then, immediately ask for their details (Name, Email, etc.) to process the application/profile.
Do NOT ask more content questions.
`;
                // Force supervisorInsight to DATA_COLLECTION for PromptBuilder later
                supervisorInsight.status = 'DATA_COLLECTION';

            } else {
                // FAST FINISH
                await ChatService.completeInterview(conversationId);
                return Response.json({
                    text: "Certamente. Grazie per il tuo tempo! L'intervista è conclusa.",
                    isCompleted: true,
                    currentTopicId: conversation.currentTopicId
                });
            }

        } else if (supervisorInsight.status === 'TRANSITION') {
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
                    // End of DEEP -> Check for Data Collection OR Finish
                    const shouldCollectData = conversation.bot.collectCandidateData;

                    if (shouldCollectData && currentPhase !== 'DATA_COLLECTION') {
                        console.log("📝 [CHAT] Deep Dive Complete. Switching to DATA_COLLECTION.");
                        nextPhase = 'DATA_COLLECTION';
                        isTransitioning = true;
                        // Stay on current topic ID or null, doesn't matter much as prompt handles it

                        systemPrompt = `
You are transitioning to the FINAL PHASE: DATA COLLECTION.
The interview content is done.
Now you must ask the user for their details (Name, Email, Contacts) to complete the application.
Be polite and professional.
`;
                    } else {
                        // Truly Finished (either Deep done & no data collection, or Data Collection done)
                        console.log("✅ [CHAT] Interview Complete. Ending.");

                        // Trigger Extraction if Data Collection was active
                        if (currentPhase === 'DATA_COLLECTION' || (shouldCollectData && currentPhase === 'DEEP')) {
                            const { CandidateExtractor } = require('@/lib/llm/candidate-extractor');
                            // Run extraction in background
                            CandidateExtractor.extractProfile(messages, openAIKey).then(async (profile: any) => {
                                if (profile) {
                                    const { prisma } = require('@/lib/prisma');
                                    await prisma.conversation.update({
                                        where: { id: conversationId },
                                        data: { candidateProfile: profile }
                                    });
                                    console.log("👤 [CHAT] Candidate Profile Saved:", profile.fullName);
                                }
                            }).catch((e: any) => console.error("Extraction failed", e));
                        }

                        await ChatService.completeInterview(conversationId);
                        return Response.json({
                            text: "Grazie! Abbiamo registrato tutto. A presto! INTERVIEW_COMPLETED",
                            isCompleted: true,
                            currentTopicId: conversation.currentTopicId
                        });
                    }
                }
            }
        } else if (currentPhase === 'DATA_COLLECTION') {
            // Special handling for Data Collection Phase loop
            // If we are here, it means we are already IN the phase.
            // We need to check if we should finish.
            // Simple heuristic: If message length in this phase > 3 or user said goodbye.
            // But for now, let reliance be on the PromptBuilder `DATA_COLLECTION` instruction to say 'INTERVIEW_COMPLETED' logic?
            // Actually, my PromptBuilder change puts `DATA_COLLECTION` prompt in `supervisorInsight`.
            // But `TopicManager` doesn't know about `DATA_COLLECTION` phase in `evaluateTopicProgress`.

            // So I should force supervisorInsight logic here manually if phase is DATA.
            supervisorInsight = { status: 'DATA_COLLECTION' };
            // But we need to detect if we are DONE.
            // Let's rely on the LLM outputting INTERVIEW_COMPLETED if it got the data.
            // The prompt I added says "If user provides data... say INTERVIEW_COMPLETED".
            // So the standard `checkLimits` or client side handles completion token?
            // Yes, `ChatInterface` handles `INTERVIEW_COMPLETED`.

            systemPrompt = PromptBuilder.build(
                conversation.bot,
                conversation,
                currentTopic,
                methodology,
                Number(effectiveDuration || 0),
                supervisorInsight as any
            );
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

        // Check for Explicit Completion Tag (used in Data Collection)
        if (responseText.includes('INTERVIEW_COMPLETED')) {
            await ChatService.completeInterview(conversationId);

            // Trigger Extraction
            if (currentPhase === 'DATA_COLLECTION') {
                const { CandidateExtractor } = require('@/lib/llm/candidate-extractor');
                CandidateExtractor.extractProfile(messages, openAIKey).then(async (profile: any) => {
                    if (profile) {
                        const { prisma } = require('@/lib/prisma');
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { candidateProfile: profile }
                        });
                    }
                });
            }

            return Response.json({
                text: responseText.replace('INTERVIEW_COMPLETED', '').trim(),
                currentTopicId: nextTopicId,
                isCompleted: true
            });
        }

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

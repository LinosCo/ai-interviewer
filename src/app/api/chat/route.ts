
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
        const { messages, conversationId, botId, effectiveDuration, introMessage } = body;

        // 1. Data Loading & Validation
        const conversation = await ChatService.loadConversation(conversationId, botId);

        // 2. Persist User Message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'user') {
            await ChatService.saveUserMessage(conversationId, lastMessage.content);
        }

        // 3. Update Progress
        await ChatService.updateProgress(conversationId, Number(effectiveDuration || conversation.effectiveDuration));

        // 5. Topic Supervision
        const botTopics = conversation.bot.topics;
        botTopics.sort((a, b) => a.orderIndex - b.orderIndex);

        const currentTopic = botTopics.find(t => t.id === conversation.currentTopicId) || botTopics[0];
        let currentIndex = botTopics.findIndex(t => t.id === conversation.currentTopicId);
        if (currentIndex === -1) currentIndex = 0;

        // Detect Phase from Metadata
        const metadata = (conversation as any).metadata || {};
        const currentPhase = metadata.phase || 'SCAN'; // Default to SCAN

        let supervisorInsight = { status: 'SCANNING' };

        // 4. Check Limits
        const statusCheck = await ChatService.checkLimits(conversationId);
        const shouldCollectData = (conversation.bot as any).collectCandidateData;
        console.log("🔍 [CHAT] Limits Check:", { shouldConclude: statusCheck.shouldConclude, shouldCollectData });

        // Check time/turn limits - force end if exceeded
        if (statusCheck.shouldConclude && currentPhase !== 'DATA_COLLECTION') {
            console.log("⏰ [CHAT] Time/Turn limit reached.");

            if (shouldCollectData) {
                // Skip remaining topics and go directly to data collection
                console.log("📝 [CHAT] Forcing transition to DATA_COLLECTION due to limits.");
                supervisorInsight = { status: 'COMPLETION' };
            } else {
                // No data collection - end interview
                await ChatService.completeInterview(conversationId);
                return Response.json({
                    text: (conversation.bot.language === 'it'
                        ? "Il tempo a disposizione per questa intervista è terminato. Grazie per la partecipazione!"
                        : "The time for this interview has ended. Thank you for participating!") + " INTERVIEW_COMPLETED",
                    isCompleted: true,
                    currentTopicId: conversation.currentTopicId
                });
            }
        }

        // Fetch API Key
        const openAIKey = await LLMService.getApiKey(conversation.bot, 'openai') || process.env.OPENAI_API_KEY || '';

        // 5. Topic Evaluation (skip if we already decided to collect data or terminate)
        if (messages.length > 2 && supervisorInsight.status !== 'COMPLETION') {
            // SKIP TOPIC EVALUATION IN DATA COLLECTION PHASE
            if (currentPhase === 'DATA_COLLECTION') {
                supervisorInsight = { status: 'DATA_COLLECTION' };
            } else {
                try {
                    // Calculate remaining time for adaptive depth
                    const maxDurationMins = conversation.bot.maxDurationMins || 10;
                    const elapsedMins = Math.floor((Number(effectiveDuration || conversation.effectiveDuration) || 0) / 60);
                    const remainingMins = maxDurationMins - elapsedMins;

                    // Calculate how many topics are left in DEEP
                    const topicsRemaining = currentPhase === 'DEEP' ? (botTopics.length - currentIndex) : botTopics.length;
                    const timePerTopic = remainingMins / (topicsRemaining || 1);

                    const insight = await TopicManager.evaluateTopicProgress(
                        messages as any[],
                        currentTopic,
                        openAIKey,
                        currentPhase // Pass phase to TopicManager
                        , (conversation.bot as any).collectCandidateData // isRecruiting (Pass correct param)
                        , conversation.bot.language // Language
                        , timePerTopic // NEW: time budget per topic
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
        }

        // 5.b. Failsafe for Stuck Topic -> Scale based on loop index & Phase
        // ONLY apply if we haven't already decided to complete/collect data
        if (supervisorInsight.status !== 'COMPLETION') {
            const isDeep = currentPhase === 'DEEP';
            // SCAN phase: 2 exchanges per topic (1 assistant question + 1 user response = 2 messages)
            // Add some buffer for intro, but keep it tight
            const phaseOffset = isDeep ? (botTopics.length * 3) : 0;
            const msgPerTopic = isDeep ? 6 : 3; // SCAN: ~3 msgs/topic, DEEP: ~6 msgs/topic

            const globalHeadroom = phaseOffset + ((currentIndex + 1) * msgPerTopic) + 3;

            // DISABLE HEADROOM CHECK FOR DATA COLLECTION
            if (currentPhase !== 'DATA_COLLECTION' && messages.length > globalHeadroom) {
                console.log(`🚨 [CHAT] FORCE TRANSITION: Messages (${messages.length}) > Headroom (${globalHeadroom}).`);
                supervisorInsight = { status: 'TRANSITION' };
            }
        }

        // 6. Transition & Loop Logic
        const methodology = LLMService.getMethodology();
        const model = await LLMService.getModel(conversation.bot);

        let systemPrompt = "";
        let nextTopicId = conversation.currentTopicId;
        let isTransitioning = false;
        let nextPhase = currentPhase;

        // HANDLE COMPLETION / SKIP (User asked to stop/apply)
        if (supervisorInsight.status === 'COMPLETION' || (supervisorInsight as any).status === 'TRANSITION_TO_DATA') {
            console.log("⏩ [CHAT] Fast-tracking to DATA_COLLECTION or Ending.");

            if (shouldCollectData) {
                nextPhase = 'DATA_COLLECTION';
                isTransitioning = true;

                // Direct Transition to Data Collection
                const softOfferInstruction = PromptBuilder.buildSoftOfferPrompt(conversation.bot.language || 'en');

                systemPrompt = await PromptBuilder.build(
                    conversation.bot,
                    conversation,
                    currentTopic,
                    methodology,
                    Number(effectiveDuration || 0),
                    softOfferInstruction
                );
                // Force status for PromptBuilder mapping if needed (though we use systemPrompt override)
                supervisorInsight.status = 'DATA_COLLECTION_FIRST_ASK';

            } else {
                // FAST FINISH
                await ChatService.completeInterview(conversationId);
                const text = conversation.bot.language === 'it' ? "Certamente. Grazie per il tuo tempo! L'intervista è conclusa." : "Certainly. Thank you for your time! The interview is concluded.";
                return Response.json({
                    text: text + " INTERVIEW_COMPLETED",
                    isCompleted: true,
                    currentTopicId: conversation.currentTopicId
                });
            }

        } else if (supervisorInsight.status === 'TRANSITION') {
            const nextTopic = botTopics[currentIndex + 1];

            if (nextTopic) {
                // Normal transition within current loop
                console.log(`➡️ [CHAT] Transition (${currentPhase}): ${currentTopic.label} → ${nextTopic.label}`);
                const transitionInstruction = PromptBuilder.buildTransitionPrompt(currentTopic, nextTopic, methodology, currentPhase as any);
                systemPrompt = await PromptBuilder.build(
                    conversation.bot,
                    conversation,
                    nextTopic,
                    methodology,
                    Number(effectiveDuration || 0),
                    transitionInstruction
                );
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
                    const bridgeInstruction = PromptBuilder.buildBridgePrompt(
                        botTopics[0],
                        conversation.bot.language || 'en'
                    );

                    systemPrompt = await PromptBuilder.build(
                        conversation.bot,
                        conversation,
                        botTopics[0],
                        methodology,
                        Number(effectiveDuration || 0),
                        bridgeInstruction
                    );

                } else {
                    // End of DEEP -> Check for Data Collection OR Finish
                    const shouldCollectData = (conversation.bot as any).collectCandidateData;

                    if (shouldCollectData && currentPhase !== 'DATA_COLLECTION') {
                        console.log("📝 [CHAT] Deep Dive Complete. Switching to DATA_COLLECTION.");
                        nextPhase = 'DATA_COLLECTION';
                        isTransitioning = true;

                        const dataInstruction = PromptBuilder.buildSoftOfferPrompt(conversation.bot.language || 'en');

                        systemPrompt = await PromptBuilder.build(
                            conversation.bot,
                            conversation,
                            currentTopic,
                            methodology,
                            Number(effectiveDuration || 0),
                            dataInstruction
                        );
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
        }

        // 6.b. FINAL PROMPT ASSEMBLY
        // If systemPrompt is still empty, build it using the standard builder
        if (!systemPrompt) {
            // Force status to DATA_COLLECTION if we are in that phase to ensure correct instructions
            const insightForPrompt = currentPhase === 'DATA_COLLECTION'
                ? { status: 'DATA_COLLECTION' }
                : supervisorInsight;

            systemPrompt = await PromptBuilder.build(
                conversation.bot,
                conversation,
                currentTopic,
                methodology,
                Number(effectiveDuration || 0),
                insightForPrompt as any
            );
        }

        // 7. Generate Response
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional().describe("Internal reasoning (hidden from user)")
        });

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));
        // Never inject "I am ready" - if empty, let the system prompt handle it or assume start.
        // But the client should always send at least the intro message if it exists.

        // Inject Phase context into system prompt if generic
        // FIX: Use nextPhase to avoid conflict if transitioning (e.g. DEEP -> DATA)
        if (!systemPrompt.includes("PHASE")) {
            // If transitioning to DATA_COLLECTION, don't inject the standard SCAN/DEEP prompts
            if (nextPhase === 'DATA_COLLECTION') {
                systemPrompt += `\n\nCURRENT INTERVIEW PHASE: DATA_COLLECTION\nGoal: Securely collect candidate contact details. Be professional and reassuring.`;
            } else {
                systemPrompt += `\n\nCURRENT INTERVIEW PHASE: ${nextPhase}\n` +
                    (nextPhase === 'SCAN' ? "Keep it brief. Move fast. Only 2-3 questions per topic." : "Dig deep. Use quotes from user history. Reference specific user details.");
            }

            // INJECT TIME PRESSURE (Only in DEEP phase loop)
            if (nextPhase === 'DEEP' && supervisorInsight.status !== 'TRANSITION' && !isTransitioning) {
                const maxDurationMins = conversation.bot.maxDurationMins || 10;
                const elapsedMins = Math.floor((Number(effectiveDuration || conversation.effectiveDuration) || 0) / 60);
                const remainingMins = maxDurationMins - elapsedMins;
                // Rough estimate of remaining topics
                const topicsRemaining = botTopics.length - currentIndex;
                const budgetPerTopic = remainingMins / (topicsRemaining || 1);

                if (budgetPerTopic < 2.0 && remainingMins > 0) {
                    systemPrompt += `\n\n⚠️ TIME ALERT: You have very limited time left (${budgetPerTopic.toFixed(1)} mins for this topic). ASK ONLY ONE FINAL QUESTION for this topic. Make it count, then we must move on. Be concise.`;
                }
            }
        }

        // Final Global Reinforcement
        systemPrompt += `\n\n## MANDATORY CHARACTER RULE:\nYour response MUST end with a question mark (?). This is a hard constraint. Even if you are saying goodbye or transitioning, finish the turns with a clear question to the user.`;

        // Inject Custom Intro Message Requirement (Only at the very start)
        if (introMessage && messagesForAI.length <= 1) {
            systemPrompt += `\n\nIMPORTANT: You are starting the interview. Your response MUST begin with the following text exactly:\n"${introMessage}"\nThen, immediately follow up with your first question or statement as per the methodology. Do not repeat the greeting if it's already in the text. combine them naturally.`;
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

        // 7.5. Check if user consented to data collection (if we asked but haven't started collecting yet)
        if (nextPhase === 'DATA_COLLECTION' && currentPhase === 'DATA_COLLECTION' && !isTransitioning) {
            // We're in DATA_COLLECTION but haven't transitioned yet - check if this is consent
            const lastUserMsg = lastMessage?.content || '';

            // USE ROBUST LLM CHECK
            const userIntent = await TopicManager.checkConsent(
                lastUserMsg,
                openAIKey,
                conversation.bot.language || 'en'
            );

            if (userIntent === 'CONSENT') {
                // User gave consent - mark as transitioning to actually start collecting
                console.log("✅ [CHAT] User consented to data collection (LLM verified). Starting field collection.");
                isTransitioning = true;
            } else if (userIntent === 'REFUSAL') {
                // User refused - end interview
                console.log("❌ [CHAT] User refused data collection. Ending.");
                await ChatService.completeInterview(conversationId);
                return Response.json({
                    text: (conversation.bot.language === 'it' ? "Va bene, nessun problema. Grazie ancora per il tuo tempo!" : "Alright, no problem. Thank you again for your time!") + " INTERVIEW_COMPLETED",
                    isCompleted: true,
                    currentTopicId: conversation.currentTopicId
                });
            }
            // If NEUTRAL, do nothing (let the AI reply normally to clarify)
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

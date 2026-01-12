
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

        if (statusCheck.shouldConclude && currentPhase !== 'DATA_COLLECTION') {
            if (shouldCollectData && currentPhase !== 'DATA_COLLECTION' && currentPhase !== 'TRANSITION_TO_DATA') {
                console.log("⏰ [CHAT] Time/Turn limit reached. Offering DATA_COLLECTION.");
                // We don't return early. We force a transition below.
                supervisorInsight.status = 'TRANSITION_TO_DATA';
            } else {
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

        if (messages.length > 2) {
            // SKIP TOPIC EVALUATION IN DATA COLLECTION PHASE
            if (currentPhase === 'DATA_COLLECTION') {
                supervisorInsight = { status: 'DATA_COLLECTION' };
            } else {
                try {
                    const insight = await TopicManager.evaluateTopicProgress(
                        messages as any[],
                        currentTopic,
                        openAIKey,
                        currentPhase // Pass phase to TopicManager
                        , (conversation.bot as any).collectCandidateData // isRecruiting (Pass correct param)
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
        }

        // 5.b. Failsafe for Stuck Topic -> Scale based on loop index & Phase
        const isDeep = currentPhase === 'DEEP';
        // Assume Scan phase takes approx 3 messages per topic.
        const phaseOffset = isDeep ? (botTopics.length * 3) : 0;
        const msgPerTopic = isDeep ? 8 : 5; // Allow more depth in Deep phase

        const globalHeadroom = phaseOffset + ((currentIndex + 1) * msgPerTopic) + 5;

        // DISABLE HEADROOM CHECK FOR DATA COLLECTION
        if (currentPhase !== 'DATA_COLLECTION' && messages.length > globalHeadroom) {
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
        if (supervisorInsight.status === 'COMPLETION' || (supervisorInsight as any).status === 'TRANSITION_TO_DATA') {
            console.log("⏩ [CHAT] Fast-tracking to DATA_COLLECTION or Ending.");

            if (shouldCollectData) {
                nextPhase = 'DATA_COLLECTION';
                isTransitioning = true;

                // Soft Transition Prompt for Data Collection
                const isItalian = conversation.bot.language === 'it';
                systemPrompt = isItalian ? `
## TRANSIZIONE: OFFERTA RACCOLTA DATI (LEAD GEN)
L'intervista è terminata per limiti raggiunti o completamento temi.
1. Comunica chiaramente che la parte di contenuto dell'intervista è conclusa.
2. Sii esplicito: "Vorrei chiederti un ultimo favore. Ti andrebbe di lasciare il tuo contatto per essere ricontattato o approfondire ulteriormente in futuro?"
3. Se l'utente dice di sì o si mostra interessato, procederemo con la richiesta dei dati.
` : `
## TRANSITION: DATA COLLECTION OFFERING
The interview content is complete or limits reached.
1. Formally state that the interview phase is finished.
2. Be explicit: "I'd like to ask a final favor. Would you be interested in leaving your contact information so we can follow up or keep this conversation open in the future?"
3. If the user agrees or shows interest, we will proceed to collect the details.
`;
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
                    const isItalian = conversation.bot.language === 'it';
                    systemPrompt = isItalian ? `
## TRANSIZIONE ALLA FASE DEEP DIVE (APPROFONDIMENTO)
Abbiamo completato la panoramica generale (Scanning).
Ora ripartiamo dal primo tema: "${botTopics[0].label}".

**ISTRUZIONI PER L'INTERVISTATORE**:
1. Spiega chiaramente all'utente: "Abbiamo finito la panoramica veloce. Ora vorrei tornare su alcuni punti interessanti che hai menzionato per andare più a fondo."
2. Inizia col primo tema: "${botTopics[0].label}".
3. **REGOLA D'ORO**: Cita un dettaglio specifico che l'utente ha detto prima riguardo a questo tema. Mostra di aver memorizzato le sue risposte precedenti.
4. Chiedi di approfondire quel dettaglio specifico.
` : `
## TRANSITION TO DEEP DIVE PHASE
We have finished the general overview (Scanning).
Now we restart from the first topic: "${botTopics[0].label}".

**INSTRUCTIONS FOR THE INTERVIEWER**:
1. Explicitly state to the user: "We've finished the quick overview. Now I'd like to revisit a few interesting points you mentioned earlier to explore them in more depth."
2. Start with the first topic: "${botTopics[0].label}".
3. **GOLDEN RULE**: Quote a specific detail the user mentioned earlier regarding this topic. Show that you remembered their previous answers.
4. Ask to delve deeper into that specific detail.
`;

                } else {
                    // End of DEEP -> Check for Data Collection OR Finish
                    const shouldCollectData = (conversation.bot as any).collectCandidateData;

                    if (shouldCollectData && currentPhase !== 'DATA_COLLECTION') {
                        console.log("📝 [CHAT] Deep Dive Complete. Switching to DATA_COLLECTION.");
                        nextPhase = 'DATA_COLLECTION';
                        isTransitioning = true;
                        // Stay on current topic ID or null, doesn't matter much as prompt handles it

                        const isItalian = conversation.bot.language === 'it';
                        systemPrompt = isItalian ? `
## TRANSIZIONE: FINE INTERVISTA -> INTERESSE DATI
Abbiamo terminato tutti i temi.
1. Ringrazia e comunica che l'intervista di contenuto è finita.
2. Chiedi se è interessato a lasciare i propri dati per essere ricontattato o candidarsi (senza chiederli subito).
3. Sii molto cordiale.
` : `
## TRANSITION: END OF CONTENT -> DATA INTEREST
All topics are covered.
1. Thank the user and state the content interview is finished.
2. Ask if they'd be interested in leaving their details to be contacted or to apply (don't ask for fields yet).
3. Be very warm.
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

        // Inject Custom Intro Message Requirement
        if (introMessage) {
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

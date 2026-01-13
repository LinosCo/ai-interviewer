
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
                const isItalian = conversation.bot.language === 'it';
                const softOfferInstruction = isItalian ? `
## TRANSIZIONE CRITICA: RICHIESTA DATI DI CONTATTO
Il tempo/turni dell'intervista sono esauriti.

**ISTRUZIONI OBBLIGATORIE**:
1. **RINGRAZIAMENTO**: Ringrazia sinceramente per il tempo dedicato
2. **COMUNICAZIONE CHIARA**: Spiega che l'intervista è conclusa per limiti temporali
3. **RICHIESTA DIRETTA E CORDIALE**: Chiedi i dati di contatto in modo diretto ma amichevole
   - NON essere vago: "Vorrei chiederti i tuoi dati di contatto"
   - NON dire "se vuoi", "magari", "eventualmente"
   - SPIEGA IL PERCHÉ: "per poterti ricontattare/per restare in contatto"
4. **ASPETTA CONFERMA**: Attendi che l'utente confermi prima di chiedere campi specifici
5. Tono: Professionale ma caloroso, come un recruiter

**STRUTTURA ESEMPIO**:
"[Nome], ti ringrazio molto per il tempo che hai dedicato a questa conversazione. Purtroppo abbiamo esaurito il tempo a disposizione, ma vorrei davvero restare in contatto con te. Posso chiederti i tuoi dati di contatto?"
` : `
## CRITICAL TRANSITION: REQUEST CONTACT DATA
Interview time/turns limit reached.

**MANDATORY INSTRUCTIONS**:
1. **THANK YOU**: Sincerely thank them for their time
2. **CLEAR COMMUNICATION**: Explain the interview concluded due to time limits
3. **DIRECT & FRIENDLY REQUEST**: Ask for contact details directly but warmly
   - DO NOT be vague: "I'd like to ask for your contact details"
   - DO NOT say "if you want", "maybe", "possibly"
   - EXPLAIN WHY: "so we can follow up/stay in touch"
4. **WAIT FOR CONFIRMATION**: Wait for user to confirm before asking specific fields
5. Tone: Professional but warm, like a recruiter

**EXAMPLE STRUCTURE**:
"[Name], thank you so much for the time you've dedicated to this conversation. Unfortunately we've reached our time limit, but I'd really like to stay in touch with you. May I ask for your contact details?"
`;
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
                    const isItalian = conversation.bot.language === 'it';
                    const bridgeInstruction = isItalian ? `
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

                        const isItalian = conversation.bot.language === 'it';
                        const dataInstruction = isItalian ? `
## TRANSIZIONE CRITICA: PASSAGGIO A RACCOLTA DATI
Abbiamo completato tutti i temi dell'intervista.

**ISTRUZIONI OBBLIGATORIE**:
1. Ringrazia calorosamente l'utente per il tempo dedicato
2. **COMUNICAZIONE ESPLICITA**: Devi dire chiaramente che l'intervista di contenuto è finita
3. **RICHIESTA DIRETTA**: Chiedi DIRETTAMENTE se vuole lasciare i suoi dati di contatto
   - NON essere vago o timido
   - NON dire "se ti va", "magari", "eventualmente"
   - DI': "Vorrei chiederti i tuoi dati di contatto per restare in contatto"
4. **ASPETTA CONSENSO**: Non chiedere subito i campi specifici, aspetta che confermi interesse
5. Tono: Cordiale ma professionale, come un recruiter

**ESEMPIO**:
"Perfetto! Abbiamo finito con le domande di contenuto. Ti ringrazio davvero per il tempo e gli spunti preziosi che hai condiviso. Prima di salutarci, vorrei chiederti i tuoi dati di contatto per poterti ricontattare. Ti va?"
` : `
## CRITICAL TRANSITION: MOVE TO DATA COLLECTION
All interview topics are complete.

**MANDATORY INSTRUCTIONS**:
1. Warmly thank the user for their time
2. **EXPLICIT COMMUNICATION**: Clearly state that the content interview is finished
3. **DIRECT REQUEST**: Ask DIRECTLY if they want to leave contact details
   - DO NOT be vague or shy
   - DO NOT say "if you'd like", "maybe", "possibly"
   - SAY: "I'd like to ask for your contact details to stay in touch"
4. **WAIT FOR CONSENT**: Don't ask for specific fields yet, wait for them to confirm interest
5. Tone: Friendly but professional, like a recruiter

**EXAMPLE**:
"Great! We've finished with the content questions. Thank you so much for your time and the valuable insights you've shared. Before we wrap up, I'd like to ask for your contact details so we can follow up. Would that work for you?"
`;
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
        if (!systemPrompt.includes("PHASE")) {
            systemPrompt += `\n\nCURRENT INTERVIEW PHASE: ${currentPhase}\n` +
                (currentPhase === 'SCAN' ? "Keep it brief. Move fast. Only 2-3 questions per topic." : "Dig deep. Use quotes from user history. Reference specific user details.");
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
            const lastUserMsg = lastMessage?.content?.toLowerCase() || '';
            const consentKeywords = ['sì', 'si', 'yes', 'ok', 'certo', 'volentieri', 'va bene', 'sure', 'yeah', 'va benissimo', 'perfetto', 'certamente'];
            const hasConsented = consentKeywords.some(keyword => lastUserMsg.includes(keyword));

            if (hasConsented && lastUserMsg.length < 100) {
                // User gave consent - mark as transitioning to actually start collecting
                console.log("✅ [CHAT] User consented to data collection. Starting field collection.");
                isTransitioning = true;
            }
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

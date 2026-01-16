
import { ChatService } from '@/services/chat-service';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { LLMService } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    SCAN_TURNS_PER_TOPIC: 3,        // Target turns per topic in SCAN (was 2, too short)
    SECONDS_PER_TURN: 45,           // Average time per turn (read + respond + process)
    TIME_BUFFER_PERCENT: 0.15,      // Below this remaining % -> offer optional DEEP
    DEEP_QUICK_TURNS: 2,            // Turns per topic if user accepts quick DEEP (was 1)
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
};

// ============================================================================
// TYPES
// ============================================================================
type Phase = 'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'DATA_COLLECTION';

interface InterviewState {
    phase: Phase;
    topicIndex: number;
    turnInTopic: number;
    deepAccepted: boolean | null;   // null = not asked yet
    consentGiven: boolean | null;   // null = not asked yet
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    deepTurnsPerTopic: number;      // Calculated budget for DEEP phase
}

// ============================================================================
// HELPER: Extract field from user message
// ============================================================================
async function extractFieldFromMessage(
    fieldName: string,
    userMessage: string,
    apiKey: string,
    language: string = 'en'
): Promise<{ value: string | null; confidence: 'high' | 'low' | 'none' }> {
    const openai = createOpenAI({ apiKey });

    const fieldDescriptions: Record<string, string> = {
        name: language === 'it' ? 'Nome e cognome della persona' : 'Full name of the person',
        email: language === 'it' ? 'Indirizzo email' : 'Email address',
        phone: language === 'it' ? 'Numero di telefono' : 'Phone number',
        company: language === 'it' ? 'Nome dell\'azienda o organizzazione' : 'Company or organization name',
        linkedin: language === 'it' ? 'URL del profilo LinkedIn o social' : 'LinkedIn or social profile URL',
        portfolio: language === 'it' ? 'URL del portfolio o sito web personale' : 'Portfolio or personal website URL',
        role: language === 'it' ? 'Ruolo o posizione lavorativa' : 'Job role or position',
        location: language === 'it' ? 'Città o località' : 'City or location',
        budget: language === 'it' ? 'Budget disponibile' : 'Available budget',
        availability: language === 'it' ? 'Disponibilità temporale' : 'Time availability'
    };

    const schema = z.object({
        extractedValue: z.string().nullable(),
        confidence: z.enum(['high', 'low', 'none'])
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `Extract "${fieldName}" (${fieldDescriptions[fieldName] || fieldName}) from: "${userMessage}"\n\nRules:\n- Return null if not found\n- Do NOT infer name from email address\n- For email: look for xxx@xxx.xxx pattern\n- For phone: look for numeric sequences`,
            temperature: 0
        });
        return { value: result.object.extractedValue, confidence: result.object.confidence };
    } catch (e) {
        console.error(`Field extraction failed for "${fieldName}":`, e);
        return { value: null, confidence: 'none' };
    }
}

// ============================================================================
// HELPER: Check user intent (consent/refusal/neutral)
// ============================================================================
async function checkUserIntent(
    userMessage: string,
    apiKey: string,
    language: string,
    context: 'consent' | 'deep_offer'
): Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'> {
    const openai = createOpenAI({ apiKey });

    const contextPrompts = {
        consent: `The system asked for contact details. Did the user agree?`,
        deep_offer: `The system offered to continue with deeper questions. Did the user accept?`
    };

    const schema = z.object({
        intent: z.enum(['ACCEPT', 'REFUSE', 'NEUTRAL']),
        reason: z.string()
    });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `${contextPrompts[context]}\nLanguage: ${language}\nUser message: "${userMessage}"\n\nClassify: ACCEPT (yes, ok, sure, va bene), REFUSE (no, skip, basta), NEUTRAL (question or unrelated)`,
            temperature: 0
        });
        return result.object.intent;
    } catch (e) {
        console.error('Intent check failed:', e);
        return 'NEUTRAL';
    }
}

// ============================================================================
// HELPER: Calculate time budget for DEEP phase
// ============================================================================
function calculateDeepBudget(
    effectiveDurationSec: number,
    maxDurationMins: number,
    numTopics: number
): { canDoDeep: boolean; turnsPerTopic: number; isLowTime: boolean } {
    const maxDurationSec = maxDurationMins * 60;
    const remainingSec = maxDurationSec - effectiveDurationSec;
    const remainingPercent = remainingSec / maxDurationSec;

    // If we're below buffer, time is almost up
    const isLowTime = remainingPercent <= CONFIG.TIME_BUFFER_PERCENT;

    if (remainingSec <= 0) {
        return { canDoDeep: false, turnsPerTopic: 0, isLowTime: true };
    }

    // Calculate available turns
    const totalTurnsAvailable = Math.floor(remainingSec / CONFIG.SECONDS_PER_TURN);
    const turnsPerTopic = Math.max(1, Math.floor(totalTurnsAvailable / numTopics));

    return {
        canDoDeep: totalTurnsAvailable >= numTopics, // At least 1 turn per topic
        turnsPerTopic,
        isLowTime
    };
}

// ============================================================================
// HELPER: Complete interview and save profile
// ============================================================================
async function completeInterview(
    conversationId: string,
    messages: any[],
    apiKey: string,
    existingProfile: any
): Promise<void> {
    try {
        const { CandidateExtractor } = require('@/lib/llm/candidate-extractor');
        const extractedProfile = await CandidateExtractor.extractProfile(messages, apiKey, conversationId);
        if (extractedProfile) {
            const mergedProfile = { ...extractedProfile, ...existingProfile };
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { candidateProfile: mergedProfile }
            });
            console.log("👤 Profile saved:", mergedProfile.email || 'partial');
        }
    } catch (e) {
        console.error("Profile extraction failed:", e);
    }
    await ChatService.completeInterview(conversationId);
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration, introMessage } = body;

        // ====================================================================
        // 1. LOAD DATA
        // ====================================================================
        const conversation = await ChatService.loadConversation(conversationId, botId);
        const bot = conversation.bot;
        const language = bot.language || 'en';
        const shouldCollectData = (bot as any).collectCandidateData;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'user') {
            await ChatService.saveUserMessage(conversationId, lastMessage.content);
        }

        await ChatService.updateProgress(conversationId, Number(effectiveDuration || conversation.effectiveDuration));

        // Topics
        const botTopics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
        const numTopics = botTopics.length;

        // ====================================================================
        // 2. LOAD STATE
        // ====================================================================
        const rawMetadata = (conversation as any).metadata || {};
        const state: InterviewState = {
            phase: rawMetadata.phase || 'SCAN',
            topicIndex: rawMetadata.topicIndex ?? 0,
            turnInTopic: rawMetadata.turnInTopic ?? 0,
            deepAccepted: rawMetadata.deepAccepted ?? null,
            consentGiven: rawMetadata.consentGiven ?? null,
            lastAskedField: rawMetadata.lastAskedField ?? null,
            dataCollectionAttempts: rawMetadata.dataCollectionAttempts ?? 0,
            deepTurnsPerTopic: rawMetadata.deepTurnsPerTopic ?? 0,
        };

        const currentTopic = botTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number(effectiveDuration || conversation.effectiveDuration) || 0;
        const maxDurationMins = bot.maxDurationMins || 10;

        // API Key
        const openAIKey = await LLMService.getApiKey(bot, 'openai') || process.env.OPENAI_API_KEY || '';

        console.log("📊 [CHAT] State:", {
            phase: state.phase,
            topic: currentTopic.label,
            topicIndex: state.topicIndex,
            turnInTopic: state.turnInTopic,
            effectiveSec,
            maxDurationMins
        });

        // ====================================================================
        // 3. PHASE MACHINE
        // ====================================================================
        let nextState = { ...state };
        let systemPrompt = "";
        let nextTopicId = currentTopic.id;
        let supervisorInsight: any = { status: 'SCANNING' };

        // --------------------------------------------------------------------
        // PHASE: SCAN
        // --------------------------------------------------------------------
        if (state.phase === 'SCAN') {
            // Check if we should transition to next topic
            if (state.turnInTopic >= CONFIG.SCAN_TURNS_PER_TOPIC) {
                // Move to next topic
                if (state.topicIndex + 1 < numTopics) {
                    nextState.topicIndex = state.topicIndex + 1;
                    nextState.turnInTopic = 0;
                    nextTopicId = botTopics[nextState.topicIndex].id;

                    console.log(`➡️ [SCAN] Topic transition: ${currentTopic.label} → ${botTopics[nextState.topicIndex].label}`);
                    supervisorInsight = { status: 'TRANSITION', nextTopic: botTopics[nextState.topicIndex].label };
                } else {
                    // End of SCAN - check time for DEEP
                    const budget = calculateDeepBudget(effectiveSec, maxDurationMins, numTopics);
                    console.log("📊 [SCAN] Complete. Budget:", budget);

                    if (budget.isLowTime) {
                        // Time almost up - offer optional DEEP
                        nextState.phase = 'DEEP_OFFER';
                        nextState.deepAccepted = null; // Reset to trigger DEEP_OFFER_ASK
                        supervisorInsight = { status: 'DEEP_OFFER_ASK' }; // FIX: was 'DEEP_OFFER' which isn't handled
                    } else if (budget.canDoDeep) {
                        // Enough time - go to DEEP
                        nextState.phase = 'DEEP';
                        nextState.topicIndex = 0;
                        nextState.turnInTopic = 0;
                        nextState.deepTurnsPerTopic = budget.turnsPerTopic;
                        nextTopicId = botTopics[0].id;
                        supervisorInsight = { status: 'START_DEEP' };
                    } else {
                        // No time for DEEP - go to DATA_COLLECTION or END
                        if (shouldCollectData) {
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        nextState.consentGiven = false; // Waiting for consent
                        } else {
                            await completeInterview(conversationId, messages, openAIKey, conversation.candidateProfile || {});
                            return Response.json({
                                text: language === 'it'
                                    ? "Grazie mille per il tuo tempo! L'intervista è conclusa."
                                    : "Thank you so much for your time! The interview is complete.",
                                isCompleted: true,
                                currentTopicId: currentTopic?.id || null
                            });
                        }
                    }
                }
            } else {
                // Continue SCAN on current topic
                nextState.turnInTopic = state.turnInTopic + 1;

                // Ask TopicManager for next sub-goal
                const insight = await TopicManager.generateScanQuestion(
                    currentTopic,
                    state.turnInTopic,
                    openAIKey,
                    language
                );
                supervisorInsight = { status: 'SCANNING', nextSubGoal: insight.nextSubGoal };
            }
        }

        // --------------------------------------------------------------------
        // PHASE: DEEP_OFFER
        // --------------------------------------------------------------------
        else if (state.phase === 'DEEP_OFFER') {
            console.log(`🎁 [DEEP_OFFER] State: deepAccepted=${state.deepAccepted}`);

            if (state.deepAccepted === null) {
                // First time - bot will ask the offer question
                console.log(`🎁 [DEEP_OFFER] First time, asking offer question`);
                supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                nextState.deepAccepted = false; // Mark that we're waiting for response
            } else if (state.deepAccepted === false) {
                // We asked, now check user's response
                console.log(`🎁 [DEEP_OFFER] Checking user response: "${lastMessage?.content}"`);
                const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'deep_offer');
                console.log(`🎁 [DEEP_OFFER] Intent detected: ${intent}`);

                if (intent === 'ACCEPT') {
                    nextState.deepAccepted = true;
                    nextState.phase = 'DEEP';
                    nextState.topicIndex = 0;
                    nextState.turnInTopic = 0;
                    nextState.deepTurnsPerTopic = CONFIG.DEEP_QUICK_TURNS;
                    nextTopicId = botTopics[0].id;
                    supervisorInsight = { status: 'START_DEEP' };
                    console.log("✅ [DEEP_OFFER] User accepted quick DEEP");
                } else if (intent === 'REFUSE') {
                    console.log("❌ [DEEP_OFFER] User declined");
                    if (shouldCollectData) {
                        nextState.phase = 'DATA_COLLECTION';
                        supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        nextState.consentGiven = false; // Waiting for consent
                    } else {
                        await completeInterview(conversationId, messages, openAIKey, conversation.candidateProfile || {});
                        return Response.json({
                            text: language === 'it'
                                ? "Perfetto, grazie per il tuo tempo!"
                                : "Perfect, thank you for your time!",
                            isCompleted: true,
                            currentTopicId: currentTopic?.id || null
                        });
                    }
                } else {
                    // NEUTRAL - re-ask
                    console.log(`🎁 [DEEP_OFFER] Neutral response, re-asking`);
                    supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                }
            }
        }

        // --------------------------------------------------------------------
        // PHASE: DEEP
        // --------------------------------------------------------------------
        else if (state.phase === 'DEEP') {
            // Use the budget calculated at end of SCAN (stored in state.deepTurnsPerTopic)
            // DATA_COLLECTION is OUTSIDE time budget - it's extra!
            const turnsLimit = state.deepTurnsPerTopic || CONFIG.DEEP_QUICK_TURNS;

            console.log(`📊 [DEEP] Topic ${state.topicIndex + 1}/${numTopics}, Turn ${state.turnInTopic + 1}/${turnsLimit}`);

            if (state.turnInTopic >= turnsLimit) {
                // Move to next topic
                if (state.topicIndex + 1 < numTopics) {
                    nextState.topicIndex = state.topicIndex + 1;
                    nextState.turnInTopic = 0;
                    nextTopicId = botTopics[nextState.topicIndex].id;

                    console.log(`➡️ [DEEP] Topic transition: ${currentTopic.label} → ${botTopics[nextState.topicIndex].label}`);
                    supervisorInsight = { status: 'TRANSITION', nextTopic: botTopics[nextState.topicIndex].label };
                } else {
                    // End of DEEP - ALL topics done, move to DATA_COLLECTION
                    console.log(`✅ [DEEP] All ${numTopics} topics completed. Moving to DATA_COLLECTION.`);
                    if (shouldCollectData) {
                        nextState.phase = 'DATA_COLLECTION';
                        supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        nextState.consentGiven = false;
                    } else {
                        await completeInterview(conversationId, messages, openAIKey, conversation.candidateProfile || {});
                        return Response.json({
                            text: language === 'it'
                                ? "Grazie mille! Abbiamo concluso l'intervista."
                                : "Thank you so much! The interview is complete.",
                            isCompleted: true,
                            currentTopicId: currentTopic?.id || null
                        });
                    }
                }
            } else {
                // Continue DEEP on current topic
                nextState.turnInTopic = state.turnInTopic + 1;

                // Ask TopicManager for focus point (MUST be different each turn)
                const insight = await TopicManager.generateDeepQuestion(
                    currentTopic,
                    state.turnInTopic,
                    messages.slice(-10),
                    openAIKey,
                    language
                );
                supervisorInsight = { status: 'DEEPENING', focusPoint: insight.focusPoint };
                console.log(`🔍 [DEEP] Continuing topic "${currentTopic.label}", turn ${nextState.turnInTopic}/${turnsLimit}`);
            }
        }

        // --------------------------------------------------------------------
        // PHASE: DATA_COLLECTION
        // --------------------------------------------------------------------
        else if (state.phase === 'DATA_COLLECTION') {
            console.log(`📋 [DATA_COLLECTION] State: consentGiven=${state.consentGiven}, lastAskedField=${state.lastAskedField}, attempts=${state.dataCollectionAttempts}`);

            // Anti-loop protection
            if (state.dataCollectionAttempts >= CONFIG.MAX_DATA_COLLECTION_ATTEMPTS) {
                await completeInterview(conversationId, messages, openAIKey, conversation.candidateProfile || {});
                return Response.json({
                    text: language === 'it'
                        ? "Grazie per le informazioni fornite. L'intervista è conclusa!"
                        : "Thank you for the information. The interview is complete!",
                    isCompleted: true,
                    currentTopicId: currentTopic?.id || null
                });
            }

            const candidateFields = (bot.candidateDataFields as any[]) || [];
            let currentProfile = (conversation.candidateProfile as any) || {};
            console.log(`📋 [DATA_COLLECTION] Fields to collect: ${candidateFields.map((f: any) => typeof f === 'string' ? f : f.field).join(', ')}`);
            console.log(`📋 [DATA_COLLECTION] Current profile: ${JSON.stringify(currentProfile)}`);

            // STEP 1: Handle consent flow
            if (state.consentGiven === null) {
                // First time in DATA_COLLECTION - ask for consent
                console.log(`📋 [DATA_COLLECTION] Asking for consent (first time)`);
                supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                nextState.consentGiven = false; // Mark that we're waiting for response
                nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
            } else if (state.consentGiven === false) {
                // We asked for consent, now check user's response
                console.log(`📋 [DATA_COLLECTION] Checking consent response: "${lastMessage?.content}"`);
                const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'consent');
                console.log(`📋 [DATA_COLLECTION] Intent detected: ${intent}`);

                if (intent === 'ACCEPT') {
                    nextState.consentGiven = true;
                    console.log(`📋 [DATA_COLLECTION] User accepted, will ask first field`);
                    // Don't set supervisorInsight here - let it fall through to ask first field
                } else if (intent === 'REFUSE') {
                    console.log(`📋 [DATA_COLLECTION] User refused`);
                    await completeInterview(conversationId, messages, openAIKey, currentProfile);
                    return Response.json({
                        text: language === 'it'
                            ? "Nessun problema. Grazie per il tuo tempo!"
                            : "No problem. Thank you for your time!",
                        isCompleted: true,
                        currentTopicId: currentTopic?.id || null
                    });
                } else {
                    // NEUTRAL - re-ask consent
                    console.log(`📋 [DATA_COLLECTION] Neutral response, re-asking consent`);
                    supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                    nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                }
            }

            // STEP 2: If consent given (now or before), handle field collection
            if (nextState.consentGiven === true || state.consentGiven === true) {
                console.log(`📋 [DATA_COLLECTION] Consent given, processing fields`);

                // CHECK: Did user change their mind mid-collection? ("basta", "non voglio", "stop")
                const REFUSAL_MID_COLLECTION_IT = /\b(basta|non voglio|stop|preferisco fermarmi|non continuare|lascia stare)\b/i;
                const REFUSAL_MID_COLLECTION_EN = /\b(stop|enough|i don't want|let's stop|never mind|forget it)\b/i;
                const refusalPattern = language === 'it' ? REFUSAL_MID_COLLECTION_IT : REFUSAL_MID_COLLECTION_EN;

                if (lastMessage?.role === 'user' && refusalPattern.test(lastMessage.content)) {
                    console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection`);
                    await completeInterview(conversationId, messages, openAIKey, currentProfile);
                    return Response.json({
                        text: language === 'it'
                            ? "Nessun problema, grazie per il tempo dedicato!"
                            : "No problem, thank you for your time!",
                        isCompleted: true,
                        currentTopicId: currentTopic?.id || null
                    });
                }

                // CHECK: Did user say they don't have this field? ("non ho email", "I don't have")
                const SKIP_FIELD_IT = /\b(non ho|non ce l'ho|non posso|preferisco non)\b/i;
                const SKIP_FIELD_EN = /\b(i don't have|don't have|can't provide|prefer not to)\b/i;
                const skipPattern = language === 'it' ? SKIP_FIELD_IT : SKIP_FIELD_EN;
                const userWantsToSkip = lastMessage?.role === 'user' && skipPattern.test(lastMessage.content);

                // Extract ALL possible fields from user message (user might provide multiple at once)
                if (lastMessage?.role === 'user' && !userWantsToSkip) {
                    const fieldsToExtract = candidateFields
                        .map((f: any) => typeof f === 'string' ? f : f.field)
                        .filter((fieldName: string) => !currentProfile[fieldName]); // Only missing fields

                    console.log(`📋 [DATA_COLLECTION] Attempting to extract fields: ${fieldsToExtract.join(', ')} from: "${lastMessage.content}"`);

                    for (const fieldName of fieldsToExtract) {
                        const extraction = await extractFieldFromMessage(
                            fieldName,
                            lastMessage.content,
                            openAIKey,
                            language
                        );

                        if (extraction.value && extraction.confidence !== 'none') {
                            currentProfile = { ...currentProfile, [fieldName]: extraction.value };
                            console.log(`✅ [DATA_COLLECTION] Extracted "${fieldName}": "${extraction.value}"`);
                        }
                    }

                    // Save all extracted fields at once
                    if (Object.keys(currentProfile).length > 0) {
                        await prisma.conversation.update({
                            where: { id: conversationId },
                            data: { candidateProfile: currentProfile }
                        });
                        console.log(`✅ [DATA_COLLECTION] Saved profile: ${JSON.stringify(currentProfile)}`);
                    }
                } else if (userWantsToSkip && state.lastAskedField) {
                    // User wants to skip this field - mark it as skipped so we don't ask again
                    console.log(`📋 [DATA_COLLECTION] User wants to skip "${state.lastAskedField}"`);
                    currentProfile = { ...currentProfile, [state.lastAskedField]: '__SKIPPED__' };
                    await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { candidateProfile: currentProfile }
                    });
                }

                // Find next missing field (skip fields marked as __SKIPPED__)
                let nextField = null;
                for (const field of candidateFields) {
                    const fieldName = typeof field === 'string' ? field : field.field;
                    if (!currentProfile[fieldName] || currentProfile[fieldName] === '__SKIPPED__') {
                        // If it's skipped, don't ask again
                        if (currentProfile[fieldName] === '__SKIPPED__') continue;
                        nextField = fieldName;
                        break;
                    }
                }
                console.log(`📋 [DATA_COLLECTION] Next field to ask: ${nextField || 'NONE - all collected'}`);

                if (!nextField) {
                    // All fields collected!
                    console.log(`✅ [DATA_COLLECTION] All fields collected, completing interview`);
                    await completeInterview(conversationId, messages, openAIKey, currentProfile);
                    return Response.json({
                        text: language === 'it'
                            ? "Grazie mille per tutte le informazioni. L'intervista è conclusa, ti contatteremo presto!"
                            : "Thank you for all the information. The interview is complete, we will contact you soon!",
                        isCompleted: true,
                        currentTopicId: currentTopic?.id || null
                    });
                }

                // Set up to ask next field
                nextState.lastAskedField = nextField;
                nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                nextState.consentGiven = true;
                supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextField };
                console.log(`📋 [DATA_COLLECTION] Will ask for: ${nextField}`);
            }
        }

        // ====================================================================
        // 4. BUILD PROMPT
        // ====================================================================
        const methodology = LLMService.getMethodology();
        const model = await LLMService.getModel(bot);
        const targetTopic = botTopics[nextState.topicIndex] || currentTopic;

        systemPrompt = await PromptBuilder.build(
            bot,
            conversation,
            targetTopic,
            methodology,
            effectiveSec,
            supervisorInsight
        );

        // Inject intro message at start
        if (introMessage && messages.length <= 1) {
            systemPrompt += `\n\nIMPORTANT: Start your response with exactly:\n"${introMessage}"\nThen follow with your first question.`;
        }

        // Phase-specific injections
        if (supervisorInsight.status === 'DEEP_OFFER_ASK') {
            const offerText = language === 'it'
                ? "Abbiamo quasi finito il tempo a disposizione. Vorresti approfondire qualche argomento con qualche altra domanda, oppure preferisci concludere?"
                : "We're almost out of time. Would you like to explore some topics in more depth with a few more questions, or would you prefer to wrap up?";
            systemPrompt += `\n\n## DEEP OFFER\nYou must ask: "${offerText}"`;
        }

        // Final reinforcement based on phase - CLEAR STATUS BANNER
        if (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') {
            const currentTopicLabel = botTopics[nextState.topicIndex]?.label || 'current topic';
            const turnsInfo = nextState.phase === 'SCAN'
                ? `Turn ${nextState.turnInTopic}/${CONFIG.SCAN_TURNS_PER_TOPIC}`
                : `Turn ${nextState.turnInTopic}/${nextState.deepTurnsPerTopic || CONFIG.DEEP_QUICK_TURNS}`;

            systemPrompt += `

## ═══════════════════════════════════════════════════════
## 📍 CURRENT STATUS: ${nextState.phase} PHASE
## Topic: "${currentTopicLabel}" (${nextState.topicIndex + 1}/${numTopics})
## Progress: ${turnsInfo}
## ═══════════════════════════════════════════════════════

🚫 **FORBIDDEN ACTIONS (will be blocked by system):**
- Asking for contacts/email/phone/name
- Saying goodbye or wrapping up
- Mentioning "before we conclude" or similar

✅ **YOUR ONLY TASK:**
- Ask ONE question about "${currentTopicLabel}"
- End with a question mark (?)

The SUPERVISOR controls phase transitions. Just focus on asking good questions.
`;
        }

        systemPrompt += `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;

        // ====================================================================
        // 5. GENERATE RESPONSE
        // ====================================================================
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional()
        });

        const messagesForAI = messages.map((m: any) => ({ role: m.role, content: m.content }));

        console.log("⏳ [CHAT] Generating response...");
        console.time("LLM");

        let result: any;
        try {
            result = await Promise.race([
                generateObject({ model, schema, messages: messagesForAI, system: systemPrompt, temperature: 0.7 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 45000))
            ]);
        } catch (error: any) {
            if (error.message === "TIMEOUT") {
                const fallback = language === 'it'
                    ? "Mi scuso, ho bisogno di un momento. Puoi ripetere?"
                    : "I apologize, I need a moment. Could you repeat that?";
                await ChatService.saveAssistantMessage(conversationId, fallback);
                return Response.json({ text: fallback, currentTopicId: nextTopicId, isCompleted: false });
            }
            throw error;
        }

        console.timeEnd("LLM");
        let responseText = result.object.response;

        // ====================================================================
        // 5.5 POST-PROCESSING: Detect premature closures and vague responses
        // ====================================================================
        const GOODBYE_PATTERNS_IT = /\b(arrivederci|buona giornata|buona serata|a presto|ci sentiamo|grazie per il tuo tempo|è stato un piacere|ti auguro|in bocca al lupo|ti contatteremo|ti terremo aggiornato)\b/i;
        const GOODBYE_PATTERNS_EN = /\b(goodbye|see you|take care|have a great day|it was a pleasure|best wishes|all the best|farewell|we will contact you|we'll be in touch)\b/i;
        const goodbyePattern = language === 'it' ? GOODBYE_PATTERNS_IT : GOODBYE_PATTERNS_EN;

        // Vague data collection patterns - bot is not asking for specific field
        const VAGUE_DATA_PATTERNS_IT = /\b(quali contatti|che tipo di dati|le informazioni che preferisci|condividi.*contatti|c'è qualcos'altro|qualcos'altro da aggiungere|altri temi|altre domande|vuoi aggiungere)\b/i;
        const VAGUE_DATA_PATTERNS_EN = /\b(which contact|what type of data|information you prefer|share.*contact|anything else|something to add|other topics|other questions|want to add)\b/i;
        const vagueDataPattern = language === 'it' ? VAGUE_DATA_PATTERNS_IT : VAGUE_DATA_PATTERNS_EN;

        const isGoodbyeResponse = goodbyePattern.test(responseText);
        const isVagueDataRequest = vagueDataPattern.test(responseText);
        const hasNoQuestion = !responseText.includes('?');

        // CRITICAL: Detect "goodbye with question" pattern (e.g., "Buona giornata! Ci vediamo?")
        // This is a closure attempt disguised as a question
        const isGoodbyeWithQuestion = isGoodbyeResponse && responseText.includes('?');
        if (isGoodbyeWithQuestion) {
            console.log(`⚠️ [SUPERVISOR] Detected goodbye phrase WITH question mark - treating as closure attempt`);
        }

        // CRITICAL: Detect premature contact requests (bot asking for contacts during SCAN/DEEP)
        const CONTACT_REQUEST_PATTERNS_IT = /\b(posso chiederti i tuoi contatti|i tuoi dati di contatto|la tua email|il tuo numero|come ti chiami|qual è la tua email|prima di salutarci|prima di concludere.*contatt)/i;
        const CONTACT_REQUEST_PATTERNS_EN = /\b(may i ask for your contact|your contact details|your email|your phone|what is your name|before we say goodbye.*contact|before we wrap up.*contact)/i;
        const contactRequestPattern = language === 'it' ? CONTACT_REQUEST_PATTERNS_IT : CONTACT_REQUEST_PATTERNS_EN;
        const isPrematureContactRequest = contactRequestPattern.test(responseText) && nextState.phase !== 'DATA_COLLECTION';
        if (isPrematureContactRequest) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to ask for contacts during ${nextState.phase} phase - intercepting!`);
        }

        // Helper to get field label
        const getFieldLabel = (field: string, lang: string) => {
            const labels: Record<string, { it: string; en: string }> = {
                name: { it: 'il tuo nome', en: 'your name' },
                email: { it: 'la tua email', en: 'your email' },
                phone: { it: 'il tuo numero di telefono', en: 'your phone number' },
                company: { it: 'la tua azienda', en: 'your company' },
                role: { it: 'il tuo ruolo', en: 'your role' },
                linkedin: { it: 'il tuo profilo LinkedIn', en: 'your LinkedIn profile' }
            };
            return labels[field]?.[lang === 'it' ? 'it' : 'en'] || field;
        };

        // Helper to get direct question for field
        const getDirectQuestion = (field: string, lang: string) => {
            const questions: Record<string, { it: string; en: string }> = {
                name: { it: 'Perfetto! Come ti chiami?', en: 'Perfect! What is your name?' },
                email: { it: 'Grazie! Qual è la tua email?', en: 'Thanks! What is your email?' },
                phone: { it: 'Ottimo! Qual è il tuo numero di telefono?', en: 'Great! What is your phone number?' },
                company: { it: 'Per quale azienda lavori?', en: 'What company do you work for?' },
                role: { it: 'Qual è il tuo ruolo?', en: 'What is your role?' },
                linkedin: { it: 'Qual è il tuo profilo LinkedIn?', en: 'What is your LinkedIn profile?' }
            };
            return questions[field]?.[lang === 'it' ? 'it' : 'en'] || `Qual è ${getFieldLabel(field, lang)}?`;
        };

        // If in DATA_COLLECTION phase, ALWAYS ensure we ask for the specific field
        if (nextState.phase === 'DATA_COLLECTION') {
            const candidateFields = (bot.candidateDataFields as any[]) || [];

            // CRITICAL: Re-read profile from DB to get updated values after extraction
            // The `conversation.candidateProfile` is stale (from start of request)
            const freshConversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfile = (freshConversation?.candidateProfile as any) || {};

            // Find first missing field
            let missingField: string | null = null;
            for (const field of candidateFields) {
                const fieldName = typeof field === 'string' ? field : field.field;
                if (!currentProfile[fieldName]) {
                    missingField = fieldName;
                    break;
                }
            }

            // CONSENT PHASE: bot should ask for permission
            if (nextState.consentGiven === false && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion || isVagueDataRequest)) {
                console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. Overriding.`);
                responseText = language === 'it'
                    ? "Grazie mille per questa conversazione interessante! Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?"
                    : "Thank you so much for this interesting conversation! Before we say goodbye, may I ask for your contact details to stay in touch?";
            }
            // FIELD COLLECTION PHASE: bot should ask for specific field
            else if (nextState.consentGiven === true && missingField) {
                // Check if bot is being vague, saying goodbye, or not asking the right question
                // CRITICAL: isGoodbyeWithQuestion catches "Buona giornata! Ci vediamo?" patterns
                const isAskingWrongThing = isVagueDataRequest || isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion;

                // Also check if bot is asking a generic question instead of specific field
                const specificFieldPattern = language === 'it'
                    ? new RegExp(`\\b(nome|email|telefono|azienda|ruolo|linkedin)\\b.*\\?`, 'i')
                    : new RegExp(`\\b(name|email|phone|company|role|linkedin)\\b.*\\?`, 'i');
                const isAskingSpecificField = specificFieldPattern.test(responseText);

                if (isAskingWrongThing || !isAskingSpecificField) {
                    console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". Overriding.`);
                    console.log(`   Original response: "${responseText.substring(0, 100)}..."`);
                    responseText = getDirectQuestion(missingField, language);
                }
            }
            // ALL FIELDS COLLECTED but bot didn't complete
            else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                responseText = (language === 'it'
                    ? "Grazie mille per tutte le informazioni! Ti contatteremo presto."
                    : "Thank you so much for all the information! We will contact you soon.") + " INTERVIEW_COMPLETED";
            }
        }
        // Other phases - OVERRIDE if bot tries to close OR asks for contacts prematurely
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion || isPrematureContactRequest)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Overriding with appropriate question.`);
            console.log(`   Original response: "${responseText.substring(0, 100)}..."`);

            // Use TOPIC LABEL for natural-sounding questions (not the subGoal which can be action-oriented)
            const targetTopic = botTopics[nextState.topicIndex] || currentTopic;
            const topicLabel = targetTopic?.label || 'questo argomento';

            // Generate a natural follow-up question using the topic label
            if (nextState.phase === 'SCAN') {
                responseText = language === 'it'
                    ? `Interessante! Tornando al tema "${topicLabel}", qual è la tua esperienza diretta in merito?`
                    : `Interesting! Going back to "${topicLabel}", what has been your direct experience with this?`;
            } else {
                responseText = language === 'it'
                    ? `Grazie per questo spunto. Riguardo a "${topicLabel}", puoi approfondire un aspetto specifico che ti sta a cuore?`
                    : `Thanks for that insight. Regarding "${topicLabel}", can you elaborate on a specific aspect that matters to you?`;
            }
        }
        else if (nextState.phase === 'DEEP_OFFER' && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. Overriding with offer question.`);
            responseText = language === 'it'
                ? "Grazie mille per queste risposte interessanti! Il tempo che avevamo previsto sta per terminare, ma se hai ancora qualche minuto, avrei alcune domande di approfondimento che mi piacerebbe farti. Ti va di continuare?"
                : "Thank you so much for these insightful answers! Our scheduled time is almost up, but if you have a few more minutes, I'd love to ask some deeper follow-up questions. Would you like to continue?";
        }

        // Check for completion tag - only valid if we're actually done
        if (/INTERVIEW_COMPLETED/i.test(responseText)) {
            // Verify we're actually done - MUST re-read from DB for fresh data
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const freshConvForCompletion = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfileForCompletion = (freshConvForCompletion?.candidateProfile as any) || {};
            const allFieldsCollected = candidateFields.every((field: any) => {
                const fieldName = typeof field === 'string' ? field : field.field;
                return !!currentProfileForCompletion[fieldName];
            });

            if (shouldCollectData && !allFieldsCollected && nextState.consentGiven !== false) {
                // Not done yet! Remove the tag and continue
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED but fields are missing. Removing tag.`);
                responseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();
                if (!responseText.includes('?')) {
                    let nextField = null;
                    for (const field of candidateFields) {
                        const fieldName = typeof field === 'string' ? field : field.field;
                        if (!currentProfileForCompletion[fieldName]) {
                            nextField = fieldName;
                            break;
                        }
                    }
                    const fieldLabel = nextField === 'name' ? (language === 'it' ? 'il tuo nome' : 'your name')
                        : nextField === 'email' ? (language === 'it' ? 'la tua email' : 'your email')
                        : nextField === 'phone' ? (language === 'it' ? 'il tuo numero di telefono' : 'your phone number')
                        : nextField;
                    responseText = language === 'it'
                        ? `${responseText} Qual è ${fieldLabel}?`
                        : `${responseText} What is ${fieldLabel}?`;
                }
            } else {
                // Actually complete
                await completeInterview(conversationId, messages, openAIKey, currentProfileForCompletion || {});
                return Response.json({
                    text: responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim(),
                    currentTopicId: nextTopicId,
                    isCompleted: true
                });
            }
        }

        // ====================================================================
        // 6. SAVE & UPDATE STATE
        // ====================================================================
        await ChatService.saveAssistantMessage(conversationId, responseText);

        // Update topic if changed
        if (nextTopicId !== currentTopic.id) {
            await ChatService.updateCurrentTopic(conversationId, nextTopicId);
        }

        // Save state
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                metadata: nextState,
                currentTopicId: nextTopicId
            }
        });

        // Memory update (async)
        if (lastMessage?.role === 'user') {
            MemoryManager.updateAfterUserResponse(
                conversationId,
                lastMessage.content,
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

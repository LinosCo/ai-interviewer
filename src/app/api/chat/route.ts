
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
    isConfirmingExit: boolean;      // Confirmation for stopping
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    deepTurnsPerTopic: number;      // Calculated budget for DEEP phase
    fieldAttemptCounts: Record<string, number>;  // Track attempts per field to prevent loops
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
        fullName: language === 'it'
            ? 'Nome della persona (può essere solo nome, o nome e cognome)'
            : 'Name of the person (can be first name only, or full name)',
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
        const nameSpecificRules = fieldName === 'fullName'
            ? `\n- For name: Accept first name only (e.g., "Marco", "Geppi", "Anna"). Don't require full name.\n- If the message contains a word that looks like a name, extract it.`
            : '';

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `Extract "${fieldName}" (${fieldDescriptions[fieldName] || fieldName}) from: "${userMessage}"\n\nRules:\n- Return null if not found\n- Do NOT infer name from email address\n- For email: look for xxx@xxx.xxx pattern\n- For phone: look for numeric sequences${nameSpecificRules}`,
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
    context: 'consent' | 'deep_offer' | 'stop_confirmation'
): Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'> {
    const openai = createOpenAI({ apiKey });

    const contextPrompts = {
        consent: `The system asked for contact details. Did the user agree?`,
        deep_offer: `The system offered to continue with deeper questions. Did the user accept?`,
        stop_confirmation: `The system noticed the user might be tired or wants to stop, and asked for confirmation to conclude. Did the user confirm they want to STOP?`
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
        console.log(`\n🚀 [CHAT_API] Processing message for conversation: ${conversationId}`);

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
            isConfirmingExit: rawMetadata.isConfirmingExit ?? false,
            lastAskedField: rawMetadata.lastAskedField ?? null,
            dataCollectionAttempts: rawMetadata.dataCollectionAttempts ?? 0,
            deepTurnsPerTopic: rawMetadata.deepTurnsPerTopic ?? 0,
            fieldAttemptCounts: rawMetadata.fieldAttemptCounts ?? {},
        };

        const currentTopic = botTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number(effectiveDuration || conversation.effectiveDuration) || 0;
        const maxDurationMins = bot.maxDurationMins || 10;

        // API Key
        const openAIKey = await LLMService.getApiKey(bot, 'openai') || process.env.OPENAI_API_KEY || '';

        console.log(`📊 [STATE] Phase: ${state.phase}, Topic: ${currentTopic.label}, Index: ${state.topicIndex}, Turn: ${state.turnInTopic}`);
        console.log(`⏱️ [TIME] Effective: ${effectiveSec}s / Max: ${maxDurationMins}m`);

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

        // GLOBAL CHECK: Did the user express a desire to stop or skip during the main interview?
        const isScanOrDeep = state.phase === 'SCAN' || state.phase === 'DEEP';
        if (isScanOrDeep && lastMessage?.role === 'user') {
            if (state.isConfirmingExit) {
                // We were waiting for confirmation to stop
                const confIntent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'stop_confirmation');
                if (confIntent === 'ACCEPT') {
                    console.log("🚫 [INTENT] User confirmed STOP. Moving to conclusion/data collection.");
                    nextState.isConfirmingExit = false;
                    if (shouldCollectData) {
                        nextState.phase = 'DATA_COLLECTION';
                        nextState.consentGiven = false;
                        supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                    } else {
                        nextState.topicIndex = numTopics;
                        supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    }
                } else {
                    console.log("✅ [INTENT] User wants to continue. Clearing confirmation flag.");
                    nextState.isConfirmingExit = false;
                }
            } else {
                // Check if they want to stop for the first time
                const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'deep_offer');
                if (intent === 'REFUSE') {
                    console.log(`🚫 [INTENT] User might want to stop during ${state.phase}. Asking for confirmation.`);
                    nextState.isConfirmingExit = true;
                    supervisorInsight = { status: 'CONFIRM_STOP' };
                }
            }
        }

        // --------------------------------------------------------------------
        // PHASE: MACHINE (only if not confirming exit)
        // --------------------------------------------------------------------
        if (!nextState.isConfirmingExit && supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT') {
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
                                // Let the AI say goodbye
                                nextState.phase = 'DATA_COLLECTION';
                                supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
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
                            nextState.consentGiven = false;
                        } else {
                            // Let the AI say goodbye
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
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
                            // Let the AI say goodbye
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
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
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                }

                const candidateFields = (bot.candidateDataFields as any[]) || [];
                let currentProfile = (conversation.candidateProfile as any) || {};
                console.log(`📋 [DATA_COLLECTION] Fields to collect: ${candidateFields.map((f: any) => typeof f === 'string' ? f : (f.id || f.field)).join(', ')}`);
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
                        console.log(`📋 [DATA_COLLECTION] User refused consent.`);
                        await completeInterview(conversationId, messages, openAIKey, currentProfile);
                        // Set status for AI to say goodbye
                        supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
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

                    // CHECK: Is user frustrated/complaining about repeated questions?
                    const FRUSTRATION_IT = /\b(già (detto|chiesto)|te l'ho (già|appena)|incantato|bloccato|ripeti|sempre la stessa|loop)\b/i;
                    const FRUSTRATION_EN = /\b(already (told|said|asked)|just (told|said)|stuck|loop|same question|repeating)\b/i;
                    const frustrationPattern = language === 'it' ? FRUSTRATION_IT : FRUSTRATION_EN;
                    const userFrustrated = lastMessage?.role === 'user' && frustrationPattern.test(lastMessage.content);

                    if (lastMessage?.role === 'user' && refusalPattern.test(lastMessage.content)) {
                        console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection`);
                        await completeInterview(conversationId, messages, openAIKey, currentProfile);
                        supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    }

                    // If user is frustrated about repeated questions, try to extract info from conversation history
                    // and complete the interview with what we have
                    if (userFrustrated) {
                        console.log(`⚠️ [DATA_COLLECTION] User frustrated - attempting to extract from history and complete`);

                        // Try to find the name in previous messages if we don't have it
                        if (!currentProfile.fullName) {
                            // Look for a short reply (1-3 words) after a "name" question
                            for (let i = messages.length - 1; i >= 0; i--) {
                                const msg = messages[i];
                                if (msg.role === 'user') {
                                    const content = msg.content.trim();
                                    const words = content.split(/\s+/);
                                    // Short response that looks like a name
                                    if (words.length <= 3 && content.length < 30 && !/[@\d]/.test(content)) {
                                        const cleanedName = content.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedName.length > 1) {
                                            currentProfile = { ...currentProfile, fullName: cleanedName };
                                            console.log(`✅ [DATA_COLLECTION] Recovered name from history: "${cleanedName}"`);
                                            await prisma.conversation.update({
                                                where: { id: conversationId },
                                                data: { candidateProfile: currentProfile }
                                            });
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // Complete with what we have
                        await completeInterview(conversationId, messages, openAIKey, currentProfile);
                        supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    }

                    // CHECK: Did user say they don't have this field? ("non ho email", "I don't have")
                    const SKIP_FIELD_IT = /\b(non ho|non ce l'ho|non posso|preferisco non)\b/i;
                    const SKIP_FIELD_EN = /\b(i don't have|don't have|can't provide|prefer not to)\b/i;
                    const skipPattern = language === 'it' ? SKIP_FIELD_IT : SKIP_FIELD_EN;
                    const userWantsToSkip = lastMessage?.role === 'user' && skipPattern.test(lastMessage.content);

                    // Extract ALL possible fields from user message (user might provide multiple at once)
                    if (lastMessage?.role === 'user' && !userWantsToSkip) {
                        const fieldsToExtract = candidateFields
                            .map((f: any) => typeof f === 'string' ? f : (f.id || f.field))
                            .filter((fieldName: string) => !currentProfile[fieldName]); // Only missing fields

                        console.log(`📋 [DATA_COLLECTION] Attempting to extract fields: ${fieldsToExtract.join(', ')} from: "${lastMessage.content}"`);

                        // SPECIAL HANDLING FOR NAME: If we asked for name and user replied with 1-3 words, use it directly
                        const userReply = lastMessage.content.trim();
                        const wordCount = userReply.split(/\s+/).length;
                        if (state.lastAskedField === 'fullName' && wordCount <= 3 && !currentProfile.fullName) {
                            // User probably just gave their name - use it directly
                            const cleanedName = userReply.replace(/[.!?,;:]/g, '').trim();
                            if (cleanedName.length > 0 && cleanedName.length < 50) {
                                currentProfile = { ...currentProfile, fullName: cleanedName };
                                console.log(`✅ [DATA_COLLECTION] Direct name capture: "${cleanedName}"`);
                            }
                        }

                        const extractions = await Promise.all(
                            fieldsToExtract.map(async (fieldName) => {
                                if (fieldName === 'fullName' && currentProfile.fullName) return { fieldName, extraction: { value: null, confidence: 'none' } };

                                const extraction = await extractFieldFromMessage(
                                    fieldName,
                                    lastMessage.content,
                                    openAIKey,
                                    language
                                );
                                return { fieldName, extraction };
                            })
                        );

                        for (const { fieldName, extraction } of extractions) {
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

                    // Find next missing field (skip fields marked as __SKIPPED__ or asked too many times)
                    const MAX_FIELD_ATTEMPTS = 3; // Skip field if asked more than 3 times
                    let nextField = null;
                    for (const field of candidateFields) {
                        const fieldName = typeof field === 'string' ? field : (field.id || field.field);
                        const attempts = state.fieldAttemptCounts[fieldName] || 0;

                        // Skip if already collected, explicitly skipped, or asked too many times
                        if (currentProfile[fieldName] && currentProfile[fieldName] !== '__SKIPPED__') continue;
                        if (currentProfile[fieldName] === '__SKIPPED__') continue;
                        if (attempts >= MAX_FIELD_ATTEMPTS) {
                            console.log(`⚠️ [DATA_COLLECTION] Skipping "${fieldName}" - asked ${attempts} times without success`);
                            continue;
                        }

                        nextField = fieldName;
                        break;
                    }
                    console.log(`📋 [DATA_COLLECTION] Next field to ask: ${nextField || 'NONE - all collected/skipped'}`);

                    if (!nextField) {
                        // All fields collected or skipped!
                        console.log(`✅ [DATA_COLLECTION] All fields collected/skipped, letting AI say final goodbye`);
                        // We will add the tag via supervisor or just instruct AI
                        supervisorInsight = { status: 'FINAL_GOODBYE' };
                    }

                    // Set up to ask next field - track attempt count
                    nextState.lastAskedField = nextField;
                    nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                    nextState.consentGiven = true;
                    nextState.fieldAttemptCounts = {
                        ...state.fieldAttemptCounts,
                        [nextField]: (state.fieldAttemptCounts[nextField] || 0) + 1
                    };
                    supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextField };
                }
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

        console.log("📝 [PROMPT_BUILDER] System Prompt length:", systemPrompt.length);
        // console.log("📝 [PROMPT_BUILDER] System Prompt snippet:", systemPrompt.substring(0, 500) + "...");

        // Inject intro message at start
        if (introMessage && messages.length <= 1) {
            systemPrompt += `\n\nIMPORTANT: Start your response with exactly:\n"${introMessage}"\nThen follow with your first question.`;
        }

        // Phase-specific injections

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
        console.log(`🤖 [LLM_RESPONSE]: "${responseText.substring(0, 100)}..."`);

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

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

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
                console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. (No override to respect AI Reasoning)`);
            }
            // FIELD COLLECTION PHASE: bot should ask for specific field
            else if (nextState.consentGiven === true && missingField) {
                console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". (No override to respect AI Reasoning)`);
            }
            // ALL FIELDS COLLECTED but bot didn't complete
            else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                responseText += " INTERVIEW_COMPLETED";
            }
        }
        // Other phases - OVERRIDE if bot tries to close OR asks for contacts prematurely
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion || isPrematureContactRequest)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. (No override to respect AI Reasoning)`);
        }
        else if (nextState.phase === 'DEEP_OFFER' && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. (No override to respect AI Reasoning)`);
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
                    console.log(`⚠️ [SUPERVISOR] Bot ending without question during completion check. (No override to respect AI Reasoning)`);
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

        console.log(`✅ [CHAT_API] Finished. Response sent. Next Phase: ${nextState.phase}`);

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

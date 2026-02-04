
import { ChatService } from '@/services/chat-service';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder } from '@/lib/llm/prompt-builder';
import { LLMService } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { prisma } from '@/lib/prisma';
import { TokenTrackingService } from '@/services/tokenTrackingService';

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
type Phase = 'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'TIME_UP_OFFER' | 'DATA_COLLECTION';

interface InitialBudget {
    scanTurnsPerTopic: number;        // 2-5 calculated dynamically
    estimatedScanDurationSec: number;
    reservedForDeepSec: number;
    reservedForDataCollectionSec: number;
    perTopicTimeSec: number;
}

interface InterestingTopic {
    topicId: string;
    topicLabel: string;
    engagementScore: number;  // 0-1 based on response length
    bestSnippet?: string;
}

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
    closureAttempts: number;        // Track consecutive closure attempts to prevent infinite loops
    // NEW: Dynamic time budget
    initialBudget?: InitialBudget;
    interestingTopics?: InterestingTopic[];
    timeUpOfferAccepted?: boolean | null;  // null = not asked, false = waiting, true = accepted
    timeUpSelectedTopics?: string[];       // Topic IDs selected for continuation
    deepTopicOrder?: string[];             // Ordered topic IDs for DEEP based on value
    topicSubGoalHistory?: Record<string, string[]>; // Track used sub-goals per topic
}

// ============================================================================ 
// HELPERS: Engagement scoring and snippets
// ============================================================================
function extractSnippet(text: string, maxLen: number = 120): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    // Prefer first sentence if available
    const firstSentence = clean.split(/[.!?]/)[0]?.trim();
    const snippet = (firstSentence && firstSentence.length >= 20) ? firstSentence : clean;
    return snippet.length > maxLen ? snippet.slice(0, maxLen - 1) + '…' : snippet;
}

function computeEngagementScore(text: string, language: string): number {
    const clean = text.trim();
    if (!clean) return 0;

    const words = clean.split(/\s+/).length;
    const lengthScore = Math.min(1, words / 60);

    const examplePattern = language === 'it'
        ? /\b(ad esempio|per esempio|ad es\.|esempio)\b/i
        : /\b(for example|for instance|e\.g\.)\b/i;
    const hasExample = examplePattern.test(clean) ? 1 : 0;

    const hasNumbers = /\b\d{1,4}\b/.test(clean) ? 1 : 0;

    const specificityPattern = language === 'it'
        ? /\b(srl|spa|s\.p\.a|snc|sas|societ[aà]|azienda|cliente|fornitore)\b/i
        : /\b(ltd|inc|llc|gmbh|company|client|customer|supplier)\b/i;
    const hasSpecificity = specificityPattern.test(clean) ? 1 : 0;

    const emotionPattern = language === 'it'
        ? /\b(adoro|odio|frustrante|entusiasmante|deluso|soddisfatto|preoccupato)\b/i
        : /\b(love|hate|frustrating|exciting|disappointed|satisfied|concerned)\b/i;
    const hasEmotion = emotionPattern.test(clean) ? 1 : 0;

    const score = (
        lengthScore * 0.4 +
        hasExample * 0.2 +
        hasNumbers * 0.15 +
        hasSpecificity * 0.15 +
        hasEmotion * 0.1
    );

    return Math.max(0, Math.min(1, score));
}

function getDeepTopics(botTopics: any[], deepOrder?: string[]) {
    if (!deepOrder || deepOrder.length === 0) return botTopics;
    return deepOrder
        .map(id => botTopics.find(t => t.id === id))
        .filter(Boolean);
}

function buildDeepTopicOrder(botTopics: any[], interestingTopics: InterestingTopic[] | undefined): string[] {
    const scored = botTopics.map((t, idx) => {
        const match = (interestingTopics || []).find(it => it.topicId === t.id);
        return {
            id: t.id,
            score: match?.engagementScore ?? 0,
            idx
        };
    }).sort((a, b) => (b.score - a.score) || (a.idx - b.idx));

    return scored.map(s => s.id);
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
        name: language === 'it'
            ? 'Nome della persona (può essere solo nome, o nome e cognome)'
            : 'Name of the person (can be first name only, or full name)',
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
        // Field-specific extraction rules
        let fieldSpecificRules = '';
        if (fieldName === 'name' || fieldName === 'fullName') {
            fieldSpecificRules = `\n- For name: Accept first name only (e.g., "Marco", "Franco", "Anna"). Don't require full name.\n- If the message contains a word that looks like a name, extract it.`;
        } else if (fieldName === 'company') {
            fieldSpecificRules = `\n- For company: Look for business names, often ending in spa, srl, ltd, inc, llc, or containing words like "azienda", "società", "company".\n- Extract the company name even if mixed with other info (e.g., "Ferri spa e sono ceo" → extract "Ferri spa").\n- Accept any business/organization name the user provides.`;
        } else if (fieldName === 'role') {
            fieldSpecificRules = `\n- For role: Look for job titles like CEO, CTO, manager, developer, designer, etc.\n- Extract the role even if mixed with other info (e.g., "Ferri spa e sono ceo" → extract "ceo").`;
        }

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `Extract "${fieldName}" (${fieldDescriptions[fieldName] || fieldName}) from: "${userMessage}"\n\nRules:\n- Return null if not found\n- Do NOT infer name from email address\n- For email: look for xxx@xxx.xxx pattern\n- For phone: look for numeric sequences${fieldSpecificRules}`,
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
// HELPER: Calculate initial time budget at conversation start
// ============================================================================
function calculateInitialBudget(
    maxDurationMins: number,
    numTopics: number
): InitialBudget {
    const totalSec = maxDurationMins * 60;
    const perTopicTimeSec = totalSec / Math.max(1, numTopics);

    // Available time for SCAN (data collection is outside interview time)
    const availableForScanSec = totalSec;

    // Calculate turns per topic for SCAN (min 1, max 5)
    const totalScanTurns = Math.floor(availableForScanSec / CONFIG.SECONDS_PER_TURN);
    const rawTurnsPerTopic = Math.floor(totalScanTurns / numTopics);
    const scanTurnsPerTopic = perTopicTimeSec < 60
        ? 1
        : Math.max(1, Math.min(5, rawTurnsPerTopic));

    const estimatedScanDurationSec = numTopics * scanTurnsPerTopic * CONFIG.SECONDS_PER_TURN;

    console.log(`📊 [INITIAL_BUDGET] Total: ${totalSec}s, Topics: ${numTopics}, PerTopic: ${Math.round(perTopicTimeSec)}s, SCAN: ${scanTurnsPerTopic} turns/topic (${estimatedScanDurationSec}s)`);

    return {
        scanTurnsPerTopic,
        estimatedScanDurationSec,
        reservedForDeepSec: 0,
        reservedForDataCollectionSec: 0,
        perTopicTimeSec
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
    // Run profile extraction and completion marking in PARALLEL
    // This saves time by not waiting for one before starting the other
    const [extractedProfile] = await Promise.all([
        // Profile extraction (slow LLM call)
        (async () => {
            try {
                const { CandidateExtractor } = await import('@/lib/llm/candidate-extractor');
                return await CandidateExtractor.extractProfile(messages, apiKey, conversationId);
            } catch (e) {
                console.error("Profile extraction failed:", e);
                return null;
            }
        })(),
        // Mark interview as completed (fast DB call)
        ChatService.completeInterview(conversationId)
    ]);

    // Save extracted profile if available
    if (extractedProfile) {
        const mergedProfile = { ...extractedProfile, ...existingProfile };
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { candidateProfile: mergedProfile }
        });
        console.log("👤 Profile saved:", mergedProfile.email || 'partial');
    }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function POST(req: Request) {
    const startTime = Date.now();
    try {
        const body = await req.json();
        const { messages, conversationId, botId, effectiveDuration, introMessage } = body;
        console.log(`\n🚀 [CHAT_API] Processing message for conversation: ${conversationId}`);

        // ====================================================================
        // 1. LOAD DATA (with parallel operations for speed)
        // ====================================================================
        const loadStart = Date.now();
        const conversation = await ChatService.loadConversation(conversationId, botId);
        console.log(`⏱️ [TIMING] Data load: ${Date.now() - loadStart}ms`);
        const bot = conversation.bot;
        const language = bot.language || 'en';
        const shouldCollectData = (bot as any).collectCandidateData;
        const lastMessage = messages[messages.length - 1];

        // Run these operations in parallel - they don't depend on each other
        const parallelStart = Date.now();
        const [, , openAIKey, prefetchedModel] = await Promise.all([
            // Save user message (fire and forget style, but await for consistency)
            lastMessage?.role === 'user'
                ? ChatService.saveUserMessage(conversationId, lastMessage.content)
                : Promise.resolve(null),
            // Update progress
            ChatService.updateProgress(conversationId, Number(effectiveDuration || conversation.effectiveDuration)),
            // Get API key
            LLMService.getApiKey(bot, 'openai').then(key => key || process.env.OPENAI_API_KEY || ''),
            // Pre-fetch model (this also warms up the connection)
            LLMService.getModel(bot)
        ]);
        console.log(`⏱️ [TIMING] Parallel ops: ${Date.now() - parallelStart}ms`);

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
            closureAttempts: rawMetadata.closureAttempts ?? 0,
            // NEW: Dynamic time budget fields
            initialBudget: rawMetadata.initialBudget ?? undefined,
            interestingTopics: rawMetadata.interestingTopics ?? [],
            timeUpOfferAccepted: rawMetadata.timeUpOfferAccepted ?? null,
            timeUpSelectedTopics: rawMetadata.timeUpSelectedTopics ?? [],
            deepTopicOrder: rawMetadata.deepTopicOrder ?? [],
            topicSubGoalHistory: rawMetadata.topicSubGoalHistory ?? {},
        };

        const activeTopics = state.phase === 'DEEP' ? getDeepTopics(botTopics, state.deepTopicOrder) : botTopics;
        const currentTopic = activeTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number(effectiveDuration || conversation.effectiveDuration) || 0;
        const maxDurationMins = bot.maxDurationMins || 10;

        // ====================================================================
        // 2.5 INITIALIZE BUDGET ON FIRST MESSAGE
        // ====================================================================
        if (!state.initialBudget) {
            state.initialBudget = calculateInitialBudget(maxDurationMins, numTopics);
            console.log(`📊 [INIT] First message - calculated budget: ${state.initialBudget.scanTurnsPerTopic} turns/topic`);
        }

        // Use calculated budget instead of fixed CONFIG (fallback to CONFIG if not set)
        const scanTurnsPerTopic = state.initialBudget?.scanTurnsPerTopic ?? CONFIG.SCAN_TURNS_PER_TOPIC;

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
        const nextState = { ...state };
        let systemPrompt = "";
        let nextTopicId = currentTopic.id;
        let supervisorInsight: any = { status: 'SCANNING' };

        // GLOBAL CHECK: Did the user express a desire to stop or skip during the main interview?
        const isScanOrDeep = state.phase === 'SCAN' || state.phase === 'DEEP';
        if (isScanOrDeep && lastMessage?.role === 'user') {
            if (state.isConfirmingExit) {
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
            }
        }

        // --------------------------------------------------------------------
        // PHASE: MACHINE (only if not confirming exit)
        // --------------------------------------------------------------------
        if (!nextState.isConfirmingExit && supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT' && supervisorInsight.status !== 'CONFIRM_STOP') {

            // NOTE: Time-based early exit removed. We always complete SCAN across all topics.

            // Only process SCAN if time isn't up and we're in SCAN phase
            if (state.phase === 'SCAN') {
                // Check if we should transition to next topic (use dynamic budget)
                if (state.turnInTopic >= scanTurnsPerTopic) {
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
                        const maxDurationSec = maxDurationMins * 60;
                        const remainingSec = maxDurationSec - effectiveSec;
                        console.log("📊 [SCAN] Complete. Budget:", budget, `remainingSec: ${remainingSec}`);

                        if (remainingSec > 0 && budget.canDoDeep && !budget.isLowTime) {
                            // Plenty of time - go directly to DEEP (order by value)
                            nextState.deepTopicOrder = buildDeepTopicOrder(botTopics, state.interestingTopics);
                            const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);

                            nextState.phase = 'DEEP';
                            nextState.topicIndex = 0;
                            nextState.turnInTopic = 0;
                            nextState.deepTurnsPerTopic = budget.turnsPerTopic;
                            nextTopicId = deepTopics[0]?.id || botTopics[0].id;
                            supervisorInsight = { status: 'START_DEEP' };
                        } else {
                            // Offer DEEP after scan regardless of remaining time (can be time extension)
                            nextState.phase = 'DEEP_OFFER';
                            nextState.deepAccepted = null; // Reset to trigger DEEP_OFFER_ASK
                            supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                            console.log(`🎁 [SCAN→DEEP_OFFER] Offering DEEP with ${remainingSec}s remaining`);
                        }
                    }
                } else {
                    // Continue SCAN on current topic
                    nextState.turnInTopic = state.turnInTopic + 1;

                    // Track engagement for TIME_UP_OFFER (value-based)
                    if (lastMessage?.role === 'user') {
                        const engagementScore = computeEngagementScore(lastMessage.content, language);
                        const snippet = extractSnippet(lastMessage.content);

                        const existingTopics = [...(nextState.interestingTopics || [])];
                        const existingIndex = existingTopics.findIndex(t => t.topicId === currentTopic.id);

                        if (existingIndex >= 0) {
                            // Update with running average
                            const prev = existingTopics[existingIndex];
                            const averaged = (prev.engagementScore + engagementScore) / 2;
                            existingTopics[existingIndex] = {
                                ...prev,
                                engagementScore: averaged,
                                bestSnippet: engagementScore >= prev.engagementScore ? snippet : prev.bestSnippet
                            };
                        } else {
                            existingTopics.push({
                                topicId: currentTopic.id,
                                topicLabel: currentTopic.label,
                                engagementScore,
                                bestSnippet: snippet
                            });
                        }
                        nextState.interestingTopics = existingTopics;
                        console.log(`📊 [ENGAGEMENT] Topic "${currentTopic.label}" score: ${engagementScore.toFixed(2)}`);
                    }

                    // Ask TopicManager for next sub-goal
                    const usedSubGoals = (state.topicSubGoalHistory || {})[currentTopic.id] || [];
                    const availableSubGoals = (currentTopic.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
                    let nextSubGoal = '';

                    if (availableSubGoals.length > 0) {
                        const insight = await TopicManager.generateScanQuestion(
                            currentTopic,
                            state.turnInTopic,
                            openAIKey,
                            language,
                            availableSubGoals
                        );
                        nextSubGoal = insight.nextSubGoal;
                        nextState.topicSubGoalHistory = {
                            ...(state.topicSubGoalHistory || {}),
                            [currentTopic.id]: [...usedSubGoals, nextSubGoal]
                        };
                    } else {
                        // Sub-goals exhausted: deepen on user's last detail
                        const fallbackSnippet = lastMessage?.role === 'user' ? extractSnippet(lastMessage.content) : '';
                        nextSubGoal = fallbackSnippet ? `Approfondisci: "${fallbackSnippet}"` : `Approfondisci: "${currentTopic.label}"`;
                    }

                    supervisorInsight = { status: 'SCANNING', nextSubGoal };
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
                        nextState.deepTopicOrder = buildDeepTopicOrder(botTopics, state.interestingTopics);
                        const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);
                        nextTopicId = deepTopics[0]?.id || botTopics[0].id;
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
            // PHASE: TIME_UP_OFFER (declares time is up and offers continuation)
            // --------------------------------------------------------------------
            else if (state.phase === 'TIME_UP_OFFER') {
                console.log(`⏰ [TIME_UP_OFFER] State: timeUpOfferAccepted=${state.timeUpOfferAccepted}`);

                if (state.timeUpOfferAccepted === false) {
                    // Check user's response to the TIME_UP offer
                    console.log(`⏰ [TIME_UP_OFFER] Checking user response: "${lastMessage?.content}"`);
                    const intent = await checkUserIntent(lastMessage?.content || '', openAIKey, language, 'deep_offer');
                    console.log(`⏰ [TIME_UP_OFFER] Intent detected: ${intent}`);

                    if (intent === 'ACCEPT') {
                        nextState.timeUpOfferAccepted = true;

                        // Brief extension: go to DEEP on selected topics only
                        const selectedTopicIds = state.timeUpSelectedTopics || [];
                        const filteredSelected = selectedTopicIds.filter(id => botTopics.some(t => t.id === id));
                        if (filteredSelected.length > 0) {
                            nextState.deepTopicOrder = filteredSelected;
                            const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);
                            nextState.phase = 'DEEP';
                            nextState.topicIndex = 0;
                            nextState.turnInTopic = 0;
                            nextState.deepTurnsPerTopic = 2; // Brief extension: 2 turns per selected topic
                            nextTopicId = deepTopics[0]?.id || botTopics[0].id;
                            supervisorInsight = {
                                status: 'START_DEEP_BRIEF',
                                selectedTopics: filteredSelected,
                                isTimeExtension: true
                            };
                            console.log(`✅ [TIME_UP_OFFER] User accepted continuation on selected topics`);
                        } else {
                            // Fallback: go to DATA_COLLECTION
                            console.log(`⚠️ [TIME_UP_OFFER] No selected topics found, going to DATA_COLLECTION`);
                            if (shouldCollectData) {
                                nextState.phase = 'DATA_COLLECTION';
                                nextState.consentGiven = null;
                                supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                            } else {
                                nextState.phase = 'DATA_COLLECTION';
                                supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            }
                        }

                    } else if (intent === 'REFUSE') {
                        console.log(`❌ [TIME_UP_OFFER] User declined continuation`);
                        // Always go to DATA_COLLECTION
                        if (shouldCollectData) {
                            nextState.phase = 'DATA_COLLECTION';
                            nextState.consentGiven = null;
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        } else {
                            nextState.phase = 'DATA_COLLECTION';
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                        }

                    } else {
                        // NEUTRAL - re-ask
                        console.log(`⏰ [TIME_UP_OFFER] Neutral response, re-asking`);
                        const rankedTopics = [...(state.interestingTopics || [])]
                            .sort((a, b) => b.engagementScore - a.engagementScore);
                        let sortedTopics = rankedTopics.slice(0, 2);
                        if (sortedTopics.length < 2) {
                            const existingIds = new Set(sortedTopics.map(t => t.topicId));
                            for (const t of botTopics) {
                                if (!existingIds.has(t.id)) {
                                    sortedTopics.push({
                                        topicId: t.id,
                                        topicLabel: t.label,
                                        engagementScore: 0,
                                        bestSnippet: undefined
                                    });
                                }
                                if (sortedTopics.length >= 2) break;
                            }
                        }
                        supervisorInsight = {
                            status: 'TIME_UP_DECLARATION',
                            suggestedTopics: sortedTopics.map(t => ({
                                id: t.topicId,
                                label: t.topicLabel,
                                detail: t.bestSnippet
                            }))
                        };
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
                const deepTopics = getDeepTopics(botTopics, state.deepTopicOrder);
                const deepTotal = deepTopics.length || numTopics;
                const deepCurrent = deepTopics[state.topicIndex] || currentTopic;

                console.log(`📊 [DEEP] Topic ${state.topicIndex + 1}/${deepTotal}, Turn ${state.turnInTopic + 1}/${turnsLimit}`);

                if (state.turnInTopic >= turnsLimit) {
                    // Move to next topic
                    if (state.topicIndex + 1 < deepTotal) {
                        nextState.topicIndex = state.topicIndex + 1;
                        nextState.turnInTopic = 0;
                        nextTopicId = deepTopics[nextState.topicIndex]?.id || botTopics[nextState.topicIndex]?.id;

                        console.log(`➡️ [DEEP] Topic transition: ${deepCurrent.label} → ${deepTopics[nextState.topicIndex]?.label || botTopics[nextState.topicIndex]?.label}`);
                        supervisorInsight = { status: 'TRANSITION', nextTopic: deepTopics[nextState.topicIndex]?.label || botTopics[nextState.topicIndex]?.label };
                    } else {
                        // End of DEEP - ALL topics done, move to DATA_COLLECTION
                        console.log(`✅ [DEEP] All ${deepTotal} topics completed. Moving to DATA_COLLECTION.`);
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
                    const usedSubGoals = (state.topicSubGoalHistory || {})[deepCurrent.id] || [];
                    const availableSubGoals = (deepCurrent.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));

                    if (availableSubGoals.length === 0) {
                        const fallbackSnippet = lastMessage?.role === 'user' ? extractSnippet(lastMessage.content) : '';
                        const focusPoint = fallbackSnippet ? `Approfondisci: "${fallbackSnippet}"` : `Approfondisci: "${deepCurrent.label}"`;
                        supervisorInsight = { status: 'DEEPENING', focusPoint };
                    } else {
                        const insight = await TopicManager.generateDeepQuestion(
                            deepCurrent,
                            state.turnInTopic,
                            messages.slice(-10),
                            openAIKey,
                            language,
                            availableSubGoals
                        );
                        nextState.topicSubGoalHistory = {
                            ...(state.topicSubGoalHistory || {}),
                            [deepCurrent.id]: [...usedSubGoals, insight.focusPoint]
                        };
                        supervisorInsight = { status: 'DEEPENING', focusPoint: insight.focusPoint };
                    }

                    console.log(`🔍 [DEEP] Continuing topic "${deepCurrent.label}", turn ${nextState.turnInTopic}/${turnsLimit}`);
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
                        nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
                        nextState.consentGiven = false;
                        nextState.lastAskedField = null;
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

                        // Determine which name field is configured (name or fullName)
                        const configuredNameField = candidateFields.find((f: any) => {
                            const fieldName = typeof f === 'string' ? f : (f.id || f.field);
                            return fieldName === 'name' || fieldName === 'fullName';
                        });
                        const nameFieldKey = configuredNameField
                            ? (typeof configuredNameField === 'string' ? configuredNameField : (configuredNameField.id || configuredNameField.field))
                            : 'fullName';

                        // Try to find the name in previous messages if we don't have it
                        if (!currentProfile[nameFieldKey]) {
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
                                            currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                            console.log(`✅ [DATA_COLLECTION] Recovered name from history for "${nameFieldKey}": "${cleanedName}"`);
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

                        // SPECIAL HANDLING: If we asked for a specific field and user replied with a short answer, use it directly
                        const userReply = lastMessage.content.trim();
                        const wordCount = userReply.split(/\s+/).length;
                        const lastAsked = state.lastAskedField;

                        // Direct capture for NAME (1-3 words, no special chars)
                        const isNameField = lastAsked === 'fullName' || lastAsked === 'name';
                        const nameFieldKey = lastAsked === 'name' ? 'name' : 'fullName';
                        if (isNameField && wordCount <= 3 && !currentProfile[nameFieldKey]) {
                            const cleanedName = userReply.replace(/[.!?,;:]/g, '').trim();
                            if (cleanedName.length > 0 && cleanedName.length < 50 && !/[@\d]/.test(cleanedName)) {
                                currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                console.log(`✅ [DATA_COLLECTION] Direct name capture for "${nameFieldKey}": "${cleanedName}"`);
                            }
                        }

                        // Direct capture for COMPANY (1-5 words, reasonable length)
                        if (lastAsked === 'company' && wordCount <= 5 && !currentProfile.company) {
                            const cleanedCompany = userReply.replace(/[.!?,;:]/g, '').trim();
                            // Accept if it looks like a company name (not a refusal or question)
                            if (cleanedCompany.length > 1 && cleanedCompany.length < 100 &&
                                !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedCompany)) {
                                currentProfile = { ...currentProfile, company: cleanedCompany };
                                console.log(`✅ [DATA_COLLECTION] Direct company capture: "${cleanedCompany}"`);
                            }
                        }

                        // Direct capture for ROLE (1-4 words)
                        if (lastAsked === 'role' && wordCount <= 4 && !currentProfile.role) {
                            const cleanedRole = userReply.replace(/[.!?,;:]/g, '').trim();
                            if (cleanedRole.length > 1 && cleanedRole.length < 50 &&
                                !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedRole)) {
                                currentProfile = { ...currentProfile, role: cleanedRole };
                                console.log(`✅ [DATA_COLLECTION] Direct role capture: "${cleanedRole}"`);
                            }
                        }

                        const extractions = await Promise.all(
                            fieldsToExtract.map(async (fieldName) => {
                                // Skip if field already captured by direct capture above
                                if ((fieldName === 'fullName' && currentProfile.fullName) ||
                                    (fieldName === 'name' && currentProfile.name) ||
                                    (fieldName === 'company' && currentProfile.company) ||
                                    (fieldName === 'role' && currentProfile.role)) {
                                    console.log(`⏭️ [DATA_COLLECTION] Skipping extraction for "${fieldName}" - already captured directly`);
                                    return { fieldName, extraction: { value: null, confidence: 'none' } };
                                }

                                const extraction = await extractFieldFromMessage(
                                    fieldName,
                                    lastMessage.content,
                                    openAIKey,
                                    language
                                );
                                console.log(`🔍 [DATA_COLLECTION] Extraction result for "${fieldName}": value="${extraction.value}", confidence="${extraction.confidence}"`);
                                return { fieldName, extraction };
                            })
                        );

                        for (const { fieldName, extraction } of extractions) {
                            if (extraction.value && extraction.confidence !== 'none') {
                                currentProfile = { ...currentProfile, [fieldName]: extraction.value };
                                console.log(`✅ [DATA_COLLECTION] Extracted "${fieldName}": "${extraction.value}"`);
                            } else {
                                console.log(`⚠️ [DATA_COLLECTION] Could not extract "${fieldName}" (value=${extraction.value}, confidence=${extraction.confidence})`);
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
                        supervisorInsight = { status: 'FINAL_GOODBYE' };
                        nextState.lastAskedField = null;
                    } else {
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
        }

        // ====================================================================
        // 4. BUILD PROMPT
        // ====================================================================
        const methodology = LLMService.getMethodology();
        const model = prefetchedModel; // Use pre-fetched model from parallel init
        const nextActiveTopics = nextState.phase === 'DEEP'
            ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
            : botTopics;
        const targetTopic = nextActiveTopics[nextState.topicIndex] || currentTopic;


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
        const shouldShowStatusBanner = (nextState.phase === 'SCAN' || nextState.phase === 'DEEP') &&
            ['SCANNING', 'DEEPENING', 'TRANSITION', 'START_DEEP', 'START_DEEP_BRIEF'].includes(supervisorInsight?.status);

        if (shouldShowStatusBanner) {
            const currentTopicLabel = botTopics[nextState.topicIndex]?.label || 'current topic';
            const turnsInfo = nextState.phase === 'SCAN'
                ? `Turn ${nextState.turnInTopic}/${scanTurnsPerTopic}`
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

        const shouldEndWithQuestion = !['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'].includes(supervisorInsight?.status);
        if (shouldEndWithQuestion) {
            systemPrompt += `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;
        }

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

        // Track token usage - NUOVO: usa userId (owner del progetto) per il sistema crediti
        const organizationId = (bot as any).project?.organization?.id;
        const projectOwnerId = (bot as any).project?.ownerId;
        if (projectOwnerId && result.usage) {
            TokenTrackingService.logTokenUsage({
                userId: projectOwnerId,
                organizationId,
                projectId: (bot as any).project?.id,
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                category: 'INTERVIEW',
                model: model.modelId || 'gpt-4o',
                operation: 'interview-response',
                resourceType: 'interview',
                resourceId: bot.id
            }).catch(err => console.error('Token tracking failed:', err));
        }

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

            // Find first missing field (must match logic in data collection phase)
            // Consider: already collected, explicitly skipped, or asked too many times
            const MAX_FIELD_ATTEMPTS_SUPERVISOR = 3;
            let missingField: string | null = null;
            for (const field of candidateFields) {
                const fieldName = typeof field === 'string' ? field : (field.id || field.field);
                const attempts = nextState.fieldAttemptCounts?.[fieldName] || 0;

                // Skip if already collected (and not skipped marker)
                if (currentProfile[fieldName] && currentProfile[fieldName] !== '__SKIPPED__') continue;
                // Skip if explicitly skipped
                if (currentProfile[fieldName] === '__SKIPPED__') continue;
                // Skip if asked too many times
                if (attempts >= MAX_FIELD_ATTEMPTS_SUPERVISOR) continue;

                missingField = fieldName;
                break;
            }

            // Helper to get field label
            const getFieldLabel = (field: string, lang: string) => {
                const labels: Record<string, { it: string; en: string }> = {
                    name: { it: 'il tuo nome e cognome', en: 'your full name' },
                    fullName: { it: 'il tuo nome e cognome', en: 'your full name' },
                    email: { it: 'il tuo indirizzo email', en: 'your email address' },
                    phone: { it: 'il tuo numero di telefono', en: 'your phone number' },
                    company: { it: 'il nome della tua azienda', en: 'your company name' },
                    linkedin: { it: 'il tuo profilo LinkedIn', en: 'your LinkedIn profile' },
                    role: { it: 'il tuo ruolo attuale', en: 'your current role' },
                    location: { it: 'la tua città', en: 'your city' },
                    budget: { it: 'il tuo budget', en: 'your budget' },
                    availability: { it: 'la tua disponibilità', en: 'your availability' },
                };
                return labels[field]?.[lang as 'it' | 'en'] || field;
            };

            // CONSENT PHASE: bot should ask for permission
            if (nextState.consentGiven === false) {
                console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. OVERRIDING with consent question.`);

                // Varied consent questions
                const consentMessages = language === 'it' ? [
                    `Ti ringrazio molto per questa conversazione, è stata davvero interessante! L'intervista è conclusa. Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?`,
                    `Grazie per il tempo dedicato, mi hai dato spunti preziosi! L'intervista è finita. Posso chiederti i tuoi contatti per eventuali follow-up?`,
                    `È stato un piacere parlare con te! Abbiamo concluso l'intervista. Ti andrebbe di lasciarmi i tuoi dati per restare in contatto?`,
                ] : [
                    `Thank you so much for this conversation, it was really interesting! The interview is complete. Before we go, may I ask for your contact details to stay in touch?`,
                    `Thanks for your time, you've given me valuable insights! The interview is done. May I ask for your contact info for any follow-ups?`,
                    `It was a pleasure talking with you! We've finished the interview. Would you like to leave your details to stay in touch?`,
                ];

                responseText = consentMessages[Math.floor(Math.random() * consentMessages.length)];
            }
            // FIELD COLLECTION PHASE: bot should ask for specific field
            else if (nextState.consentGiven === true && missingField) {
                // Only override if the response doesn't already ask for this field
                const fieldMentioned = responseText.toLowerCase().includes(missingField.toLowerCase()) ||
                    ((missingField === 'name' || missingField === 'fullName') && /\b(nome|cognome|name)\b/i.test(responseText)) ||
                    (missingField === 'email' && /\b(email|mail)\b/i.test(responseText)) ||
                    (missingField === 'phone' && /\b(telefono|phone|numero)\b/i.test(responseText)) ||
                    (missingField === 'company' && /\b(azienda|company|organizzazione)\b/i.test(responseText)) ||
                    (missingField === 'role' && /\b(ruolo|role|posizione)\b/i.test(responseText));

                if (!fieldMentioned || hasNoQuestion) {
                    console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". OVERRIDING with field question.`);
                    const fieldLabel = getFieldLabel(missingField, language);

                    // Varied field questions
                    const fieldQuestions = language === 'it' ? [
                        `Perfetto! Qual è ${fieldLabel}?`,
                        `Ottimo! Mi dici ${fieldLabel}?`,
                        `Benissimo! Puoi darmi ${fieldLabel}?`,
                    ] : [
                        `Perfect! What is ${fieldLabel}?`,
                        `Great! Can you tell me ${fieldLabel}?`,
                        `Excellent! May I have ${fieldLabel}?`,
                    ];

                    responseText = fieldQuestions[Math.floor(Math.random() * fieldQuestions.length)];
                }
            }
            // ALL FIELDS COLLECTED but bot didn't complete
            else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);

                // Varied completion messages
                const completionMessages = language === 'it' ? [
                    `Grazie mille per tutte le informazioni! Ti contatteremo presto.`,
                    `Perfetto, ho tutto! Grazie per la disponibilità, a presto!`,
                    `Ottimo, abbiamo finito! Grazie per il tuo tempo, ci sentiamo presto.`,
                ] : [
                    `Thank you so much for all the information! We will contact you soon.`,
                    `Perfect, I have everything! Thanks for your availability, talk soon!`,
                    `Great, we're done! Thanks for your time, we'll be in touch soon.`,
                ];

                responseText = completionMessages[Math.floor(Math.random() * completionMessages.length)] + " INTERVIEW_COMPLETED";
            }
        }
        // Other phases - Handle bot trying to close during SCAN/DEEP
        // NEW STRATEGY: Track closure attempts and respect user's intent after 2 attempts
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion || isPrematureContactRequest)) {
            nextState.closureAttempts = (state.closureAttempts || 0) + 1;
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Closure attempt #${nextState.closureAttempts}`);
            console.log(`   Original response: "${responseText.substring(0, 100)}..."`);

            const MAX_CLOSURE_ATTEMPTS = 2;

            if (nextState.closureAttempts >= MAX_CLOSURE_ATTEMPTS) {
                // Respect user's implicit desire to end - transition to DATA_COLLECTION
                console.log(`   ✓ Max closure attempts reached. Respecting user intent, transitioning to DATA_COLLECTION.`);

                if (shouldCollectData) {
                    nextState.phase = 'DATA_COLLECTION';
                    nextState.consentGiven = null;

                    const transitionMessages = language === 'it' ? [
                        `Grazie per le tue risposte! Prima di concludere, posso chiederti alcuni dati di contatto?`,
                        `Ti ringrazio per questa conversazione! Posso chiederti i tuoi contatti prima di salutarci?`,
                    ] : [
                        `Thank you for your answers! Before we wrap up, may I ask for your contact details?`,
                        `Thanks for this conversation! May I ask for your contact info before we say goodbye?`,
                    ];
                    responseText = transitionMessages[Math.floor(Math.random() * transitionMessages.length)];
                } else {
                    nextState.phase = 'DATA_COLLECTION';
                    const goodbyeMessages = language === 'it' ? [
                        `Grazie mille per il tuo tempo e le tue risposte! È stato un piacere.`,
                        `Ti ringrazio per questa conversazione! Buona giornata.`,
                    ] : [
                        `Thank you so much for your time and answers! It was a pleasure.`,
                        `Thanks for this conversation! Have a great day.`,
                    ];
                    responseText = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)] + " INTERVIEW_COMPLETED";
                }
            } else {
                // First closure attempt - try to move to next topic instead of appending generic questions
                const targetTopic = botTopics[nextState.topicIndex] || currentTopic;
                const topicLabel = targetTopic?.label || 'questo argomento';

                // Check if we can move to next topic
                if (nextState.topicIndex + 1 < numTopics) {
                    nextState.topicIndex = nextState.topicIndex + 1;
                    nextState.turnInTopic = 0;
                    const nextTopic = botTopics[nextState.topicIndex];
                    nextTopicId = nextTopic.id;

                    const transitionQuestions = language === 'it' ? [
                        `Capisco. Passando a ${nextTopic.label}, qual è la tua esperienza a riguardo?`,
                        `Va bene. Parliamo di ${nextTopic.label}: cosa ne pensi?`,
                        `Perfetto. Su ${nextTopic.label}, come ti sei trovato?`,
                    ] : [
                        `I understand. Moving to ${nextTopic.label}, what's your experience with it?`,
                        `Alright. Let's talk about ${nextTopic.label}: what do you think?`,
                        `Perfect. On ${nextTopic.label}, how has it been for you?`,
                    ];
                    responseText = transitionQuestions[Math.floor(Math.random() * transitionQuestions.length)];
                    console.log(`   ✓ Moving to next topic: ${nextTopic.label}`);
                } else {
                    // No more topics - generate a closing question for current topic
                    const closingQuestions = language === 'it' ? [
                        `Prima di concludere su ${topicLabel}, c'è qualcosa che vorresti aggiungere?`,
                        `Un'ultima cosa su ${topicLabel}: quali sono le tue aspettative per il futuro?`,
                        `Per chiudere ${topicLabel}: cosa cambieresti se potessi?`,
                    ] : [
                        `Before we wrap up ${topicLabel}, is there anything you'd like to add?`,
                        `One last thing about ${topicLabel}: what are your expectations for the future?`,
                        `To close on ${topicLabel}: what would you change if you could?`,
                    ];
                    responseText = closingQuestions[Math.floor(Math.random() * closingQuestions.length)];
                    console.log(`   ✓ Asking closing question for current topic`);
                }
            }
        }
        // Reset closure attempts when bot generates a valid question (not trying to close)
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && !isGoodbyeResponse && !hasNoQuestion) {
            nextState.closureAttempts = 0;
        }
        else if (nextState.phase === 'DEEP_OFFER' && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. OVERRIDING with offer question.`);

            // Varied deep offer messages
            const deepOfferMessages = language === 'it' ? [
                `Grazie per queste risposte! Il tempo previsto sta per terminare, ma se hai ancora qualche minuto, avrei alcune domande di approfondimento. Ti va di continuare?`,
                `Molto interessante quello che mi hai raccontato! Abbiamo quasi finito, ma se vuoi possiamo approfondire alcuni punti. Che ne dici?`,
                `Grazie per il tuo tempo! Prima di concludere, se hai qualche minuto in più, potremmo esplorare alcuni temi più nel dettaglio. Ti andrebbe?`,
            ] : [
                `Thank you for these answers! Our scheduled time is almost up, but if you have a few more minutes, I'd love to ask some deeper follow-up questions. Would you like to continue?`,
                `Very interesting what you've shared! We're almost done, but if you'd like, we can dive deeper into some points. What do you think?`,
                `Thanks for your time! Before we wrap up, if you have a few extra minutes, we could explore some topics in more detail. Would you be interested?`,
            ];

            responseText = deepOfferMessages[Math.floor(Math.random() * deepOfferMessages.length)];
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
            // A field is considered "done" if: collected, skipped, or asked too many times
            const MAX_FIELD_ATTEMPTS_COMPLETION = 3;
            const allFieldsCollected = candidateFields.every((field: any) => {
                const fieldName = typeof field === 'string' ? field : (field.id || field.field);
                const attempts = nextState.fieldAttemptCounts?.[fieldName] || 0;
                // Field is done if: has value (not skipped), is skipped, or exceeded attempts
                return (currentProfileForCompletion[fieldName] && currentProfileForCompletion[fieldName] !== '__SKIPPED__') ||
                       currentProfileForCompletion[fieldName] === '__SKIPPED__' ||
                       attempts >= MAX_FIELD_ATTEMPTS_COMPLETION;
            });

            if (shouldCollectData && !allFieldsCollected && nextState.consentGiven !== false) {
                // Not done yet! Override with data collection consent question
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED but fields are missing. OVERRIDING with consent question.`);

                const consentMessages = language === 'it' ? [
                    `Ti ringrazio molto per questa conversazione! Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?`,
                    `Grazie per il tempo dedicato! L'intervista è finita, ma mi piacerebbe restare in contatto. Posso chiederti i tuoi dati?`,
                    `È stato un piacere! Abbiamo concluso, ma vorrei poterti ricontattare. Ti andrebbe di lasciarmi i tuoi contatti?`,
                ] : [
                    `Thank you so much for this conversation! Before we go, may I ask for your contact details to stay in touch?`,
                    `Thanks for your time! The interview is done, but I'd love to stay in touch. May I ask for your details?`,
                    `It was a pleasure! We're finished, but I'd like to follow up. Would you mind sharing your contact info?`,
                ];

                responseText = consentMessages[Math.floor(Math.random() * consentMessages.length)];
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
        // 6. SAVE & UPDATE STATE (parallelized for speed)
        // ====================================================================
        // Run save operations in parallel - they're independent
        await Promise.all([
            // Save assistant message
            ChatService.saveAssistantMessage(conversationId, responseText),
            // Update conversation state (metadata + topic in one query)
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: nextState as any,
                    currentTopicId: nextTopicId
                }
            })
        ]);

        const totalTime = Date.now() - startTime;
        console.log(`✅ [CHAT_API] Finished. Response sent. Next Phase: ${nextState.phase}`);
        console.log(`⏱️ [TIMING] TOTAL REQUEST: ${totalTime}ms`);

        // Memory update (fire and forget - don't block response)
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

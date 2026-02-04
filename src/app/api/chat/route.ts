
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
import { getOrCreateInterviewPlan } from '@/lib/interview/plan-service';
import type { InterviewPlan } from '@/lib/interview/plan-types';

export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
};

// ============================================================================
// TYPES
// ============================================================================
type Phase = 'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'DATA_COLLECTION';

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
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    fieldAttemptCounts: Record<string, number>;  // Track attempts per field to prevent loops
    closureAttempts: number;        // Track consecutive closure attempts to prevent infinite loops
    dataCollectionRefused?: boolean;
    interestingTopics?: InterestingTopic[];
    deepTopicOrder?: string[];             // Ordered topic IDs for DEEP based on value
    deepTurnsByTopic?: Record<string, number>;
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

function getScanPlanTurns(plan: InterviewPlan, topicId: string): number {
    const topic = plan.scan.topics.find(t => t.topicId === topicId);
    return Math.max(1, topic?.maxTurns ?? 1);
}

function getDeepPlanTurns(plan: InterviewPlan, topicId: string): number {
    const topic = plan.deep.topics.find(t => t.topicId === topicId);
    const base = topic?.maxTurns ?? plan.deep.maxTurnsPerTopic;
    return Math.max(1, base);
}

function getRemainingSubGoals(topic: any, history: Record<string, string[]> | undefined) {
    const used = (history || {})[topic.id] || [];
    return (topic.subGoals || []).filter((sg: string) => !used.includes(sg));
}

function buildDeepPlan(
    botTopics: any[],
    plan: InterviewPlan,
    history: Record<string, string[]> | undefined,
    interestingTopics: InterestingTopic[] | undefined
) {
    const topicsWithRemaining = botTopics.filter(t => getRemainingSubGoals(t, history).length > 0);
    if (topicsWithRemaining.length > 0) {
        const ordered = buildDeepTopicOrder(botTopics, interestingTopics).filter(id =>
            topicsWithRemaining.some(t => t.id === id)
        );
        const deepTurnsByTopic: Record<string, number> = {};
        for (const topicId of ordered) {
            const topic = botTopics.find(t => t.id === topicId);
            if (!topic) continue;
            const remaining = getRemainingSubGoals(topic, history).length;
            const maxTurns = Math.min(getDeepPlanTurns(plan, topicId), remaining);
            deepTurnsByTopic[topicId] = Math.max(1, maxTurns);
        }
        return { deepTopicOrder: ordered, deepTurnsByTopic };
    }

    const fallbackCount = Math.max(1, plan.deep.fallbackTurns || 2);
    const ordered = buildDeepTopicOrder(botTopics, interestingTopics).slice(0, fallbackCount);
    const deepTurnsByTopic: Record<string, number> = {};
    ordered.forEach(id => {
        deepTurnsByTopic[id] = 1;
    });
    return { deepTopicOrder: ordered, deepTurnsByTopic };
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
        const interviewPlan = await getOrCreateInterviewPlan(bot);

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
            fieldAttemptCounts: rawMetadata.fieldAttemptCounts ?? {},
            closureAttempts: rawMetadata.closureAttempts ?? 0,
            interestingTopics: rawMetadata.interestingTopics ?? [],
            deepTopicOrder: rawMetadata.deepTopicOrder ?? [],
            deepTurnsByTopic: rawMetadata.deepTurnsByTopic ?? {},
            topicSubGoalHistory: rawMetadata.topicSubGoalHistory ?? {},
        };

        const activeTopics = state.phase === 'DEEP' ? getDeepTopics(botTopics, state.deepTopicOrder) : botTopics;
        const currentTopic = activeTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number(effectiveDuration || conversation.effectiveDuration) || 0;
        const maxDurationMins = bot.maxDurationMins || 10;

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

        // --------------------------------------------------------------------
        // PHASE: MACHINE
        // --------------------------------------------------------------------
        if (supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT') {

            // NOTE: Time-based early exit removed. We always complete SCAN across all topics.

            // Only process SCAN if time isn't up and we're in SCAN phase
            if (state.phase === 'SCAN') {
                const scanMaxTurns = getScanPlanTurns(interviewPlan, currentTopic.id);
                // Check if we should transition to next topic (use dynamic budget)
                if (state.turnInTopic >= scanMaxTurns) {
                    // Move to next topic
                    if (state.topicIndex + 1 < numTopics) {
                        nextState.topicIndex = state.topicIndex + 1;
                        nextState.turnInTopic = 0;
                        nextTopicId = botTopics[nextState.topicIndex].id;

                        console.log(`➡️ [SCAN] Topic transition: ${currentTopic.label} → ${botTopics[nextState.topicIndex].label}`);
                        const nextTopic = botTopics[nextState.topicIndex];
                        const nextAvailableSubGoals = getRemainingSubGoals(nextTopic, state.topicSubGoalHistory);
                        supervisorInsight = {
                            status: 'TRANSITION',
                            nextTopic: nextTopic.label,
                            nextSubGoal: nextAvailableSubGoals[0] || nextTopic.label
                        };
                    } else {
                        // End of SCAN - check time for DEEP
                        const maxDurationSec = maxDurationMins * 60;
                        const remainingSec = maxDurationSec - effectiveSec;
                        console.log("📊 [SCAN] Complete.", `remainingSec: ${remainingSec}`);

                        if (remainingSec > 0) {
                            const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics);
                            nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                            nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                            const deepTopics = getDeepTopics(botTopics, nextState.deepTopicOrder);

                            nextState.phase = 'DEEP';
                            nextState.topicIndex = 0;
                            nextState.turnInTopic = 0;
                            nextTopicId = deepTopics[0]?.id || botTopics[0].id;
                            supervisorInsight = { status: 'START_DEEP' };
                        } else {
                            // Offer DEEP after scan only if time is over (user can accept extra time)
                            nextState.phase = 'DEEP_OFFER';
                            nextState.deepAccepted = null; // Reset to trigger DEEP_OFFER_ASK
                            supervisorInsight = { status: 'DEEP_OFFER_ASK' };
                            console.log(`🎁 [SCAN→DEEP_OFFER] Offering DEEP with ${remainingSec}s remaining`);
                        }
                    }
                } else {
                    // Continue SCAN on current topic
                    nextState.turnInTopic = state.turnInTopic + 1;

                    // Track engagement for value-based DEEP ordering
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
                        const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics);
                        nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                        nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
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
            // PHASE: DEEP
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEP') {
                if (!state.deepTurnsByTopic || Object.keys(state.deepTurnsByTopic).length === 0) {
                    const deepPlan = buildDeepPlan(botTopics, interviewPlan, state.topicSubGoalHistory, state.interestingTopics);
                    nextState.deepTopicOrder = deepPlan.deepTopicOrder;
                    nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
                }
                const deepOrder = (nextState.deepTopicOrder && nextState.deepTopicOrder.length > 0)
                    ? nextState.deepTopicOrder
                    : state.deepTopicOrder;
                const deepTurnsMap = (nextState.deepTurnsByTopic && Object.keys(nextState.deepTurnsByTopic).length > 0)
                    ? nextState.deepTurnsByTopic
                    : state.deepTurnsByTopic;
                const deepTopics = getDeepTopics(botTopics, deepOrder);
                const deepCurrent = deepTopics[state.topicIndex] || currentTopic;
                const turnsLimit = Math.max(1, (deepTurnsMap || {})[deepCurrent.id] || getDeepPlanTurns(interviewPlan, deepCurrent.id));
                const deepTotal = deepTopics.length || numTopics;

                console.log(`📊 [DEEP] Topic ${state.topicIndex + 1}/${deepTotal}, Turn ${state.turnInTopic + 1}/${turnsLimit}`);

                if (state.turnInTopic >= turnsLimit) {
                    // Move to next topic
                    if (state.topicIndex + 1 < deepTotal) {
                        nextState.topicIndex = state.topicIndex + 1;
                        nextState.turnInTopic = 0;
                        nextTopicId = deepTopics[nextState.topicIndex]?.id || botTopics[nextState.topicIndex]?.id;

                        console.log(`➡️ [DEEP] Topic transition: ${deepCurrent.label} → ${deepTopics[nextState.topicIndex]?.label || botTopics[nextState.topicIndex]?.label}`);
                        const nextDeepTopic = deepTopics[nextState.topicIndex] || botTopics[nextState.topicIndex];
                        const nextAvailableSubGoals = nextDeepTopic ? getRemainingSubGoals(nextDeepTopic, nextState.topicSubGoalHistory || state.topicSubGoalHistory) : [];
                        supervisorInsight = {
                            status: 'TRANSITION',
                            nextTopic: nextDeepTopic?.label || botTopics[nextState.topicIndex]?.label,
                            nextSubGoal: nextAvailableSubGoals[0] || nextDeepTopic?.label
                        };
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

                if (state.dataCollectionRefused) {
                    await completeInterview(conversationId, messages, openAIKey, conversation.candidateProfile || {});
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    nextState.dataCollectionRefused = true;
                }

                const shouldContinueDataCollection = supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA';
                if (shouldContinueDataCollection) {
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
                        nextState.dataCollectionRefused = true;
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
                        let haltCollection = false;

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
                        nextState.dataCollectionRefused = true;
                        haltCollection = true;
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
                        haltCollection = true;
                    }

                    if (!haltCollection) {
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
                } else {
                    nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
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
            const bannerTopics = nextState.phase === 'DEEP'
                ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
                : botTopics;
            const bannerTopic = bannerTopics[nextState.topicIndex] || currentTopic;
            const currentTopicLabel = bannerTopic?.label || 'current topic';
            const targetTopicId = bannerTopic?.id || currentTopic.id;
            const scanMaxTurns = getScanPlanTurns(interviewPlan, targetTopicId);
            const deepTurns = Math.max(1, (nextState.deepTurnsByTopic || {})[targetTopicId] || getDeepPlanTurns(interviewPlan, targetTopicId));
            const turnsInfo = nextState.phase === 'SCAN'
                ? `Turn ${nextState.turnInTopic}/${scanMaxTurns}`
                : `Turn ${nextState.turnInTopic}/${deepTurns}`;

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

        // ====================================================================
        // 5.4 TRANSITION / DEEP_OFFER ENFORCEMENT (AI-generated, no hardcoded phrasing)
        // ====================================================================
        const transitionTopicLabel = supervisorInsight?.nextTopic;
        const responseLower = (responseText || '').toLowerCase();
        let didRegenerate = false;

        if (supervisorInsight?.status === 'TRANSITION' && transitionTopicLabel) {
            const mustMention = transitionTopicLabel.toLowerCase();
            if (!responseLower.includes(mustMention)) {
                console.log(`⚠️ [SUPERVISOR] Transition response missing next topic label "${transitionTopicLabel}". Regenerating.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Your response MUST explicitly mention the next topic label: "${transitionTopicLabel}". Ask exactly one question about it.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            const openai = createOpenAI({ apiKey: openAIKey });
            const offerSchema = z.object({ isOffer: z.boolean() });
            try {
                const offerCheck = await generateObject({
                    model: openai('gpt-4o-mini'),
                    schema: offerSchema,
                    prompt: `Determine if the assistant is explicitly offering the user to continue with extra/deeper questions and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isOffer: true/false }.`,
                    temperature: 0
                });
                if (!offerCheck.object.isOffer) {
                    console.log(`⚠️ [SUPERVISOR] Deep offer response not an offer. Regenerating.`);
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: You must ONLY offer the choice to continue with extra deeper questions and wait for yes/no. Do NOT ask any topic question.`;
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    didRegenerate = true;
                }
            } catch (e) {
                console.error('Deep offer validation failed:', e);
            }
        }

        const isTopicPhase = nextState.phase === 'SCAN' || nextState.phase === 'DEEP';
        if (isTopicPhase && targetTopic && !didRegenerate) {
            const responseLower = (responseText || '').toLowerCase();
            const topicLabel = (targetTopic.label || '').toLowerCase();
            const subGoals = (targetTopic.subGoals || []).map((sg: string) => sg.toLowerCase());
            const mentionsTopic = topicLabel && responseLower.includes(topicLabel);
            const mentionsSubGoal = subGoals.some((sg: string) => sg.length > 3 && responseLower.includes(sg));

            if (!mentionsTopic && !mentionsSubGoal) {
                console.log(`⚠️ [SUPERVISOR] Response drifted from topic "${targetTopic.label}". Regenerating.`);
                const focusList = subGoals.slice(0, 5).join(' | ');
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Your question must explicitly reference the topic "${targetTopic.label}". If possible, tie it to one of these sub-goals: ${focusList}. Ask exactly one question.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

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

        const PROMO_PATTERNS = /\b(www\.|https?:\/\/|@|email|scrivi a|contatta|offerta|promo|premio|reward|coupon|sconto)\b/i;
        const isPromoContent = PROMO_PATTERNS.test(responseText) && (nextState.phase === 'SCAN' || nextState.phase === 'DEEP' || nextState.phase === 'DEEP_OFFER');
        if (isPromoContent) {
            console.log(`⚠️ [SUPERVISOR] Promo/CTA detected during active phase. Regenerating.`);
            const enforceTopic = targetTopic?.label || currentTopic.label;
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Remove any promo/CTA. Ask exactly ONE question about "${enforceTopic}".`;
            const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

        // If in DATA_COLLECTION phase, ALWAYS ensure we ask for the specific field
        if (nextState.phase === 'DATA_COLLECTION') {
            if (nextState.dataCollectionRefused || supervisorInsight?.status === 'COMPLETE_WITHOUT_DATA') {
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                }
            } else {
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
            if (supervisorInsight?.status === 'DATA_COLLECTION_CONSENT' && nextState.consentGiven === false && !nextState.dataCollectionRefused) {
                console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. OVERRIDING with consent question.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask for consent to collect contact details. One question only. Do not ask any topic question.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
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
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask ONLY for ${fieldLabel}. One question only.`;
                    const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                }
            }
            // ALL FIELDS COLLECTED but bot didn't complete
            else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append \"INTERVIEW_COMPLETED\". Do not ask any questions.`;
                const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                }
            }
            }
        }
        // Other phases - Handle bot trying to close during SCAN/DEEP
        // NEW STRATEGY: Track closure attempts and respect user's intent after 2 attempts
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion || isPrematureContactRequest)) {
            nextState.closureAttempts = (state.closureAttempts || 0) + 1;
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Forcing topic question. Attempt #${nextState.closureAttempts}`);

            const enforceTopic = targetTopic?.label || currentTopic.label;
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT end the interview. Ask exactly ONE question about the topic "${enforceTopic}". Do not mention contacts, rewards, or closing.`;
            const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }
        // Reset closure attempts when bot generates a valid question (not trying to close)
        else if ((nextState.phase === 'SCAN' || nextState.phase === 'DEEP') && !isGoodbyeResponse && !hasNoQuestion) {
            nextState.closureAttempts = 0;
        }
        else if (nextState.phase === 'DEEP_OFFER' && (isGoodbyeResponse || isGoodbyeWithQuestion || hasNoQuestion)) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. OVERRIDING with offer question.`);
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Offer the choice to continue with deeper questions. One question only. Do not ask any topic question.`;
            const retry = await generateObject({ model, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
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

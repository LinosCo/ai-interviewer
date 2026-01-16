
import { Message, TopicBlock } from '@prisma/client';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export class TopicManager {

    /**
     * Evaluates if the current topic has been sufficiently covered based on the conversation history.
     * Uses a lightweight model (gpt-4o-mini) for speed and cost.
     * 
     * @param phase 'SCAN' for broad, quick coverage; 'DEEP' for meticulous, contextual probing.
     */
    static async evaluateTopicProgress(
        messages: Message[],
        currentTopic: TopicBlock,
        apiKey: string,
        phase: 'SCAN' | 'DEEP' = 'SCAN',
        isRecruiting: boolean = false,
        language: string = 'en',
        timeBudget?: number, // Optional time budget per topic in minutes
        deepTurnsByTopic?: Record<string, number>, // Track turns per topic in DEEP phase
        scanTurnsByTopic?: Record<string, number> // NEW: Track turns per topic in SCAN phase
    ): Promise<{ status: 'SCANNING' | 'DEEPENING' | 'TRANSITION' | 'COMPLETION'; nextSubGoal?: string | null; focusPoint?: string | null; reason: string }> {

        // SCAN PHASE: Enforce max turns per topic for deterministic behavior
        const MAX_SCAN_TURNS_PER_TOPIC = 3;
        if (phase === 'SCAN' && scanTurnsByTopic) {
            const currentTopicTurns = scanTurnsByTopic[currentTopic.id] || 0;
            if (currentTopicTurns >= MAX_SCAN_TURNS_PER_TOPIC) {
                console.log(`🚫 [TopicManager] Max SCAN turns (${MAX_SCAN_TURNS_PER_TOPIC}) reached for topic "${currentTopic.label}". Forcing TRANSITION.`);
                return {
                    status: 'TRANSITION',
                    reason: `Maximum scan limit (${MAX_SCAN_TURNS_PER_TOPIC} turns) reached for this topic.`
                };
            }
        }

        // DEEP PHASE: Enforce max turns per topic to prevent tunnel vision
        const MAX_DEEP_TURNS_PER_TOPIC = 4;
        if (phase === 'DEEP' && deepTurnsByTopic) {
            const currentTopicTurns = deepTurnsByTopic[currentTopic.id] || 0;
            if (currentTopicTurns >= MAX_DEEP_TURNS_PER_TOPIC) {
                console.log(`🚫 [TopicManager] Max turns (${MAX_DEEP_TURNS_PER_TOPIC}) reached for topic "${currentTopic.label}". Forcing TRANSITION.`);
                return {
                    status: 'TRANSITION',
                    reason: `Maximum depth limit (${MAX_DEEP_TURNS_PER_TOPIC} turns) reached for this topic to ensure balanced exploration.`
                };
            }
        }

        // Limit history to last 15 messages to prevent timeouts and focus evaluation
        const recentHistory = messages.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['SCANNING', 'DEEPENING', 'TRANSITION', 'COMPLETION']),
            nextSubGoal: z.string().nullable().optional().describe("The next sub-goal to ask about (only if SCANNING)"),
            focusPoint: z.string().nullable().optional().describe("The specific user quote/concept to deep dive into (only if DEEPENING)"),
            reason: z.string()
        });

        let prompt = '';


        if (phase === 'SCAN') {
            prompt = `
You are an Interview Supervisor in GLOBAL SCAN PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}
Language: ${language}

Recent Conversation History:
${recentHistory}

PHASE GOAL: Broad coverage, but ensuring the user feels heard.

MANDATORY DECISION RULES (in priority order):

1. **TRIVIAL / CLOSING RESPONSE** (ABSOLUTE PRIORITY):
   - If the user's latest message is a polite filler (e.g., "prego", "grazie", "ok", "va bene", "no", "basta") WITHOUT new content -> IMMEDIATELY output status: TRANSITION.
   - Do NOT attempt to "deepen" on a "prego" or "thank you". It is a signal to move on.

2. **CONTENT SUFFICIENCY**:
   - Have we asked at least 1 substantial question about this topic?
   - Did the user provide a meaningful answer?
   - If YES to both AND we have explored the key aspects -> OUTPUT status: TRANSITION.
   - If NO or there are important sub-goals unexplored -> OUTPUT status: SCANNING with nextSubGoal.

3. **COMPREHENSIVE ANSWER TRIGGER**:
   - If the user's last answer was very detailed and covered multiple sub-goals -> TRANSITION immediately.

4. **USER SIGNALS**:
   - If user says "next", "basta", shows impatience -> TRANSITION.

NOTE: The system tracks turn limits externally. Focus on content quality, not counting.
NEVER output status: COMPLETION in SCAN phase. Only SCANNING or TRANSITION.

OUTPUT format:
- status: SCANNING | TRANSITION
- nextSubGoal: (only if SCANNING) Which sub-goal to explore next
- reason: Short explanation
`.trim();
        } else {
            // DEEP PHASE
            // Simple heuristic + TIME BUDGET check
            const recentAssistantCount = (recentHistory.match(/assistant:/gi) || []).length;

            // TIME BUDGET LOGIC
            // If we have very little time allocated (< 1.5 mins), we must be extremely strict.
            const isHurried = timeBudget !== undefined && timeBudget < 1.5;
            // PREVIOUS SCAN (approx 2 msgs) + NEW DEEP (increased to 3 msgs) = 5 TOTAL
            const maxQuestions = isHurried ? 3 : 5;

            prompt = `
You are an Interview Supervisor in GLOBAL DEEP DIVE PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}
Language: ${language}
Time Budget for this Topic: ${timeBudget ? Math.round(timeBudget) + ' mins' : 'Ample'}
Status: ${isHurried ? 'HURRY UP MODE (Time is running out!)' : 'Normal Pace'}
Recent assistant messages in history: ${recentAssistantCount}

Recent Conversation History:
${recentHistory}

PHASE GOAL: Add depth. Explore concepts.
CRITICAL: ${isHurried ? 'WE ARE SHORT ON TIME. WRAP UP THIS TOPIC FAST.' : 'Be thorough.'}

MANDATORY DECISION RULES (in priority order):

1. **WORTHWHILE CONCEPT CHECK**:
   - Review the user's previous answers about "${currentTopic.label}".
   - Identify concepts or themes that emerged and deserve deeper exploration.
   - If user has NOT answered any question about this topic in THIS Deep Phase yet -> OUTPUT status: DEEPENING.
   - If you find a new concept worth exploring -> OUTPUT status: DEEPENING with focusPoint.

2. **EXHAUSTION SIGNALS**:
   - If user's recent answers are short, generic, or repetitive -> TRANSITION.
   - If you cannot identify a NEW and MEANINGFUL concept to explore -> TRANSITION.

3. **ANTI-GENERIC RULE**:
   - NEVER use vague focus points like: "anything else", "tell me more".
   - Focus points must be SPECIFIC concepts from the user's answers.

NOTE: The system tracks turn limits externally (max ${maxQuestions} questions per topic). Focus on finding valuable concepts to explore.

OUTPUT format:
- status: DEEPENING | TRANSITION | COMPLETION
- focusPoint: (only if DEEPENING) Clear description of the concept to probe
- reason: Explanation
`.trim();
        }

        try {
            const openai = createOpenAI({ apiKey });
            // FORCE JSON MODE to ensure schema adherence
            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt
            });

            console.log(`📊 [TopicManager] (${phase}) Evaluation:`, {
                topic: currentTopic.label,
                timeBudget: timeBudget?.toFixed(1),
                decision: result.object.status,
                reason: result.object.reason
            });

            return result.object;

        } catch (error) {
            console.error("TopicManager Error:", error);
            // Default to transition on error to avoid stuck loops
            return { status: 'TRANSITION', reason: 'Error in evaluation' };
        }
    }

    /**
     * Checks if the user's message indicates consent to data collection.
     * Uses LLM for robust intent classification instead of brittle keywords.
     */
    static async checkConsent(
        userMessage: string,
        apiKey: string,
        language: string = 'en'
    ): Promise<'CONSENT' | 'REFUSAL' | 'NEUTRAL'> {
        const schema = z.object({
            intent: z.enum(['CONSENT', 'REFUSAL', 'NEUTRAL']),
            reason: z.string()
        });

        const prompt = `
You are evaluating a user's response to a request for contact details (recruiting/follow-up).
User Language: ${language}
User Message: "${userMessage}"

CONTEXT: The system just asked: "May I ask for your contact details?"

CLASSIFY INTENT:
- CONSENT: User agrees ("Yes", "Sure", "Why not", "Go ahead", "Ok", "Va bene", "Certo").
- REFUSAL: User declines ("No", "I'd rather not", "Maybe later", "Non voglio").
- NEUTRAL: Users asks a question or says something unrelated.

OUTPUT JSON: { intent, reason }
`.trim();

        try {
            const openai = createOpenAI({ apiKey });
            const result = await generateObject({
                model: openai('gpt-4o-mini'), // Fast & Cheap
                schema,
                prompt,
                temperature: 0
            });

            console.log(`🛡️ [TopicManager] Consent Check: ${result.object.intent} ("${userMessage.substring(0, 20)}...")`);
            return result.object.intent;
        } catch (e) {
            console.error("Consent check failed", e);
            return 'NEUTRAL'; // Fail safe
        }
    }
}

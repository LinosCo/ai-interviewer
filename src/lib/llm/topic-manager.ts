
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
        language: string = 'en'
    ): Promise<{ status: 'SCANNING' | 'DEEPENING' | 'TRANSITION' | 'COMPLETION'; nextSubGoal?: string; focusPoint?: string; reason: string }> {

        // Limit history to last 15 messages to prevent timeouts and focus evaluation
        const recentHistory = messages.slice(-15).map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['SCANNING', 'DEEPENING', 'TRANSITION', 'COMPLETION']),
            nextSubGoal: z.string().optional().describe("The next sub-goal to ask about (only if SCANNING)"),
            focusPoint: z.string().optional().describe("The specific user quote/concept to deep dive into (only if DEEPENING)"),
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

PHASE GOAL: Quick, broad coverage. Move FAST. Do NOT aim for depth.

MANDATORY DECISION RULES (in priority order):

1. **ABSOLUTE LIMIT** (HIGHEST PRIORITY):
   - Count the assistant messages in the recent history that discuss "${currentTopic.label}".
   - If you count 2 or more assistant questions about this topic -> IMMEDIATELY output status: TRANSITION.
   - NO EXCEPTIONS. This is a hard limit.

2. **CONTENT SUFFICIENCY** (if fewer than 2 assistant questions):
   - Have we asked at least 1 substantial question about this topic?
   - Did the user provide a meaningful answer (not just "yes", "ok", "non saprei")?
   - If YES to both -> OUTPUT status: TRANSITION.
   - If NO -> OUTPUT status: SCANNING with nextSubGoal.

3. **COMPREHENSIVE ANSWER TRIGGER**:
   - If the user's last answer was very detailed and covered multiple sub-goals -> TRANSITION immediately.

4. **USER SIGNALS**:
   - If user says "next", "basta", shows impatience -> TRANSITION.

CRITICAL: In SCAN phase, 2 questions per topic is the MAXIMUM. Your job is breadth, not depth.
NEVER output status: COMPLETION in SCAN phase. Only SCANNING or TRANSITION.

OUTPUT format:
- status: SCANNING | TRANSITION
- nextSubGoal: (only if SCANNING) Which sub-goal to explore next
- reason: Short explanation mentioning question count and content coverage
`.trim();
        } else {
            // DEEP PHASE
            // Data collection trigger only in DEEP phase
            const dataCollectionTrigger = isRecruiting
                ? `\n0. **DATA COLLECTION TRIGGER** (ONLY if explicitly appropriate):
   - If user explicitly asks to apply, be contacted, or share data ("candidarmi", "contattami", "apply")
   - OR if user asks "why aren't you asking for my contact?"
   - THEN output status: COMPLETION.
   - OTHERWISE: Never output COMPLETION. Use TRANSITION when topic is exhausted.`
                : '';

            prompt = `
You are an Interview Supervisor in GLOBAL DEEP DIVE PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}
Language: ${language}

Recent Conversation History:
${recentHistory}

PHASE GOAL: Add depth by exploring interesting concepts from the SCAN phase.${dataCollectionTrigger}

MANDATORY DECISION RULES (in priority order):

1. **ABSOLUTE LIMIT** (HIGHEST PRIORITY):
   - Count assistant messages about "${currentTopic.label}" in the recent history.
   - If you count 2 or more deep-dive questions -> IMMEDIATELY output status: TRANSITION.
   - NO EXCEPTIONS. Deep dive = max 2 questions per topic.

2. **WORTHWHILE CONCEPT CHECK**:
   - Review the user's previous answers about "${currentTopic.label}".
   - Identify concepts or themes that emerged and deserve deeper exploration.
   - Examples: motivations, concerns, contradictions, interesting details, emotional aspects.
   - **FOCUS ON CONCEPTS, NOT QUOTES**: Describe the concept to probe (e.g., "the user's concern about time management")
   - If you find such a concept AND haven't asked 2 deep questions yet -> OUTPUT status: DEEPENING with focusPoint.

3. **EXHAUSTION SIGNALS**:
   - If user's recent answers are short, generic ("ok", "va bene", "non lo so") -> TRANSITION.
   - If user already gave thorough explanations on all interesting aspects -> TRANSITION.
   - If you cannot identify a NEW and MEANINGFUL concept to explore -> TRANSITION.

4. **ANTI-GENERIC RULE**:
   - NEVER use vague focus points like: "anything else", "tell me more", "elaborate", "other thoughts".
   - Focus point must describe a specific concept or theme to explore.

OUTPUT format:
- status: DEEPENING | TRANSITION | COMPLETION
- focusPoint: (only if DEEPENING) Clear description of the concept to probe, e.g. "user's concerns about balancing multiple priorities"
- reason: Explanation of why this concept deserves depth OR why we should transition
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
                messagesCount: messages.length,
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
}

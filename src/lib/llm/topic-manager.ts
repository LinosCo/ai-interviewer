
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
        phase: 'SCAN' | 'DEEP' = 'SCAN'
    ): Promise<{ status: 'SCANNING' | 'DEEPENING' | 'TRANSITION'; nextSubGoal?: string; focusPoint?: string; reason: string }> {

        const recentHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['SCANNING', 'DEEPENING', 'TRANSITION']),
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

Conversation History:
${recentHistory}

GOAL: Quick, broad coverage.
1. Have we asked 2-3 high-level questions about this topic?
   - If YES -> TRANSITION immediately. Do not go deep.
   - If NO -> SCANNING. Pick a valid sub-goal.
2. STRICT LIMIT: If we have exchanged > 5 messages on this topic, MUST TRANSITION.
3. DO NOT ASK "Why?" or "Tell me more". Just get the basic facts.

OUTPUT criteria:
- status: SCANNING (if < 3 questions and sub-goals untouched) | TRANSITION (otherwise)
- nextSubGoal: The next broad sub-goal to cover.
- reason: "Scan limit reached" or "Moving to next sub-goal".
`.trim();
        } else {
            // DEEP PHASE
            prompt = `
You are an Interview Supervisor in GLOBAL DEEP DIVE PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}

Conversation History:
${recentHistory}

GOAL: Meticulous depth using SPECIFIC CONTEXT.
1. Review the history for this topic (including earlier passes). Have we fully covered all sub-goals in detail?
   - If sub-goals are missing or superficial -> SCANNING (but ask specific probing questions).
2. **CONTEXTUAL DEEPENING (CRITICAL)**:
   - Identify a specific interesting claim, emotion, or detail the user mentioned earlier.
   - You MUST cite this in your \`focusPoint\`.
   - Example Focus Point: "User mentioned 'feeling overwhelmed by emails' - ask specifically about that."
   - DO NOT allow generic deep dives like "Tell me more about X". It must be "You said X, why?"
   - **LIMIT**: You may perform a MAXIMUM of 2-3 deep dives (follow-up questions) per topic.
   - CHECK HISTORY: If you see we have already asked 2+ specific follow-up questions for this topic in the Deep Phase, you MUST TRANSITION. Do not get stuck.
3. If everything is thoroughly covered and we have probed the interesting bits -> TRANSITION.
4. **FAILSAFE**: If the user's answers are becoming short or repetitive -> TRANSITION.

OUTPUT criteria:
- status: SCANNING (if gaps exist) | DEEPENING (to probe specific user quotes) | TRANSITION (if exhausted)
- nextSubGoal: (If SCANNING)
- focusPoint: (If DEEPENING) - MUST refer to user's past words.
- reason: Explanation.
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
            return { status: 'TRANSITION', reason: 'Error in evaluation' };
        }
    }
}

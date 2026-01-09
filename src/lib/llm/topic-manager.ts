
import { Message, TopicBlock } from '@prisma/client';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export class TopicManager {

    /**
     * Evaluates if the current topic has been sufficiently covered based on the conversation history.
     * Uses a lightweight model (gpt-4o-mini) for speed and cost.
     */
    static async evaluateTopicProgress(
        messages: Message[],
        currentTopic: TopicBlock,
        apiKey: string
    ): Promise<{ status: 'SCANNING' | 'DEEPENING' | 'TRANSITION'; nextSubGoal?: string; focusPoint?: string; reason: string }> {

        const recentHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['SCANNING', 'DEEPENING', 'TRANSITION']),
            nextSubGoal: z.string().optional().describe("The next sub-goal to ask about (if SCANNING)"),
            focusPoint: z.string().optional().describe("The specific topic to deep dive into (if DEEPENING)"),
            reason: z.string()
        });

        let prompt = `
You are an Interview Supervisor.
Current Topic: "${currentTopic.label}"
Sub-Goals List:
${currentTopic.subGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Conversation History:
${recentHistory}

STRATEGY: "SCAN THEN ZOOM" (FLEXIBLE)
1. **SCAN PHASE**: Have we covered the sub-goals?
   - Check if the sub-goals have been addressed, EITHER by a direct question OR by the user voluntarily providing the information appropriately.
   - If a sub-goal is MISSING or barely touched, status is **SCANNING**. Set \`nextSubGoal\` to that topic.
   - If the user has already talked about a sub-goal in a previous answer, DO NOT ask about it again just to tick a box. Mark it as covered.

2. **ZOOM PHASE**: If sub-goals are reasonably covered:
   - **DEPTH CHECK**: Is there an interesting point that deserves elaboration?
     - If YES, status is **DEEPENING**. Set \`focusPoint\` to that specific detail.
   - Only if we have a good understanding of the topic, status is **TRANSITION**.

OUTPUT:
- status: SCANNING | DEEPENING | TRANSITION
- nextSubGoal: (ONLY include if status is SCANNING)
- focusPoint: (ONLY include if status is DEEPENING)
- reason: Explain clearly WHY (e.g. "User already mentioned X, so moving to Y" or "Sub-goals covered, transitioning")
`.trim();

        // FAILSAFE: If discussion is getting long, force progress
        if (messages.length > 20) {
            console.log('⚠️ [TopicManager] Failsafe triggered: Forced transition.');
            return { status: "TRANSITION", reason: "Failsafe: Topic message limit reached." };
        }

        // SOFT FAILSAFE: If > 12 messages, prioritize DEEPENING or TRANSITION over SCANNING to avoid loops
        if (messages.length > 12) {
            prompt += "\n\nCRITICAL INSTRUCTION: The conversation is getting long. PRIORITIZE moving to DEEPENING or TRANSITION. Only return SCANNING if a vital sub-goal is completely missing.";
        }

        try {
            const openai = createOpenAI({ apiKey });

            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt
            });

            console.log('📊 [TopicManager] Evaluation:', {
                topic: currentTopic.label,
                subGoalsCount: currentTopic.subGoals.length,
                messagesCount: messages.length,
                decision: result.object.status,
                nextSubGoal: result.object.nextSubGoal,
                focusPoint: result.object.focusPoint,
                reason: result.object.reason
            });

            return result.object;

        } catch (error) {
            console.error("TopicManager Error:", error);
            // Default safe fallback: Just Keep Going (or Transition if really broken)
            return { status: 'TRANSITION', reason: 'Error in evaluation' };
        }
    }
}

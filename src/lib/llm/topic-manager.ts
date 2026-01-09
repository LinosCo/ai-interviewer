
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

        const prompt = `
You are an Interview Supervisor.
Current Topic: "${currentTopic.label}"
Sub-Goals List:
${currentTopic.subGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Conversation History:
${recentHistory}

STRATEGY: "SCAN THEN ZOOM"
1. **SCAN PHASE**: Have we asked about ALL sub-goals in the list?
   - Check them one by one.
   - If ANY sub-goal is untouched, your status is **SCANNING**. 
   - Set \`nextSubGoal\` to the FIRST untouched sub-goal.
   - IGNORE the quality of answers. If asked, it is "covered".

2. **ZOOM PHASE**: If all sub-goals are covered (asked at least once):
   - **DEPTH CHECK**: Did any sub-goal receive only a short/surface-level answer?
     - If YES, your status is **DEEPENING**. Set \`focusPoint\` to "Elaborate closer on [Sub-Goal]".
   - **INTEREST CHECK**: Did the user give a detailed/enthusiastic answer?
     - If YES, and we haven't followed up, your status is **DEEPENING**. Set \`focusPoint\` to that specific detail.
   - Only if answers are SUFFICIENTLY DEEP or EXHAUSTED, your status is **TRANSITION**.

OUTPUT:
- status: SCANNING | DEEPENING | TRANSITION
- nextSubGoal: (Only for SCANNING)
- focusPoint: (Only for DEEPENING)
`.trim();

        try {
            const openai = createOpenAI({ apiKey });

            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt
            });

            return result.object;

        } catch (error) {
            console.error("TopicManager Error:", error);
            // Default safe fallback: Just Keep Going (or Transition if really broken)
            return { status: 'TRANSITION', reason: 'Error in evaluation' };
        }
    }
}

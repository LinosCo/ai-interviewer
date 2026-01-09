
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

STRATEGY: "SCAN THEN ZOOM" (STRICT)
1. **SCAN PHASE**: Have we asked about ALL sub-goals in the list?
   - Go through EACH sub-goal one by one.
   - A sub-goal is "covered" ONLY if the interviewer explicitly asked a question about it.
   - If ANY sub-goal has NOT been explicitly asked about, your status MUST be **SCANNING**.
   - Set \`nextSubGoal\` to the FIRST untouched sub-goal.
   - CRITICAL: Do NOT skip to ZOOM or TRANSITION until ALL sub-goals have been asked at least once.

2. **ZOOM PHASE**: ONLY if ALL sub-goals have been asked at least once:
   - **DEPTH CHECK**: Did any sub-goal receive only a short/surface-level answer (1-2 sentences)?
     - If YES, your status is **DEEPENING**. Set \`focusPoint\` to "Elaborate on [Sub-Goal]".
   - **INTEREST CHECK**: Did the user give a detailed/enthusiastic answer that deserves follow-up?
     - If YES, and we haven't followed up yet, your status is **DEEPENING**. Set \`focusPoint\` to that detail.
   - Only if ALL answers are SUFFICIENTLY DEEP (3+ sentences each) or topic is EXHAUSTED, your status is **TRANSITION**.

OUTPUT:
- status: SCANNING | DEEPENING | TRANSITION
- nextSubGoal: (ONLY include if status is SCANNING - otherwise omit this field entirely)
- focusPoint: (ONLY include if status is DEEPENING - otherwise omit this field entirely)
- reason: Explain your decision in detail
`.trim();

        if (messages.length > 20) { return { status: "TRANSITION", reason: "Failsafe: Topic message limit reached." }; }

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

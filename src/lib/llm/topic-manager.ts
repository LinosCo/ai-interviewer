
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

        const recentHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['SCANNING', 'DEEPENING', 'TRANSITION', 'COMPLETION']),
            nextSubGoal: z.string().optional().describe("The next sub-goal to ask about (only if SCANNING)"),
            focusPoint: z.string().optional().describe("The specific user quote/concept to deep dive into (only if DEEPENING)"),
            reason: z.string()
        });

        // Multilingual Triggers Definition
        const triggerInstruction = isRecruiting
            ? `0. **DATA COLLECTION TRIGGER**: If user says "apply", "candidate", "job", "work with you", "demo", "buy", "contact", "cost" (or translated: "candidarmi", "lavoro", "assunzione", "contattami", "preventivo", "comprare"), output status: 'COMPLETION'.`
            : `0. **STOP TRIGGER**: If user explicitly says "stop", "finish", "fine", "basta", output status: 'COMPLETION'.`;

        let prompt = '';

        if (phase === 'SCAN') {
            prompt = `
You are an Interview Supervisor in GLOBAL SCAN PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}
Language: ${language}

Conversation History:
${recentHistory}

GOAL: Quick, broad coverage.
${triggerInstruction}
1. Have we asked **2 high-level questions** about this topic?
   - If YES -> TRANSITION.
   - If NO -> SCANNING.
2. STRICT LIMIT: If > 4 messages on this topic -> TRANSITION.
3. If user's answer was comprehensive -> TRANSITION.

OUTPUT criteria:
- status: SCANNING | TRANSITION | COMPLETION
- nextSubGoal: The next broad sub-goal.
- reason: Explanation.
`.trim();
        } else {
            // DEEP PHASE
            prompt = `
You are an Interview Supervisor in GLOBAL DEEP DIVE PHASE.
Current Topic: "${currentTopic.label}"
Sub-Goals: ${currentTopic.subGoals.join(', ')}
Language: ${language}

Conversation History:
${recentHistory}

GOAL: Meticulous depth using SPECIFIC CONTEXT.
${triggerInstruction}
1. LIMIT: Max 2 specific deep-dive questions per topic. If reached -> TRANSITION.
2. **CONTEXTUAL DEEPENING**:
   - Identify interesting component.
   - If user answers are short/neutral -> TRANSITION.
3. **FAILSAFE**: If unsure -> TRANSITION.

OUTPUT criteria:
- status: DEEPENING | TRANSITION | COMPLETION
- focusPoint: Must cite user words.
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
            // Default to transition on error to avoid stuck loops
            return { status: 'TRANSITION', reason: 'Error in evaluation' };
        }
    }
}

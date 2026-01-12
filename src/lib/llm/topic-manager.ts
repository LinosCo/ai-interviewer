
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

        // Multilingual Triggers Definition
        const triggerInstruction = isRecruiting
            ? `0. **DATA COLLECTION TRIGGER**: If user says "yes", "ok", "willingly", "sure", "apply", "candidate", "job", "work with you", "demo", "buy", "contact", "cost", "data" (or translated: "si", "volentieri", "certo", "con piacere", "candidarmi", "lavoro", "assunzione", "contattami", "preventivo", "comprare", "dati", "contatto"), OR if the user asks why we aren't asking for data or asks "non mi chiedi i dati?", output status: 'COMPLETION'.`
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
   - Carefully read user answers. Identify a point that was: Surprising, Emotional, Contradictory, or very Detailed.
   - **CRITICAL**: If the user already provided a very thorough explanation of a point, DO NOT ask about it again.
   - If user answers are short, generic ("va bene", "ok"), or they seem to have nothing more to say -> TRANSITION.
3. **FAILSAFE**: If you cannot find a *new* and *interesting* angle to probe -> TRANSITION.
4. **NO GENERIC PROBES**: Never suggest focus points like "anything else" or "tell me more".

OUTPUT criteria:
- status: DEEPENING | TRANSITION | COMPLETION
- focusPoint: Must cite the specific user words/concept to probe.
- reason: Explanation of why this point deserves more depth.
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

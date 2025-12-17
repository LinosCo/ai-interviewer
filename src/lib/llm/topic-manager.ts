
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
        apiKey: string,
        modelProvider: 'openai' | 'anthropic' = 'openai'
    ): Promise<{ status: 'CONTINUE' | 'TRANSITION'; reason: string; missingPoints: string[] }> {

        // Filter messages relevant to the current topic context (last 10 messages for efficiency)
        // In a real scenario, we might want to check all messages since topic started.
        // For MVP, checking recent context + a system reminder of goals is good.
        // Actually, to be accurate, we should pass the messages that occurred *during* this topic.
        // But simplified filtering: last 6-8 messages usually contain the active discussion.
        const recentHistory = messages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n');

        const schema = z.object({
            status: z.enum(['CONTINUE', 'TRANSITION']),
            reason: z.string(),
            missingPoints: z.array(z.string()).describe("List of sub-goals NOT yet covered. Empty if TRANSITION.")
        });

        const prompt = `
You are a Supervisor monitoring an interview.
Current Topic: "${currentTopic.label}"
Sub-Goals to Cover:
${currentTopic.subGoals.map(g => `- ${g}`).join('\n')}

Recent Conversation History:
${recentHistory}

TASK:
Determine if the user has sufficiently covered the sub-goals.
- If YES (or mostly yes), output TRANSITION.
- If NO (critical info missing), output CONTINUE and list the missing points.
- If the user is resistant or off-topic, output TRANSITION to keep flow.
`.trim();

        try {
            // Default to OpenAI for this utility even if main bot uses Anthropic? 
            // Better to use the SAME provider key if possible, but 4o-mini is best for this specific logic.
            // If provider is Anthropic, we need to check if we can use Haiku or just use the same model.
            // For now, let's assume we can use the same generic 'ai' setup.

            // ToDo: Handle Anthropic provider for this utility step if user only has Anthropic Key.
            // For now, assume OpenAI Key is available or fallback to main model.
            // If modelProvider is 'anthropic', we might skip this optimization or use the main model (expensive).
            // Let's implement a safe fallback to "CONTINUE" if we can't run this.

            if (modelProvider === 'anthropic') {
                // Fallback: If we don't have a cheap anthropic model set up, just return CONTINUE (let main prompt decide).
                // OR: Use the main model?
                return { status: 'CONTINUE', reason: 'Anthropic provider: skipping optimization step', missingPoints: [] };
            }

            const openai = createOpenAI({ apiKey });

            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt
            });

            return result.object;

        } catch (error) {
            console.error("TopicManager Error:", error);
            // Default to continue if analysis fails
            return { status: 'CONTINUE', reason: 'Error in evaluation', missingPoints: [] };
        }
    }
}

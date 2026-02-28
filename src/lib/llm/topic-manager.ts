
import { TopicBlock } from '@prisma/client';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

export class TopicManager {

    /**
     * Generates the next sub-goal to explore in SCAN phase.
     * Simply picks the next unexplored sub-goal deterministically.
     */
    static async generateScanQuestion(
        topic: TopicBlock,
        turnIndex: number,
        apiKey: string,
        language: string = 'en',
        availableSubGoals?: string[]
    ): Promise<{ nextSubGoal: string }> {
        const subGoals = (availableSubGoals && availableSubGoals.length > 0)
            ? availableSubGoals
            : (topic.subGoals || []);

        // Deterministic: always pick the first available sub-goal
        const nextSubGoal = subGoals[0] || topic.label;

        console.log(`🎯 [TopicManager] SCAN: Turn ${turnIndex}, SubGoal: "${nextSubGoal}"`);

        return { nextSubGoal };
    }

    /**
     * Generates a focus point for DEEP phase.
     * CRITICAL: Must pick a DIFFERENT sub-goal than what was already explored.
     * Does NOT drag user-mentioned themes across topics.
     */
    static async generateDeepQuestion(
        topic: TopicBlock,
        turnIndex: number,
        recentMessages: any[],
        apiKey: string,
        language: string = 'en',
        availableSubGoals?: string[]
    ): Promise<{ focusPoint: string }> {
        const openai = createOpenAI({ apiKey });

        const subGoals = (availableSubGoals && availableSubGoals.length > 0)
            ? availableSubGoals
            : (topic.subGoals || []);
        // Sanitize conversation history (end-user content) and admin-configured labels
        const recentHistory = recentMessages
            .slice(-6)
            .map(m => `${m.role}: ${sanitize(m.content, 1000)}`)
            .join('\n');
        const safeTopicLabel = sanitizeConfig(topic.label, 200);
        const safeSubGoals = subGoals.map(g => sanitizeConfig(g, 200));

        const schema = z.object({
            focusPoint: z.string().describe('A specific sub-goal to explore deeply'),
            reason: z.string()
        });

        const prompt = `
You are selecting the NEXT deep-dive question for topic: "${safeTopicLabel}"
Language: ${language}

Available sub-goals for THIS topic: ${safeSubGoals.join(', ')}

Recent conversation:
${recentHistory}

Current turn: ${turnIndex + 1}

RULES:
1. **TOPIC BOUNDARY**: Focus ONLY on "${safeTopicLabel}" sub-goals. Do NOT explore themes from other topics.
2. **NO THEME DRAGGING**: If user mentioned a general concept (like "sustainability"), do NOT apply it to this topic. Each topic gets fresh exploration.
3. **DIVERSIFICATION**: Pick a sub-goal that has NOT been deeply discussed yet in recent messages.
4. **SPECIFICITY**: The focusPoint must be a SPECIFIC sub-goal from the list above.
5. **NO GENERIC**: Never use "anything else", "tell me more", "other aspects".

OUTPUT: Pick ONE specific sub-goal from the list that hasn't been explored yet.
`.trim();

        try {
            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt,
                temperature: 0.3
            });

            console.log(`🎯 [TopicManager] DEEP: Turn ${turnIndex}, Focus: "${result.object.focusPoint}"`);
            return { focusPoint: result.object.focusPoint };

        } catch (error) {
            console.error("TopicManager DEEP error:", error);
            // Fallback: pick deterministically
            const fallbackIndex = turnIndex % subGoals.length;
            return { focusPoint: subGoals[fallbackIndex] || topic.label };
        }
    }

    /**
     * Checks if the user's message indicates consent to data collection.
     * @deprecated Use checkUserIntent in route.ts instead
     */
    static async checkConsent(
        userMessage: string,
        apiKey: string,
        language: string = 'en'
    ): Promise<'CONSENT' | 'REFUSAL' | 'NEUTRAL'> {
        const openai = createOpenAI({ apiKey });

        const schema = z.object({
            intent: z.enum(['CONSENT', 'REFUSAL', 'NEUTRAL']),
            reason: z.string()
        });

        const safeMessage = sanitize(userMessage, 500);
        const prompt = `
Evaluate if the user agrees to provide contact details.
Language: ${language}
User message: "${safeMessage}"

CLASSIFY:
- CONSENT: User agrees ("Yes", "Sure", "Ok", "Va bene", "Certo")
- REFUSAL: User declines ("No", "I'd rather not", "Non voglio")
- NEUTRAL: Question or unrelated

OUTPUT JSON: { intent, reason }
`.trim();

        try {
            const result = await generateObject({
                model: openai('gpt-4o-mini'),
                schema,
                prompt,
                temperature: 0
            });

            console.log(`🛡️ [TopicManager] Consent: ${result.object.intent}`);
            return result.object.intent;
        } catch (e) {
            console.error("Consent check failed", e);
            return 'NEUTRAL';
        }
    }
}

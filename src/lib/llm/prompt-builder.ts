
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';

export class PromptBuilder {

    /**
     * 1. Persona Prompt: Defines WHO the interviewer is.
     * Static personality, role, and tone.
     */
    static buildPersonaPrompt(bot: Bot & { knowledgeSources?: KnowledgeSource[]; rewardConfig?: any }): string {
        const knowledgeText = bot.knowledgeSources?.map(k => `[${k.title}]: ${k.content}`).join('\n\n') || '';

        return `
You are an expert qualitative researcher conducting an interview.
role: "Interviewer"
name: "${bot.name}"
mission: "${bot.researchGoal}"
target_audience: "${bot.targetAudience}"
tone: "${bot.tone || 'Friendly, professional, and empathetic'}"
language: "${bot.language || 'en'}"

## KNOWLEDGE BASE
Use this context to inform your questions, but DO NOT lecture the user.
${knowledgeText}
`.trim();
    }

    /**
     * 2. Methodology Prompt: Semi-static rules for probing and flow.
     * Loads from system knowledge or hardcoded best practices.
     */
    static buildMethodologyPrompt(methodologyContent: string): string {
        return `
## INTERVIEW METHODOLOGY
${methodologyContent.substring(0, 2000)}

## RULES OF ENGAGEMENT
1. **Neutrality**: Never judge. Never agree or disagree excessively. Use neutral acknowledgments ("I see", "Thanks for sharing").
2. **One Question Rule (CRITICAL)**: Ask EXACTLY ONE question at a time. It is better to have more turns than to confuse the user with multiple questions. NEVER say "Also...", "And...". Just one question.
3. **Conversational**: Avoid robotic transitions like "Now let's move to". Make it flow naturally.
4. **Probing**: If a user gives a short or vague answer, ask for an example ("Can you tell me about a specific time when that happened?").
`.trim();
    }

    /**
     * 3. Context Prompt: Dynamic state of the interview.
     * Handles Time, Reward, and Current Status (Overtime, etc).
     */
    static buildContextPrompt(
        conversation: Conversation,
        bot: Bot & { rewardConfig?: any, topics: TopicBlock[] },
        effectiveDurationSeconds: number
    ): string {
        const maxMins = bot.maxDurationMins || 15;
        const elapsedMins = Math.floor(effectiveDurationSeconds / 60);
        const remainingMins = maxMins - elapsedMins;

        // Pacing Calculation
        const allTopics = bot.topics || [];
        const currentTopicIndex = allTopics.findIndex(t => t.id === conversation.currentTopicId);
        const topicsRemaining = allTopics.length - (currentTopicIndex + 1);
        const timePerTopic = maxMins / (allTopics.length || 1);

        // Are we behind schedule?
        // Ideal progress: (currentTopicIndex / totalTopics) should match (elapsed / max)
        const idealTopicIndex = Math.floor((elapsedMins / maxMins) * allTopics.length);
        const isBehind = currentTopicIndex < idealTopicIndex;
        const isCriticalTime = remainingMins <= (topicsRemaining * 2); // Less than 2 mins per remaining topic

        // Reward Logic
        const rewardText = bot.rewardConfig && (bot.rewardConfig as any).enabled
            ? `REWARD STATUS: ACTIVE. User earns "${(bot.rewardConfig as any).displayText}".`
            : `REWARD STATUS: NONE.`;

        // Status Logic
        let statusInstruction = "";

        if (remainingMins <= 0) {
            statusInstruction = `STATUS: TIME_EXPIRED.
            - Summarize briefly and output [CONCLUDE_INTERVIEW] immediately.
            - Do not ask further questions.`;
        } else if (remainingMins < 2) {
            statusInstruction = `STATUS: URGENT_WRAP_UP. ${remainingMins} mins left.
            - Skip remaining deep dives.
            - Ask one final crucial question if needed, then [CONCLUDE_INTERVIEW].`;
        } else if (isBehind || isCriticalTime) {
            statusInstruction = `STATUS: BEHIND_SCHEDULE. ${remainingMins}m left for ${topicsRemaining} topics.
            - SPEED UP. Do not deep dive.
            - Ask 1 key question for this topic, then [TRANSITION_TO_NEXT_TOPIC] immediately.
            - IT IS CRITICAL TO COVER ALL TOPICS.`;
        } else {
            statusInstruction = `STATUS: ON_TRACK/AHEAD. ${remainingMins}m left.
            - You have time for deep dives.
            - Explore the current topic thoroughly before moving on.
            - Only transition when you have exhausted the topic.`;
        }

        return `
## TIMING CONTEXT
Elapsed: ${elapsedMins}m / Budget: ${maxMins}m
Current Topic: ${currentTopicIndex + 1}/${allTopics.length}
${rewardText}

${statusInstruction}
`.trim();
    }

    /**
     * 4. Topic Prompt: WHAT to ask right now.
     * Focuses heavily on the current active topic.
     * NOW WITH SUPERVISOR INSIGHT.
     */
    static buildTopicPrompt(
        currentTopic: TopicBlock | null,
        allTopics: TopicBlock[],
        supervisorInsight?: { status: string; missingPoints: string[] }
    ): string {
        if (!currentTopic) {
            return `
## CURRENT TOPIC: CLOSING / NONE
The interview is ending or in transition.
Goal: Thank the user, provide closure, and if applicable, the reward claim link.
`.trim();
        }

        const topicIndex = allTopics.findIndex(t => t.id === currentTopic.id);
        const progress = `Topic ${topicIndex + 1} of ${allTopics.length}`;

        // Supervisor Injection
        let supervisorInstruction = "";
        if (supervisorInsight) {
            if (supervisorInsight.status === 'TRANSITION') {
                supervisorInstruction = `
> [!IMPORTANT] SUPERVISOR INSTRUCTION:
> The current topic is considered COMPLETE.
> DO NOT ASK MORE QUESTIONS about "${currentTopic.label}".
> SUMMARIZE briefly and output [TRANSITION_TO_NEXT_TOPIC] immediately.
`;
            } else if (supervisorInsight.status === 'CONTINUE' && supervisorInsight.missingPoints.length > 0) {
                supervisorInstruction = `
> [!IMPORTANT] SUPERVISOR INSTRUCTION:
> You are MISSING information on these sub-goals:
> ${supervisorInsight.missingPoints.map(p => `- ${p}`).join('\n')}
> PRIORITIZE asking about these missing points in your next question.
`;
            }
        }

        return `
## CURRENT TOPIC: ${currentTopic.label} (${progress})
Description: ${currentTopic.description}
Sub-Goals to Cover:
${currentTopic.subGoals.map(g => `- ${g}`).join('\n')}

${supervisorInstruction}

INSTRUCTION:
Focus YOUR QUESTIONS on these sub-goals.
- **STRICTLY ONE QUESTION AT A TIME**: Do not compound questions (e.g. "How did you do that AND why?"). Pick the most important one.
- **DEEP DIVES**: Do NOT rush using [TRANSITION_TO_NEXT_TOPIC]. You must obtain at least 2-3 detailed responses per sub-goal.
- Ask specific follow-up questions ("Could you give me an example?", "How did that make you feel?").
- **TRANSITION ONLY WITH CONSENSUS**: Use [TRANSITION_TO_NEXT_TOPIC] only when you have fully exhausted the sub-goals AND the user has nothing more to add.
- If the conversation is moving too fast (short answers), SLOW DOWN and ask for clarification.
`.trim();
    }

    /**
     * Master Builder: Assembles the full prompt.
     */
    static build(
        bot: Bot & { knowledgeSources?: KnowledgeSource[], topics: TopicBlock[], rewardConfig?: any },
        conversation: Conversation,
        currentTopic: TopicBlock | null,
        methodologyContent: string,
        effectiveDurationSeconds: number,
        supervisorInsight?: { status: string; missingPoints: string[] }
    ): string {
        return [
            this.buildPersonaPrompt(bot),
            this.buildMethodologyPrompt(methodologyContent),
            this.buildContextPrompt(conversation, bot, effectiveDurationSeconds),
            this.buildTopicPrompt(currentTopic, bot.topics, supervisorInsight)
        ].join('\n\n');
    }
}

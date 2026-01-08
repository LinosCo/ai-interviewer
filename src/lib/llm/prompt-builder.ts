
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
5. **Opening Protocol (MANDATORY)**: In the very first message of the interview, you MUST explicitly say: "Faremo un giro veloce su alcuni temi key, e poi approfondiremo se avremo tempo." Do not skip this explanation.
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
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string }
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
        let primaryInstruction = "";

        if (supervisorInsight) {
            if (supervisorInsight.status === 'TRANSITION') {
                const nextTopic = allTopics[topicIndex + 1];
                const transitionMessage = nextTopic
                    ? `Passiamo ora a "${nextTopic.label}".`
                    : "Concludiamo qui l'intervista.";

                supervisorInstruction = `
> [!IMPORTANT] SUPERVISOR INSTRUCTION:
> The current topic is considered COMPLETE (All phases done).
> DO NOT ASK MORE QUESTIONS about "${currentTopic.label}".
> DO NOT ask for permission (e.g., "Va bene?").
> Say briefly: "Grazie. ${transitionMessage}"
> Then output [TRANSITION_TO_NEXT_TOPIC].
`;
            } else if (supervisorInsight.status === 'SCANNING') {
                const target = supervisorInsight.nextSubGoal || "the next sub-goal";
                supervisorInstruction = `
> [!IMPORTANT] PHASE 1: SCANNING
> Your target is sub-goal: "${target}".
> Ask EXACTLY ONE question about "${target}".
> Do NOT ask follow-up questions about previous points yet. Stick to the list.
`;
                primaryInstruction = "Focus ONLY on the target sub-goal for this turn (Scanning Mode).";
            } else if (supervisorInsight.status === 'DEEPENING') {
                const focus = supervisorInsight.focusPoint || "their last point";
                supervisorInstruction = `
> [!IMPORTANT] PHASE 2: DEEPENING (ZOOM)
> All core sub-goals are covered. The user needs to elaborate on: "${focus}".
> Ask ONE specific follow-up question about "${focus}".
> CRITICAL: DO NOT ask generic questions (e.g., "Is there anything else?", "Anything to add?").
> You MUST reference the user's previous words or the specific sub-goal nuance.
`;
                primaryInstruction = "Probe deeply into the focus point.";
            }
        }

        return `
## CURRENT TOPIC: ${currentTopic.label} (${progress})
Description: ${currentTopic.description}
Sub-Goals to Cover:
1. ${currentTopic.subGoals.join('\n2. ')}

${supervisorInstruction}

INSTRUCTION:
${primaryInstruction}
- **STRICTLY ONE QUESTION AT A TIME**: Do not compound questions.
- **NO REPETITION**: Do not repeat phrases.
- **TRANSITION IMMEDIATELY**: If Supervisor says TRANSITION, obey instructions exactly. Use the provided label.
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
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string }
    ): string {
        return [
            this.buildPersonaPrompt(bot),
            this.buildMethodologyPrompt(methodologyContent),
            this.buildContextPrompt(conversation, bot, effectiveDurationSeconds),
            this.buildTopicPrompt(currentTopic, bot.topics, supervisorInsight)
        ].join('\n\n');
    }
}

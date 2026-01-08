
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
2. **One Question Rule**: Ask EXACTLY ONE question at a time. Never double-barrel questions.
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
        bot: Bot & { rewardConfig?: any },
        effectiveDurationSeconds: number
    ): string {
        const maxMins = bot.maxDurationMins || 15;
        const elapsedMins = Math.floor(effectiveDurationSeconds / 60);
        const remainingMins = maxMins - elapsedMins;

        // Reward Logic
        const rewardText = bot.rewardConfig && (bot.rewardConfig as any).enabled
            ? `REWARD STATUS: ACTIVE. User earns "${(bot.rewardConfig as any).displayText}".\nIMPORTANT: Do NOT mention the reward unless the interview is concluding or the user asks.`
            : `REWARD STATUS: NONE.`;

        // Status Logic
        let statusInstruction = "";
        if (remainingMins <= 0) {
            statusInstruction = `STATUS: TIME_EXPIRED.
- If you are in the middle of a topic, summarize and close it.
- You MUST negotiate overtime or conclude.
- If user agreed to overtime: "Generate questions for deep dive".
- If user refused overtime: "Conclude interview immediately".`;
        } else if (remainingMins < 3) {
            statusInstruction = `STATUS: WRAPPING_UP. Time is running out (${remainingMins} mins left). Start converging to the end.`;
        } else {
            statusInstruction = `STATUS: ON_TRACK. ${remainingMins} minutes remaining. 
            - Maintain steady pace. 
            - If you feel the interview is ending too quickly, PROPOSE A DEEP DIVE: "We have some time left. Would you like to explore [Specific Topic] in more detail?"`;
        }

        return `
## CURRENT CONTEXT
Elapsed: ${elapsedMins}m / Budget: ${maxMins}m
${rewardText}
${statusInstruction}
`.trim();
    }

    /**
     * 4. Topic Prompt: WHAT to ask right now.
     * Focuses heavily on the current active topic.
     */
    static buildTopicPrompt(currentTopic: TopicBlock | null, allTopics: TopicBlock[]): string {
        if (!currentTopic) {
            return `
## CURRENT TOPIC: CLOSING / NONE
The interview is ending or in transition. 
Goal: Thank the user, provide closure, and if applicable, the reward claim link.
`.trim();
        }

        const topicIndex = allTopics.findIndex(t => t.id === currentTopic.id);
        const progress = `Topic ${topicIndex + 1} of ${allTopics.length}`;

        return `
## CURRENT TOPIC: ${currentTopic.label} (${progress})
Description: ${currentTopic.description}
Sub-Goals to Cover:
${currentTopic.subGoals.map(g => `- ${g}`).join('\n')}

INSTRUCTION: 
Focus YOUR QUESTIONS on these sub-goals. 
- Do NOT rush. Explore each sub-goal deeply.
- Ask follow-up questions ("Why?", "Can you elaborate?") if the user provides brief answers.
- Only when you have collected detailed information for ALL sub-goals, use the 'transitionToNextTopic' tool.
- If you finish early (under 5 turns), ask if there are other aspects they'd like to discuss before moving on.
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
        effectiveDurationSeconds: number
    ): string {
        return [
            this.buildPersonaPrompt(bot),
            this.buildMethodologyPrompt(methodologyContent),
            this.buildContextPrompt(conversation, bot, effectiveDurationSeconds),
            this.buildTopicPrompt(currentTopic, bot.topics)
        ].join('\n\n');
    }
}

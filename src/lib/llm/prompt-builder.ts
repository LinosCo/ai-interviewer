
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';

export class PromptBuilder {

    /**
     * Helper: Get opening protocol message in the correct language
     */
    private static getOpeningProtocol(language: string): string {
        const messages: Record<string, string> = {
            'it': 'Faremo un giro veloce su alcuni temi key, e poi approfondiremo se avremo tempo.',
            'en': 'We\'ll do a quick scan of key topics, then dive deeper into the most interesting points if we have time.',
            'es': 'Haremos un recorrido rápido por los temas clave, y luego profundizaremos si tenemos tiempo.',
            'fr': 'Nous ferons un tour rapide des sujets clés, puis nous approfondirons si nous avons le temps.',
            'de': 'Wir machen einen schnellen Durchgang durch die wichtigsten Themen und vertiefen dann, wenn wir Zeit haben.'
        };
        return messages[language] || messages['en'];
    }

    private static getRecruitmentPrompt(language: string): string {
        const prompts: Record<string, string> = {
            'it': `
## FASE: RACCOLTA DATI (RECRUITING)
La parte di contenuto dell'intervista è conclusa.
Il tuo obiettivo ora è agire come un **Recruiter gentile**.

ISTRUZIONI:
1. Ringrazia l'utente per il tempo e gli spunti preziosi.
2. Spiega che per processare la sua candidatura/partecipazione, hai bisogno di alcuni dettagli.
3. Chiedi chiaramente: **Nome e Cognome, Email e Numero di Telefono**.
4. Se l'utente rifiuta, accetta gentilmente e concludi.
5. Se l'utente fornisce i dati, ringrazia e conferma che il profilo verrà salvato.

STILE:
- Professionale, amministrativo ma cordiale.
- "Prima di salutarci, mi piacerebbe restare in contatto..."
- NON fare più domande sui temi dell'intervista.
`,
            'en': `
## PHASE: DATA COLLECTION (RECRUITMENT)
The main interview is complete. 
Your goal now is to act as a **polite Recruiter**.

INSTRUCTIONS:
1. Thank the user for their time and valuable insights.
2. Explain that to process their candidacy/application, you need some details.
3. Ask clearly for: **Full Name, Email, and Phone Number**.
4. If the user refuses, politely accept and conclude.
5. If the user provides data, acknowledge and say you will save their profile.

STYLE:
- Professional, administrative but warm.
- "Before we wrap up, I'd love to stay in touch..."
- DO NOT ask anymore content questions.
`
        };
        return prompts[language] || prompts['en'];
    }

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
    static buildMethodologyPrompt(methodologyContent: string, language: string = 'en'): string {
        const openingProtocol = this.getOpeningProtocol(language);
        return `
## INTERVIEW METHODOLOGY
${methodologyContent.substring(0, 2000)}

## RULES OF ENGAGEMENT
1. **Neutrality**: Never judge. Never agree or disagree excessively. Use neutral acknowledgments ("I see", "Thanks for sharing").
2. **One Question Rule (CRITICAL)**: Ask EXACTLY ONE question at a time. NEVER end a response without asking a question. Every response MUST end with "?". It is better to have more turns than to confuse the user with multiple questions. NEVER say "Also...", "And...". Just one question.
3. **Conversational**: Avoid robotic transitions like "Now let's move to". Make it flow naturally.
4. **Probing**: If a user gives a short or vague answer, ask for an example ("Can you tell me about a specific time when that happened?").
5. **Opening Protocol (MANDATORY)**: In the very first message of the interview, you MUST explicitly say: "${openingProtocol}" Do not skip this explanation.
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
            - Summarize briefly and conclude the interview.
            - Do not ask further questions.`;
        } else if (remainingMins < 2) {
            statusInstruction = `STATUS: URGENT_WRAP_UP. ${remainingMins} mins left.
            - Skip remaining deep dives.
            - Ask one final crucial question if needed, then conclude.`;
        } else if (isBehind || isCriticalTime) {
            statusInstruction = `STATUS: BEHIND_SCHEDULE. ${remainingMins}m left for ${topicsRemaining} topics.
            - SPEED UP. Do not deep dive.
            - Ask 1 key question for this topic.
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
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string },
        bot?: Bot // Added for language access and fields
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
            if (supervisorInsight.status === 'DATA_COLLECTION') {
                // RECRUITER MODE - DYNAMIC FIELDS
                const fields = (bot?.candidateDataFields as string[]) || ['Full Name', 'Email', 'Phone Number'];
                const fieldsList = fields.length > 0 ? fields.join(', ') : 'Full Name, Email';

                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const instructions = isItalian ? `
## FASE: RACCOLTA DATI (LEAD / RECRUITING)
L'intervista è conclusa (o l'utente ha chiesto un contatto).
Il tuo obiettivo ora è raccogliere i dati necessari.
ISTRUZIONI:
1. Ringrazia l'utente.
2. Spiega che per procedere (con la candidatura o la richiesta) hai bisogno di: **${fieldsList}**.
3. Chiedili gentilmente.
4. Se l'utente rifiuta, accetta e concludi.
` : `
## PHASE: DATA COLLECTION (LEAD / RECRUITING)
The interview is complete (or user requested contact).
Your goal is to collect necessary details.
INSTRUCTIONS:
1. Thank the user.
2. Explain you need these details to proceed: **${fieldsList}**.
3. Ask for them politely.
4. If refused, accept and conclude.
`;

                return instructions.trim();

            } else if (supervisorInsight.status === 'TRANSITION') {
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
`;
            } else if (supervisorInsight.status === 'SCANNING') {
                const target = supervisorInsight.nextSubGoal || "the next sub-goal";
                supervisorInstruction = `
> [!IMPORTANT] PHASE 1: SCANNING
> Your target is sub-goal: "${target}".
> Ask EXACTLY ONE question about "${target}".
> Do NOT ask follow-up questions about previous points yet. Stick to the list.
> DO NOT output [CONCLUDE_INTERVIEW]. DO NOT say "We are done".
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
> DO NOT output [CONCLUDE_INTERVIEW]. Continue probing.
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
- **ALWAYS END WITH A QUESTION**: Every response MUST end with "?". Never end with just "Grazie!" or acknowledgments.
- **TRANSITION IMMEDIATELY**: If Supervisor says TRANSITION, obey instructions exactly. Use the provided label.
`.trim();
    }

    /**
     * 5. Transition Prompt (NEW):
     * Used when the system decides to switch topics in a single turn.
     */
    static buildTransitionPrompt(
        currentTopic: TopicBlock,
        nextTopic: TopicBlock,
        methodologyContent: string,
        phase: 'SCAN' | 'DEEP' = 'SCAN'
    ): string {
        const transitionInstruction = phase === 'DEEP'
            ? `
> [!IMPORTANT] DEEP DIVE RELAUNCH
> We are returning to "${nextTopic.label}" for a second pass (Deep Dive).
> Context: The user has already touched on this topic lightly in the Scan Phase.
> INSTRUCTION: 
> 1. Acknowledge the previous topic briefly.
> 2. Pivot to "${nextTopic.label}" with a clear intent to go deeper.
> 3. ASK A SPECIFIC, PROBING QUESTION about "${nextTopic.label}" based on what you know or a specific sub-goal.
> 4. DO NOT ask a generic "What do you think?". BE SPECIFIC.`
            : `
> SMOOTH TRANSITION
> 1. Briefly acknowledge the user's last answer regarding "${currentTopic.label}".
> 2. Smoothly pivot to the new topic: "${nextTopic.label}".
> 3. ASK THE FIRST QUESTION of the new topic immediately.`;

        return `
## TRANSITION MODE (${phase} PHASE)
You are moving from Topic: "${currentTopic.label}" -> To: "${nextTopic.label}".

${transitionInstruction}

CONTEXT on New Topic:
${nextTopic.description}
Sub-Goals:
${nextTopic.subGoals.map(g => `- ${g}`).join('\n')}

STYLE:
- Be conversational.
- NO "Passiamo a...". Just do it naturally.
- **CRITICAL: YOU MUST END WITH A QUESTION.** Do not just say "Thanks".
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
            this.buildMethodologyPrompt(methodologyContent, bot.language || 'en'),
            this.buildContextPrompt(conversation, bot, effectiveDurationSeconds),
            this.buildTopicPrompt(currentTopic, bot.topics, supervisorInsight, bot)
        ].join('\n\n');
    }
}

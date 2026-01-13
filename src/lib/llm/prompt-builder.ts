
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import { MemoryManager } from '@/lib/memory/memory-manager';

const FIELD_LABELS: Record<string, { it: string, en: string }> = {
    name: { it: 'Nome Completo', en: 'Full Name' },
    email: { it: 'Indirizzo Email', en: 'Email Address' },
    phone: { it: 'Numero di Telefono', en: 'Phone Number' },
    company: { it: 'Azienda/Organizzazione', en: 'Company/Organization' },
    linkedin: { it: 'Profilo LinkedIn/Social', en: 'LinkedIn/Social Profile' },
    portfolio: { it: 'Portfolio/Sito Web', en: 'Portfolio/Website' },
    role: { it: 'Ruolo Attuale', en: 'Current Role' },
    location: { it: 'Città/Località', en: 'City/Location' },
    budget: { it: 'Budget', en: 'Budget' },
    availability: { it: 'Disponibilità (Recruiting)', en: 'Availability' }
};

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

## YOUR IDENTITY & PARTICIPANT RELATIONSHIP
- **IMPORTANT**: The person you are talking to is the **PARTICIPANT**, not the creator of the event/project.
- DO NOT say "Your event", "Your project", or "How can I help you build this".
- Instead use: "The event you attended", "Your experience at the event", "Your opinion as a participant".
- You are representing "${bot.name}" to gather their honest feedback.

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
5. **NO REPETITION (STRICT)**: Always check the conversation history. Never ask a question that has already been answered or asked. Do not repeat the same concepts or words in consecutive turns.
6. **Opening Protocol (MANDATORY)**: In the very first message of the interview, you MUST explicitly say: "${openingProtocol}" Do not skip this explanation.

## FINAL FAILSAFE RULE
ALWAYS END YOUR RESPONSE WITH A QUESTION MARK (?). 
Even if you are thanking the user or transitioning to a new topic, the very last character of your output MUST be a question mark.
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
        const maxMins = bot.maxDurationMins || 10;
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
        bot?: any // Added for language access and fields
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
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const fieldIds = (bot?.candidateDataFields as string[]) || ['name', 'email'];
                const fieldsList = fieldIds.map(id => {
                    const label = FIELD_LABELS[id];
                    return label ? (isItalian ? label.it : label.en) : id;
                }).join(', ');

                const instructions = isItalian ? `
## FASE: RACCOLTA DATI (CONTATTI)
L'utente ha ACCETTATO di lasciare i propri dati di contatto.

**CAMPI DA RACCOGLIERE**: ${fieldsList}

**REGOLA D'ORO ASSOLUTA**: Chiedi i dati UNO ALLA VOLTA. Mai più di un campo per volta.

**PROCESSO PASSO-PASSO**:
1. **RINGRAZIAMENTO**: "Perfetto! Grazie mille."
2. **PRIMO CAMPO**: Chiedi SOLO il primo campo che manca: ${fieldIds[0] ? (FIELD_LABELS[fieldIds[0]]?.it || fieldIds[0]) : 'primo campo'}
3. **CONFERMA E NEXT**: Quando l'utente risponde, conferma e chiedi il SUCCESSIVO
4. **RIPETI**: Continua fino ad aver chiesto TUTTI i campi della lista

**IMPORTANTISSIMO**:
- NON elencare tutti i campi richiesti ("Ti chiederò nome, email e telefono...")
- NON chiedere due campi insieme ("Qual è il tuo nome e email?")
- Se l'utente fornisce più dati insieme, ringraziali e chiedi il campo successivo mancante
- Usa il nome dell'utente se lo hai già ricevuto (tono personale)
- Se l'utente rifiuta esplicitamente → termina con "INTERVIEW_COMPLETED"

**CHIUSURA**: Dopo aver ricevuto TUTTI i ${fieldIds.length} campi (${fieldsList}), ringrazia e scrivi: "INTERVIEW_COMPLETED"

**ESEMPIO FLUSSO**:
- "Perfetto! Cominciamo dal tuo nome. Come ti chiami?"
- [utente: "Mario Rossi"]
- "Grazie Mario! Ora, qual è la tua email?"
- [utente: "mario@email.it"]
- "Perfetto. Ultimo dato: il tuo numero di telefono?"
- [utente: "333..."]
- "Grazie mille Mario! Ho registrato tutto. INTERVIEW_COMPLETED"
` : `
## PHASE: DATA COLLECTION (CONTACTS)
The user has AGREED to leave their contact details.

**FIELDS TO COLLECT**: ${fieldsList}

**ABSOLUTE GOLDEN RULE**: Ask for details ONE AT A TIME. Never more than one field per turn.

**STEP-BY-STEP PROCESS**:
1. **THANK YOU**: "Perfect! Thank you so much."
2. **FIRST FIELD**: Ask ONLY for the first missing field: ${fieldIds[0] ? (FIELD_LABELS[fieldIds[0]]?.en || fieldIds[0]) : 'first field'}
3. **CONFIRM & NEXT**: When user responds, confirm and ask for the NEXT one
4. **REPEAT**: Continue until you've asked for ALL fields in the list

**CRITICALLY IMPORTANT**:
- DO NOT list all required fields ("I'll need your name, email and phone...")
- DO NOT ask for two fields together ("What's your name and email?")
- If user provides multiple data points together, thank them and ask for next missing field
- Use the user's name if you already have it (personal tone)
- If user explicitly refuses → end with "INTERVIEW_COMPLETED"

**CLOSING**: After receiving ALL ${fieldIds.length} fields (${fieldsList}), thank them and write: "INTERVIEW_COMPLETED"

**EXAMPLE FLOW**:
- "Perfect! Let's start with your name. What's your full name?"
- [user: "John Smith"]
- "Thank you John! Now, what's your email?"
- [user: "john@email.com"]
- "Great. Last one: your phone number?"
- [user: "555..."]
- "Thank you so much John! I've got everything. INTERVIEW_COMPLETED"
`;

                return instructions.trim();

            } else if (supervisorInsight.status === 'TRANSITION') {
                const nextTopic = allTopics[topicIndex + 1];

                supervisorInstruction = `
> [!IMPORTANT] SUPERVISOR INSTRUCTION: TOPIC TRANSITION
> The current topic "${currentTopic.label}" is COMPLETE.
> ${nextTopic ? `You are transitioning to: "${nextTopic.label}"` : 'This is the end of the topic loop.'}
>
> **CRITICAL RULE**: This message will handle the transition in the next turn.
> DO NOT try to transition in this response. Continue with the current topic status.
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
> **ANTI-GENERIC RULE**: DO NOT ask "Is there anything else?", "Anything to add?", or "Tell me more".
> **CONTEXT RULE**: You MUST explicitly reference a specific detail from the user's previous answers. Show that you listened.
> If the user's previous answer was already very detailed on this point, move to a different nuance of "${focus}" or move on.
> DO NOT output [CONCLUDE_INTERVIEW]. Continue probing.
`;
                primaryInstruction = "Probe deeply into the focus point using specific user context.";
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
        const firstSubGoal = nextTopic.subGoals[0] || nextTopic.label;

        const transitionInstruction = phase === 'DEEP'
            ? `
> [!CRITICAL] DEEP DIVE TRANSITION & QUESTION
> We are returning to "${nextTopic.label}" for deeper exploration.
> The user touched on this in SCAN phase - now we probe deeper.
>
> **MANDATORY STRUCTURE**:
> 1. Brief natural transition (1 short sentence acknowledging previous topic)
> 2. IMMEDIATELY ask a specific probing question about "${nextTopic.label}"
>
> **QUESTION REQUIREMENTS**:
> - Must relate to: ${firstSubGoal}
> - Must be specific and contextual (not generic like "what do you think?")
> - Must reference or build on what you learned in SCAN phase if possible
> - MUST end with "?"
>
> Example flow: "Grazie per questi spunti. Tornando a [topic], mi interessa capire [specific aspect]. [Specific question]?"
`
            : `
> [!CRITICAL] SCAN TRANSITION & QUESTION
> Moving from "${currentTopic.label}" to "${nextTopic.label}".
>
> **MANDATORY STRUCTURE**:
> 1. Very brief acknowledgment of previous answer (max 5 words, can be omitted)
> 2. IMMEDIATELY ask the first question about "${nextTopic.label}"
>
> **QUESTION REQUIREMENTS**:
> - Must relate to: ${firstSubGoal}
> - Must be clear and direct
> - NO meta-commentary like "Passiamo a...", "Ora vorrei chiederti..."
> - Just naturally ask the question
> - MUST end with "?"
>
> Example: "Perfetto. Parlando di [topic], [specific question]?"
`;

        return `
## TRANSITION MODE (${phase} PHASE)
Topic: "${currentTopic.label}" → "${nextTopic.label}"

${transitionInstruction}

NEW TOPIC CONTEXT:
${nextTopic.description}
Key Sub-Goals:
${nextTopic.subGoals.map(g => `- ${g}`).join('\n')}

**CRITICAL RULES**:
1. DO NOT explain the transition ("Ora passiamo a...", "Let's move to...")
2. DO NOT ask for permission ("Possiamo parlare di...?", "Va bene se...?")
3. Your response MUST contain a question mark (?) - this is mandatory
4. The question should feel natural and flow from the conversation
5. Be conversational but direct - get to the question quickly
`.trim();
    }

    /**
     * Master Builder: Assembles the full prompt.
     */
    static async build(
        bot: Bot & { knowledgeSources?: KnowledgeSource[], topics: TopicBlock[], rewardConfig?: any },
        conversation: Conversation,
        currentTopic: TopicBlock | null,
        methodologyContent: string,
        effectiveDurationSeconds: number,
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string } | string // Can be a string for custom transition logic
    ): Promise<string> {
        const persona = this.buildPersonaPrompt(bot);
        const methodology = this.buildMethodologyPrompt(methodologyContent, bot.language || 'en');

        // Fetch and format memory context
        let memoryContext = '';
        try {
            const memory = await MemoryManager.get(conversation.id);
            if (memory && memory.factsCollected.length > 0) {
                memoryContext = MemoryManager.formatForPrompt(memory);
            }
        } catch (error) {
            console.error('[PromptBuilder] Memory fetch failed:', error);
        }

        const context = this.buildContextPrompt(conversation, bot, effectiveDurationSeconds);

        let specificPrompt = '';
        if (typeof supervisorInsight === 'string') {
            // Custom instruction override (Transitions etc.)
            specificPrompt = supervisorInsight;
        } else {
            specificPrompt = this.buildTopicPrompt(currentTopic, bot.topics, supervisorInsight, bot);
        }

        return `
${persona}

${methodology}

${memoryContext ? memoryContext + '\n\n' : ''}${context}

${specificPrompt}

---
## FINAL REMINDER (CRITICAL):
- EVERY response MUST end with a question mark (?).
- If you are transitioning, ask the first question of the new topic immediately.
- If you are probe-deepening, ask for a specific detail.
- NEVER end with a statement or a "Thank you" alone. Always follow with "?".
`.trim();
    }
}


import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { buildTopicAnchors } from '@/lib/interview/topic-anchors';
import type { SupervisorInsight } from '@/lib/interview/interview-supervisor';

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
        const knowledgeText = (bot.knowledgeSources || [])
            .slice(0, 3)
            .map((source) => {
                const title = String(source.title || 'Untitled');
                const preview = String(source.content || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 260);
                return `- ${title}: ${preview}${preview.length >= 260 ? '…' : ''}`;
            })
            .join('\n');

        return `
You are an expert qualitative researcher conducting an interview.
role: "Interviewer"
name: "${bot.name}"
mission: "${bot.researchGoal}"
target_audience: "${bot.targetAudience}"
tone: "${bot.tone || 'Friendly, professional, and empathetic'}"
language: "${bot.language || 'en'}"

## YOUR IDENTITY & RELATIONSHIP WITH THE INTERVIEWEE
- You are "${bot.name}", conducting qualitative research.
- The person you are talking to is the **INTERVIEWEE** — someone sharing their experience and opinions.
- DO NOT assume their role (participant, creator, customer, employee) unless the research goal explicitly states it.
- DO NOT say "Your event", "Your project" unless the interview topics specifically cover events/projects the user owns.
- Focus on gathering their honest perspective on the topics configured for this interview.

## KNOWLEDGE BASE
Use this context only as lightweight guidance for question quality. Do not lecture.
${knowledgeText}
`.trim();
    }

    /**
     * 2. Methodology Prompt: Semi-static rules for probing and flow.
     * Loads from system knowledge or hardcoded best practices.
     */
    static buildMethodologyPrompt(methodologyContent: string, language: string = 'en'): string {
        const isItalian = language === 'it';
        const flowExplanation = isItalian ? `
## FLUSSO (COMPATTO)
- SCAN: copri i topic previsti con domande mirate.
- DEEP: approfondisci solo i segnali ad alto valore (esempi, impatti, vincoli).
- DATA_COLLECTION: chiedi consenso e poi campi uno alla volta.
- Chiusura: solo quando il supervisor lo indica.
` : `
## FLOW (COMPACT)
- SCAN: cover planned topics with focused questions.
- DEEP: deepen only high-value signals (examples, impact, constraints).
- DATA_COLLECTION: ask consent, then collect fields one at a time.
- Close only when the supervisor indicates it.
`;

        const fewShot = isItalian ? `
## FEW-SHOT (STILE)
Utente: "Siamo curiosi, ci interessa il rapporto col mercato."
Assistente: "Mi colpisce il focus sul mercato. In quali momenti questo pesa di più nelle vostre decisioni?"

Utente: "Non ho capito, intendi clienti o fornitori?"
Assistente: "Intendo il rapporto con i clienti finali. Quale parte oggi è più difficile da gestire?"
` : `
## FEW-SHOT (STYLE)
User: "We are curious, especially about market relationship."
Assistant: "Your market focus stands out. In which decisions does this matter most today?"

User: "I did not understand, do you mean clients or suppliers?"
Assistant: "I mean end clients. Which part is hardest to manage right now?"
`;

        const operatingPrinciples = isItalian ? `
## PRINCIPI OPERATIVI
1. Mantieni tono naturale e concreto, senza formule rituali.
2. In SCAN/DEEP fai una breve connessione al merito dell'utente e UNA sola domanda.
3. Se emerge un segnale forte (impatto, esempio, vincolo), approfondiscilo prima di cambiare focus.
4. Evita ripetizioni letterali della domanda precedente.
5. No promo/link/CTA; no contatti fuori da DATA_COLLECTION.
` : `
## OPERATING PRINCIPLES
1. Keep the tone natural and concrete, without ritual phrases.
2. In SCAN/DEEP, use a short meaningful bridge and ask ONE question.
3. If a strong signal appears (impact, example, constraint), deepen it before shifting focus.
4. Avoid literal repetition of the previous question.
5. No promo/link/CTA and no contact requests outside DATA_COLLECTION.
`;

        return `
## INTERVIEW METHODOLOGY
${methodologyContent.substring(0, 700)}

${flowExplanation}

${operatingPrinciples}

${fewShot}
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
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');
        const maxMins = bot.maxDurationMins || 10;
        const elapsedMins = Math.floor(effectiveDurationSeconds / 60);
        const remainingMins = maxMins - elapsedMins;

        // Pacing Calculation
        const allTopics = bot.topics || [];
        const currentTopicIndex = allTopics.findIndex(t => t.id === conversation.currentTopicId);
        const topicsRemaining = allTopics.length - (currentTopicIndex + 1);

        // Are we behind schedule?
        // Ideal progress: (currentTopicIndex / totalTopics) should match (elapsed / max)
        const idealTopicIndex = Math.floor((elapsedMins / maxMins) * allTopics.length);
        const isBehind = currentTopicIndex < idealTopicIndex;
        const isCriticalTime = remainingMins <= (topicsRemaining * 2); // Less than 2 mins per remaining topic

        // Reward Logic (not surfaced during interviews to avoid promo/CTA)
        const rewardText = isItalian ? `STATO REWARD: NONE.` : `REWARD STATUS: NONE.`;

        // Status Logic - SIMPLIFIED to avoid contradicting SUPERVISOR
        // The SUPERVISOR in route.ts controls the actual flow - this is just informational context
        let statusInstruction = "";

        if (remainingMins <= 0) {
            statusInstruction = isItalian
                ? `STATO: TEMPO_ESAURITO. Segui il supervisor per il prossimo passo.`
                : `STATUS: TIME_BUDGET_REACHED. Follow supervisor guidance for the next step.`;
        } else if (remainingMins < 2) {
            statusInstruction = isItalian
                ? `STATO: TEMPO_BASSO. Restano ${remainingMins} min. Mantieni domande focalizzate.`
                : `STATUS: LOW_TIME. ${remainingMins} mins left. Keep questions focused.`;
        } else if (isBehind || isCriticalTime) {
            statusInstruction = isItalian
                ? `STATO: IN_RITARDO. ${remainingMins} min per ${topicsRemaining} topic.`
                : `STATUS: BEHIND_SCHEDULE. ${remainingMins}m left for ${topicsRemaining} topics.`;
        } else {
            statusInstruction = isItalian
                ? `STATO: IN_LINEA. Restano ${remainingMins} min.`
                : `STATUS: ON_TRACK. ${remainingMins}m left.`;
        }

        // NOTE: Data collection guardrail REMOVED from context prompt.
        // The SUPERVISOR in route.ts handles this via phase transitions.
        // Having it here caused contradictions (telling bot to ask for contacts while in SCAN/DEEP)

        return isItalian ? `
## CONTESTO TEMPO
Trascorso: ${elapsedMins}m / Budget: ${maxMins}m
Topic corrente: ${currentTopicIndex + 1}/${allTopics.length}
${rewardText}
${statusInstruction}
`.trim() : `
## TIMING CONTEXT
Elapsed: ${elapsedMins}m / Budget: ${maxMins}m
Current topic: ${currentTopicIndex + 1}/${allTopics.length}
${rewardText}
${statusInstruction}
`.trim();
    }

    static buildPlanSummary(
        bot: Bot & { topics: TopicBlock[] },
        interviewPlan?: any
    ): string {
        if (!interviewPlan) return '';
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');
        const topics = [...(bot.topics || [])].sort((a, b) => a.orderIndex - b.orderIndex);
        const scanMap = new Map<string, any>((interviewPlan.scan?.topics || []).map((t: any) => [t.topicId, t]));
        const deepMap = new Map<string, any>((interviewPlan.deep?.topics || []).map((t: any) => [t.topicId, t]));

        const topicLines = topics.map((t, idx) => {
            const scan = scanMap.get(t.id) as { maxTurns?: number } | undefined;
            const deep = deepMap.get(t.id) as { maxTurns?: number } | undefined;
            const scanTurns = scan?.maxTurns ?? 1;
            const deepTurns = deep?.maxTurns ?? interviewPlan.deep?.maxTurnsPerTopic ?? 1;
            const subGoals = (t.subGoals || []).join(' | ') || 'N/A';
            return isItalian
                ? `${idx + 1}. ${t.label} | scan: ${scanTurns} turni | deep: ${deepTurns} turni | sub-goal: ${subGoals}`
                : `${idx + 1}. ${t.label} | scan: ${scanTurns} turns | deep: ${deepTurns} turns | sub-goals: ${subGoals}`;
        }).join('\n');

        return isItalian ? `
## PIANO INTERVISTA (SINTESI)
- Flusso: SCAN topic -> DEEP segnali rilevanti -> DATA_COLLECTION (se prevista)
- In SCAN/DEEP evita chiusura e raccolta contatti
- Una domanda per turno
Topic:
${topicLines}
`.trim() : `
## INTERVIEW PLAN (SUMMARY)
- Flow: SCAN topics -> DEEP high-value signals -> DATA_COLLECTION (if enabled)
- In SCAN/DEEP avoid closure and contact collection
- One question per turn
Topics:
${topicLines}
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
        supervisorInsight?: SupervisorInsight,
        bot?: any // Added for language access and fields
    ): string {
        const lang = String(bot?.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en';
        const isItalian = lang === 'it';

        if (!currentTopic) {
            return isItalian
                ? `## STATO INTERVISTA\nSiamo in chiusura/transizione. Ringrazia e segui il supervisor per il passo finale.`
                : `## INTERVIEW STATE\nWe are in closure/transition. Thank the user and follow supervisor guidance for the final step.`;
        }

        const topicIndex = allTopics.findIndex((topic) => topic.id === currentTopic.id);
        const progress = `${topicIndex + 1}/${allTopics.length}`;
        const subGoals = (currentTopic.subGoals || []).filter(Boolean);
        const subGoalPreview = subGoals.slice(0, 4).join(' | ') || (isItalian ? 'N/A' : 'N/A');
        const anchorData = buildTopicAnchors(currentTopic, lang);
        const anchorList = anchorData.anchors.slice(0, 4).join(', ');

        const status = supervisorInsight?.status;
        if (status === 'DEEP_OFFER_ASK') {
            const extensionPreview = supervisorInsight?.extensionPreview;
            const preview = Array.isArray(extensionPreview)
                ? extensionPreview.map((value) => String(value || '').trim()).filter(Boolean)[0] || ''
                : '';
            return isItalian
                ? `
## FASE: OFFERTA ESTENSIONE
- Tempo previsto quasi concluso.
- Offri la scelta di continuare per pochi minuti.
- Mantieni tono naturale, una sola domanda yes/no.
${preview ? `Spunto iniziale suggerito: ${preview}` : ''}
- Non chiedere contatti e non porre domande di topic in questo messaggio.
`.trim()
                : `
## PHASE: EXTENSION OFFER
- Planned time is almost over.
- Offer the option to continue for a few minutes.
- Keep a natural tone and ask one yes/no question.
${preview ? `Suggested starting point: ${preview}` : ''}
- Do not ask contacts and do not ask topic questions in this message.
`.trim();
        }

        if (status === 'START_DEEP') {
            const focusTopic = supervisorInsight?.focusPoint || currentTopic.label;
            const engagingSnippet = String(supervisorInsight?.engagingSnippet || '').trim();
            return isItalian
                ? `
## FASE: INIZIO DEEP
Rientriamo in profondita partendo da "${focusTopic}".
${engagingSnippet ? `Dettaglio da valorizzare: "${engagingSnippet}"` : ''}
Fai una transizione breve e una domanda di approfondimento concreta.
`.trim()
                : `
## PHASE: START DEEP
Resume deep exploration from "${focusTopic}".
${engagingSnippet ? `Detail to leverage: "${engagingSnippet}"` : ''}
Use a short transition and ask one concrete deepening question.
`.trim();
        }

        if (status === 'DATA_COLLECTION_CONSENT') {
            return isItalian
                ? `
## FASE: CONSENSO DATI
La parte contenutistica e conclusa.
Ringrazia brevemente e chiedi se puoi raccogliere i contatti per follow-up.
Una sola domanda, nessuna domanda di topic.
`.trim()
                : `
## PHASE: DATA CONSENT
The content interview is complete.
Thank briefly and ask permission to collect contact details for follow-up.
One question only, no topic questions.
`.trim();
        }

        if (status === 'COMPLETE_WITHOUT_DATA') {
            return isItalian
                ? `## FASE: CONCLUSIONE\nChiudi con ringraziamento e saluto. Nessuna domanda. Aggiungi INTERVIEW_COMPLETED.`
                : `## PHASE: COMPLETION\nClose with thanks and goodbye. No question. Append INTERVIEW_COMPLETED.`;
        }

        if (status === 'FINAL_GOODBYE') {
            return isItalian
                ? `## FASE: SALUTO FINALE\nChiudi cordialmente e conferma che sarete in contatto. Aggiungi INTERVIEW_COMPLETED.`
                : `## PHASE: FINAL GOODBYE\nClose politely and confirm follow-up. Append INTERVIEW_COMPLETED.`;
        }

        if (status === 'CONFIRM_STOP') {
            return isItalian
                ? `## FASE: CONFERMA CHIUSURA\nRiconosci la possibile stanchezza e chiedi se preferisce chiudere ora o continuare.`
                : `## PHASE: STOP CONFIRMATION\nAcknowledge possible fatigue and ask whether to stop now or continue.`;
        }

        if (status === 'DATA_COLLECTION') {
            const rawFields = (bot?.candidateDataFields as any[]) || ['name', 'email'];
            const fieldIds = rawFields.map((value: any) => typeof value === 'string' ? value : (value.id || value.field));
            const formattedChecklist = fieldIds.map((id) => {
                const label = FIELD_LABELS[id];
                return label ? (isItalian ? label.it : label.en) : String(id);
            }).join(', ');
            const priorityField = String(supervisorInsight?.nextSubGoal || '').trim();

            return isItalian
                ? `
## FASE: RACCOLTA DATI
Campi configurati: ${formattedChecklist}
Raccogli un campo per volta, partendo dal primo mancante.
${priorityField ? `Priorita corrente: ${priorityField}.` : ''}
Non dedurre il nome dall'email. Nessun saluto finale finche mancano campi.
Quando i campi sono completi, chiudi e aggiungi INTERVIEW_COMPLETED.
`.trim()
                : `
## PHASE: DATA COLLECTION
Configured fields: ${formattedChecklist}
Collect one field at a time, starting from the first missing one.
${priorityField ? `Current priority: ${priorityField}.` : ''}
Never infer name from email. No final goodbye until all fields are complete.
When fields are complete, close and append INTERVIEW_COMPLETED.
`.trim();
        }

        let phaseGuidance = '';
        if (status === 'TRANSITION') {
            const nextTopic = allTopics[topicIndex + 1];
            const nextTopicLabel = supervisorInsight?.nextTopic || nextTopic?.label || currentTopic.label;
            const focus = supervisorInsight?.nextSubGoal || nextTopic?.subGoals?.[0] || nextTopicLabel;
            phaseGuidance = isItalian
                ? `Stai passando al topic "${nextTopicLabel}". Fai un passaggio breve naturale e una domanda su "${focus}".`
                : `You are moving to topic "${nextTopicLabel}". Use a short natural bridge and ask one question on "${focus}".`;
        } else if (status === 'DEEPENING') {
            const focus = supervisorInsight?.focusPoint || currentTopic.label;
            phaseGuidance = isItalian
                ? `Approfondisci "${focus}" con una domanda specifica (esempio, impatto o vincolo).`
                : `Deepen "${focus}" with one specific question (example, impact, or constraint).`;
        } else {
            const focus = supervisorInsight?.nextSubGoal || subGoals[0] || currentTopic.label;
            phaseGuidance = isItalian
                ? `Rimani sul topic corrente e copri il focus "${focus}" in modo conversazionale.`
                : `Stay on the current topic and cover focus "${focus}" in a conversational way.`;
        }

        const baseRules = isItalian ? `
## REGOLE BASE
- Una sola domanda per turno.
- Nessuna chiusura e nessun contatto in SCAN/DEEP.
- Evita formule generiche; agganciati a un dettaglio concreto.
` : `
## BASE RULES
- One question per turn.
- No closure and no contact requests in SCAN/DEEP.
- Avoid generic openers; anchor on one concrete user detail.
`;

        const anchorSection = anchorList
            ? (isItalian
                ? `Ancore topic utili: ${anchorList}.`
                : `Useful topic anchors: ${anchorList}.`)
            : '';

        return `
## TOPIC CONTEXT
Topic: ${currentTopic.label} (${progress})
Description: ${currentTopic.description || (isItalian ? 'N/A' : 'N/A')}
Sub-goals: ${subGoalPreview}

${phaseGuidance}
${anchorSection}

${baseRules}
`.trim();
    }

    /**
     * 5. Transition Prompt:
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
> ** MANDATORY STRUCTURE **:
> 1. Brief natural transition(1 short sentence acknowledging previous topic)
            > 2. IMMEDIATELY ask a specific probing question about "${nextTopic.label}"
                >
> ** QUESTION REQUIREMENTS **:
> - Must relate to: ${firstSubGoal}
> - Must be specific and contextual(not generic like "what do you think?")
            > - Must reference or build on what you learned in SCAN phase if possible
                > - MUST end with "?"
                >
> Example flow: "Grazie per questi spunti. Tornando a [topic], mi interessa capire [specific aspect]. [Specific question]?"
            `
            : `
            > [!CRITICAL] SCAN TRANSITION & QUESTION
                > Moving from "${currentTopic.label}" to "${nextTopic.label}".
>
> ** MANDATORY STRUCTURE **:
> 1. Very brief acknowledgment of previous answer(max 5 words, can be omitted)
            > 2. IMMEDIATELY ask the first question about "${nextTopic.label}"
                >
> ** QUESTION REQUIREMENTS **:
> - Must relate to: ${firstSubGoal}
> - Must be clear and direct
            > - NO meta - commentary like "Passiamo a...", "Ora vorrei chiederti..."
                > - Just naturally ask the question
                    > - MUST end with "?"
                    >
> Example: "Perfetto. Parlando di [topic], [specific question]?"
            `;

        return `
## TRANSITION MODE(${phase} PHASE)
        Topic: "${currentTopic.label}" → "${nextTopic.label}"

${transitionInstruction}

NEW TOPIC CONTEXT:
${nextTopic.description}
Key Sub - Goals:
${nextTopic.subGoals.map(g => `- ${g}`).join('\n')}

** CRITICAL RULES **:
        1. DO NOT explain the transition("Ora passiamo a...", "Let's move to...")
        2. DO NOT ask for permission("Possiamo parlare di...?", "Va bene se...?")
3. Your response MUST contain a question mark(?) - this is mandatory
        4. The question should feel natural and flow from the conversation
        5. Be conversational but direct - get to the question quickly
            `.trim();
    }

    /**
     * 6. Bridge Prompt (Scan -> Deep):
     * Explicit instruction to bridge the gap between phases.
     */
    static buildBridgePrompt(firstTopic: TopicBlock, language: string = 'en'): string {
        const isItalian = language === 'it';
        return isItalian ? `
## TRANSIZIONE ALLA FASE DEEP DIVE(APPROFONDIMENTO)
Abbiamo completato la panoramica generale(Scanning).
Ora ripartiamo dal primo tema: "${firstTopic.label}".

** ISTRUZIONI PER L'INTERVISTATORE**:
        1. Spiega chiaramente all'utente: "Abbiamo finito la panoramica veloce. Ora vorrei tornare su alcuni punti interessanti che hai menzionato per andare più a fondo."
        2. Inizia col primo tema: "${firstTopic.label}".
3. ** REGOLA D'ORO**: Cita un dettaglio specifico che l'utente ha detto prima riguardo a questo tema.Mostra di aver memorizzato le sue risposte precedenti.
4. Chiedi di approfondire quel dettaglio specifico.
` : `
## TRANSITION TO DEEP DIVE PHASE
We have finished the general overview(Scanning).
Now we restart from the first topic: "${firstTopic.label}".

** INSTRUCTIONS FOR THE INTERVIEWER **:
        1. Explicitly state to the user: "We've finished the quick overview. Now I'd like to revisit a few interesting points you mentioned earlier to explore them in more depth."
        2. Start with the first topic: "${firstTopic.label}".
3. ** GOLDEN RULE **: Quote a specific detail the user mentioned earlier regarding this topic.Show that you remembered their previous answers.
4. Ask to delve deeper into that specific detail.
`;
    }

    /**
     * 7. Soft Offer Prompt (End -> Data Collection):
     * Polite transition to ask for contact details.
     */
    static buildSoftOfferPrompt(language: string = 'en'): string {
        const isItalian = language === 'it';

        return isItalian ? `
## TRANSIZIONE CRITICA: RICHIESTA DATI DI CONTATTO
Il tempo / turni dell'intervista sono esauriti o i temi sono completati.

            ** ISTRUZIONI OBBLIGATORIE **:
        1. ** RINGRAZIAMENTO **: Ringrazia sinceramente per il tempo dedicato
        2. ** COMUNICAZIONE CHIARA **: Spiega che l'intervista è conclusa
        3. ** RICHIESTA DIRETTA E CORDIALE **: Chiedi i dati di contatto in modo diretto ma amichevole
            - SPIEGA IL PERCHÉ: "per poterti ricontattare/per restare in contatto"
        4. ** ASPETTA CONFERMA **: Attendi che l'utente confermi prima di chiedere campi specifici

            ** DIVIETI ASSOLUTI(CRITICO) **:
- ** NON chiedere "Come ti chiami?" in questo messaggio.**
- ** NON chiedere email o telefono in questo messaggio.**
- ** CHIEDI SOLO IL PERMESSO.**

** STRUTTURA ESEMPIO **:
        "[Nome], ti ringrazio molto per il tempo che hai dedicato a questa conversazione. Siamo arrivati alla conclusione, ma vorrei davvero restare in contatto con te. Posso chiederti i tuoi dati di contatto?"
            ` : `
## CRITICAL TRANSITION: REQUEST CONTACT DATA
Interview time / turns limit reached or topics completed.

** MANDATORY INSTRUCTIONS **:
        1. ** THANK YOU **: Sincerely thank them for their time
2. ** CLEAR COMMUNICATION **: Explain the interview concluded
        3. ** DIRECT & FRIENDLY REQUEST **: Ask for contact details directly but warmly
            - EXPLAIN WHY: "so we can follow up/stay in touch"
        4. ** WAIT FOR CONFIRMATION **: Wait for user to confirm before asking specific fields

            ** ABSOLUTE PROHIBITIONS(CRITICAL) **:
- ** DO NOT ask "What is your name?" in this message.**
- ** DO NOT ask for email or phone in this message.**
- ** ONLY ASK FOR PERMISSION.**

** EXAMPLE STRUCTURE **:
        "[Name], thank you so much for the time you've dedicated to this conversation. We've reached the end, but I'd really like to stay in touch with you. May I ask for your contact details?"
            `;
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
        supervisorInsight?: SupervisorInsight | string,
        interviewPlan?: any
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
        const planSummary = this.buildPlanSummary(bot, interviewPlan);
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');

        let specificPrompt = '';
        if (typeof supervisorInsight === 'string') {
            // Custom instruction override (Transitions etc.)
            specificPrompt = supervisorInsight;
        } else {
            specificPrompt = this.buildTopicPrompt(currentTopic, bot.topics, supervisorInsight, bot);
        }

        const finalReminder = isItalian
            ? `
## PROMEMORIA FINALE
- Se sei in fase attiva: una sola domanda per turno.
- Se il supervisor indica chiusura: chiudi senza domanda e usa INTERVIEW_COMPLETED.
`
            : `
## FINAL REMINDER
- In active phases: ask one question per turn.
- If supervisor indicates closure: close without a question and append INTERVIEW_COMPLETED.
`;

        return `
${persona}

${methodology}

${memoryContext ? memoryContext + '\n\n' : ''}${context}

${planSummary}

${specificPrompt}

${finalReminder}
`.trim();
    }
}

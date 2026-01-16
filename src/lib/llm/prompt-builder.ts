
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

        const flowExplanation = language === 'it' ? `
## FLUSSO DELL'INTERVISTA (LEGGI ATTENTAMENTE)
L'intervista segue un flusso RIGIDO. Tu NON decidi quando passare alla fase successiva - lo fa il SUPERVISOR.

**FASE 1: SCAN** (Panoramica veloce) - OBBLIGATORIA
- Esplori TUTTI i topic con 2-3 domande ciascuno
- Obiettivo: capire le opinioni generali dell'utente su ogni tema
- ⛔ NON chiedere contatti. NON concludere. NON dire "prima di salutarci".

**FASE 2: DEEP** (Approfondimento) - DURATA VARIABILE
- Alla fine dello SCAN, il sistema calcola quanto tempo resta e lo distribuisce equamente tra TUTTI i topic
- **STRUTTURA**: Si ritorna su OGNI topic già esplorato, uno alla volta, per approfondirlo
- **OBIETTIVO DEL DEEP** (per ogni topic):
  1. **Chiarire risposte interessanti**: Se l'utente ha detto qualcosa di significativo in SCAN su questo topic, approfondiscilo ("Hai menzionato X, puoi spiegarmi meglio...?")
  2. **Esplorare sub-goal mancanti**: Se alcuni sub-goal del topic NON sono stati toccati in SCAN, affrontali ora
  3. **Variare gli argomenti**: Non ripetere le stesse domande di SCAN - esplora angoli diversi, chiedi esempi concreti, implicazioni pratiche
- **TRANSIZIONI**: Il SUPERVISOR ti dirà quando passare al topic successivo (status: TRANSITION)
- **NON ANTICIPARE**: Non decidere tu quando cambiare topic. Continua ad approfondire finché il SUPERVISOR non ti dice TRANSITION
- ⛔ NON chiedere contatti. NON concludere. NON dire "abbiamo finito".

**FASE 3: DATA_COLLECTION** (Raccolta dati) - OPZIONALE
- Questa fase SI ATTIVA SOLO SE configurata per questa intervista
- Il SUPERVISOR ti dirà esplicitamente quando inizia
- Prima chiedi il PERMESSO, poi i campi UNO ALLA VOLTA
- ✅ SOLO quando il SUPERVISOR dice "DATA_COLLECTION" puoi chiedere dati personali

**CHIUSURA**
- Puoi salutare SOLO quando il SUPERVISOR autorizza la chiusura
- Se c'è DATA_COLLECTION: solo dopo aver raccolto TUTTI i campi
- Se NON c'è DATA_COLLECTION: il SUPERVISOR ti dirà quando concludere

⚠️ **REGOLA D'ORO**: Finché sei in SCAN o DEEP, il tuo UNICO compito è fare domande sui topic.
NON anticipare mai le fasi successive. Il SUPERVISOR ti guida passo passo.
` : `
## INTERVIEW FLOW (READ CAREFULLY)
The interview follows a STRICT flow. YOU do not decide when to move to the next phase - the SUPERVISOR does.

**PHASE 1: SCAN** (Quick Overview) - MANDATORY
- Explore ALL topics with 2-3 questions each
- Goal: understand the user's general opinions on each theme
- ⛔ DO NOT ask for contacts. DO NOT conclude. DO NOT say "before we wrap up".

**PHASE 2: DEEP** (Deep Dive) - VARIABLE DURATION
- At the end of SCAN, the system calculates remaining time and distributes it equally among ALL topics
- **STRUCTURE**: We return to EACH topic already explored, one at a time, for deeper probing
- **DEEP OBJECTIVES** (for each topic):
  1. **Clarify interesting responses**: If the user said something significant in SCAN about this topic, probe deeper ("You mentioned X, can you explain more...?")
  2. **Explore missing sub-goals**: If some sub-goals of the topic were NOT covered in SCAN, address them now
  3. **Vary the angles**: Don't repeat the same questions from SCAN - explore different angles, ask for concrete examples, practical implications
- **TRANSITIONS**: The SUPERVISOR will tell you when to move to the next topic (status: TRANSITION)
- **DON'T ANTICIPATE**: Don't decide when to change topics yourself. Keep probing until the SUPERVISOR says TRANSITION
- ⛔ DO NOT ask for contacts. DO NOT conclude. DO NOT say "we're done".

**PHASE 3: DATA_COLLECTION** (Data Collection) - OPTIONAL
- This phase ONLY ACTIVATES IF configured for this interview
- The SUPERVISOR will explicitly tell you when it starts
- First ask for PERMISSION, then fields ONE AT A TIME
- ✅ ONLY when SUPERVISOR says "DATA_COLLECTION" can you ask for personal data

**CLOSURE**
- You can say goodbye ONLY when the SUPERVISOR authorizes closure
- If DATA_COLLECTION exists: only after collecting ALL fields
- If NO DATA_COLLECTION: the SUPERVISOR will tell you when to conclude

⚠️ **GOLDEN RULE**: While in SCAN or DEEP, your ONLY job is to ask questions about topics.
NEVER anticipate the next phases. The SUPERVISOR guides you step by step.
`;

        return `
## INTERVIEW METHODOLOGY
${methodologyContent.substring(0, 2000)}

${flowExplanation}

## RULES OF ENGAGEMENT
1. **Neutrality**: Never judge. Never agree or disagree excessively. Use neutral acknowledgments ("I see", "Thanks for sharing").
2. **ONE QUESTION RULE (CRITICAL - ABSOLUTE)**:
   - Ask EXACTLY ONE question per message. NO EXCEPTIONS.
   - Your message must contain ONLY ONE question mark (?).
   - NEVER combine two questions in the same message.
   - NEVER ask a content question AND a permission question together.
   - BAD: "Quali implicazioni vedi? Posso chiederti i contatti?" (TWO questions = FORBIDDEN)
   - GOOD: "Posso chiederti i contatti per restare in contatto?" (ONE question = CORRECT)
   - If transitioning phases, ONLY ask the transition question, nothing else.
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

        // Status Logic - SIMPLIFIED to avoid contradicting SUPERVISOR
        // The SUPERVISOR in route.ts controls the actual flow - this is just informational context
        let statusInstruction = "";

        if (remainingMins <= 0) {
            statusInstruction = `STATUS: TIME_BUDGET_REACHED. The SUPERVISOR will guide you on what to do next.`;
        } else if (remainingMins < 2) {
            statusInstruction = `STATUS: LOW_TIME. ${remainingMins} mins left. Follow SUPERVISOR instructions.`;
        } else if (isBehind || isCriticalTime) {
            statusInstruction = `STATUS: BEHIND_SCHEDULE. ${remainingMins}m left for ${topicsRemaining} topics. Keep questions focused.`;
        } else {
            statusInstruction = `STATUS: ON_TRACK. ${remainingMins}m left. You can explore topics thoroughly.`;
        }

        // NOTE: Data collection guardrail REMOVED from context prompt.
        // The SUPERVISOR in route.ts handles this via phase transitions.
        // Having it here caused contradictions (telling bot to ask for contacts while in SCAN/DEEP)

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

            // ========== DEEP_OFFER_ASK ==========
            // Time is running low - offer user to continue with deeper questions
            if (supervisorInsight.status === 'DEEP_OFFER_ASK') {
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const offerPrompt = isItalian ? `
## FASE: OFFERTA APPROFONDIMENTO
Il tempo previsto per l'intervista sta per terminare, ma abbiamo ancora qualche domanda di approfondimento.

**ISTRUZIONI**:
1. Ringrazia brevemente l'utente per le risposte finora
2. Spiega che il tempo indicativo è quasi finito
3. Offri la possibilità di continuare con alcune domande extra di approfondimento
4. Attendi la risposta dell'utente

**ESEMPIO**:
"Grazie mille per queste risposte interessanti! Il tempo che avevamo previsto sta per terminare, ma se hai ancora qualche minuto, avrei alcune domande di approfondimento che mi piacerebbe farti. Ti va di continuare?"

**DIVIETI**:
- NON chiedere dati di contatto ora
- NON fare altre domande sui topic
- SOLO offri la scelta di continuare o meno
` : `
## PHASE: DEEP DIVE OFFER
The scheduled interview time is almost up, but we have some deeper follow-up questions.

**INSTRUCTIONS**:
1. Briefly thank the user for their answers so far
2. Explain that the expected time is almost up
3. Offer the opportunity to continue with a few extra deep-dive questions
4. Wait for user's response

**EXAMPLE**:
"Thank you so much for these insightful answers! Our scheduled time is almost up, but if you have a few more minutes, I'd love to ask some deeper follow-up questions. Would you like to continue?"

**PROHIBITIONS**:
- DO NOT ask for contact details now
- DO NOT ask other topic questions
- ONLY offer the choice to continue or not
`;
                return offerPrompt.trim();
            }

            // ========== START_DEEP ==========
            // Transitioning to DEEP phase after SCAN is complete
            if (supervisorInsight.status === 'START_DEEP') {
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';
                const focusTopic = supervisorInsight.focusPoint || allTopics[0]?.label || 'the first topic';

                const startDeepPrompt = isItalian ? `
## FASE: INIZIO APPROFONDIMENTO (DEEP)
Abbiamo completato la panoramica generale di tutti i temi.
Ora approfondiamo alcuni punti interessanti, partendo da: "${focusTopic}".

**ISTRUZIONI**:
1. Fai una breve transizione naturale ("Grazie per questa panoramica. Ora vorrei approfondire alcuni punti...")
2. Torna al tema "${focusTopic}" e fai una domanda specifica di approfondimento
3. Cita un dettaglio specifico che l'utente ha menzionato prima su questo tema
4. La domanda deve essere SPECIFICA, non generica

**ESEMPIO**:
"Grazie per questi spunti! Tornando a ${focusTopic}, hai menzionato [dettaglio specifico]. Puoi dirmi di più su [aspetto specifico]?"

**DIVIETI**:
- NON chiedere "c'è altro da aggiungere?"
- NON fare domande generiche
- NON ripetere domande già fatte in SCAN
` : `
## PHASE: START DEEP DIVE
We have completed the general overview of all topics.
Now we dive deeper into interesting points, starting with: "${focusTopic}".

**INSTRUCTIONS**:
1. Make a brief natural transition ("Thanks for this overview. Now I'd like to explore some points more deeply...")
2. Return to "${focusTopic}" and ask a specific follow-up question
3. Reference a specific detail the user mentioned before about this topic
4. The question must be SPECIFIC, not generic

**EXAMPLE**:
"Thank you for these insights! Going back to ${focusTopic}, you mentioned [specific detail]. Can you tell me more about [specific aspect]?"

**PROHIBITIONS**:
- DO NOT ask "is there anything else to add?"
- DO NOT ask generic questions
- DO NOT repeat questions already asked in SCAN
`;
                return startDeepPrompt.trim();
            }

            // ========== DATA_COLLECTION_CONSENT ==========
            // Ask for permission to collect contact data
            if (supervisorInsight.status === 'DATA_COLLECTION_CONSENT') {
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const consentPrompt = isItalian ? `
## FASE: RICHIESTA CONSENSO DATI
L'intervista sui contenuti è completata.
Ora devi chiedere il PERMESSO di raccogliere i dati di contatto.

**REGOLA CRITICA - UNA SOLA DOMANDA**:
Il tuo messaggio deve contenere ESATTAMENTE UN PUNTO INTERROGATIVO.
NON fare domande sui contenuti dell'intervista. L'intervista è FINITA.

**ISTRUZIONI**:
1. Ringrazia sinceramente l'utente per il tempo e le risposte
2. Spiega che l'intervista è conclusa
3. Chiedi il PERMESSO di raccogliere i dati di contatto
4. Spiega brevemente PERCHÉ (per restare in contatto / per follow-up)

**STRUTTURA ESEMPIO**:
"Ti ringrazio molto per questa conversazione, è stata davvero interessante! Siamo arrivati alla fine. Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?"

**DIVIETI ASSOLUTI**:
- NON fare domande sui topic dell'intervista (es. "Quali implicazioni vedi?")
- NON chiedere "Come ti chiami?" in questo messaggio
- NON chiedere email, telefono o altri campi specifici
- NON fare DUE domande nello stesso messaggio
- CHIEDI SOLO IL PERMESSO per i contatti
- Attendi la conferma dell'utente prima di procedere

**ESEMPIO SBAGLIATO** (DUE DOMANDE - VIETATO):
"Quali implicazioni vedi per la formazione? Prima di concludere, posso chiederti i contatti?"

**ESEMPIO CORRETTO** (UNA DOMANDA):
"Grazie mille per tutti questi spunti interessanti! Siamo arrivati alla fine dell'intervista. Posso chiederti i tuoi contatti per restare in contatto?"
` : `
## PHASE: DATA COLLECTION CONSENT
The content interview is complete.
Now you must ask for PERMISSION to collect contact data.

**CRITICAL RULE - ONE QUESTION ONLY**:
Your message must contain EXACTLY ONE question mark.
DO NOT ask questions about interview content. The interview is OVER.

**INSTRUCTIONS**:
1. Sincerely thank the user for their time and answers
2. Explain that the interview is concluded
3. Ask for PERMISSION to collect contact details
4. Briefly explain WHY (to stay in touch / for follow-up)

**EXAMPLE STRUCTURE**:
"Thank you so much for this conversation, it was really insightful! We've reached the end. Before we say goodbye, may I ask for your contact details so we can stay in touch?"

**ABSOLUTE PROHIBITIONS**:
- DO NOT ask questions about interview topics (e.g., "What implications do you see?")
- DO NOT ask "What is your name?" in this message
- DO NOT ask for email, phone or other specific fields
- DO NOT ask TWO questions in the same message
- ONLY ASK FOR PERMISSION for contact details
- Wait for user confirmation before proceeding

**BAD EXAMPLE** (TWO QUESTIONS - FORBIDDEN):
"What implications do you see for training? Before we wrap up, may I ask for your contact details?"

**CORRECT EXAMPLE** (ONE QUESTION):
"Thank you so much for all these interesting insights! We've reached the end of the interview. May I ask for your contact details to stay in touch?"
`;
                return consentPrompt.trim();
            }

            // ========== DATA_COLLECTION ==========
            if (supervisorInsight.status === 'DATA_COLLECTION') {
                // RECRUITER MODE - DYNAMIC FIELDS
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const rawFields = (bot?.candidateDataFields as any[]) || ['name', 'email'];
                const fieldIds = rawFields.map((f: any) => typeof f === 'string' ? f : f.field);
                console.log("📝 [PromptBuilder] Configured Fields:", fieldIds);
                const formattedChecklist = fieldIds.map(id => {
                    const label = FIELD_LABELS[id];
                    const txt = label ? (isItalian ? label.it : label.en) : id;
                    return `- [ ] ${txt.toUpperCase()}`;
                }).join('\n');

                const instructions = isItalian ? `
## FASE: RACCOLTA DATI (CONTATTI)
L'utente ha ACCETTATO di lasciare i propri dati di contatto.

**CHECKLIST DATI DA RACCOGLIERE**:
${formattedChecklist}

**REGOLA D'ORO ASSOLUTA**: Chiedi i dati UNO ALLA VOLTA. Mai più di un campo per volta.
**CONTROLLA LA CRONOLOGIA**: Prima di chiedere, verifica quali dati l'utente ha GIÀ fornito nei messaggi precedenti.

**PROCESSO PASSO-PASSO**:
1. **ANALISI**: Guarda la chat. Quali voci della CHECKLIST qui sopra mancano?
${supervisorInsight.nextSubGoal ? `2. **OBIETTIVO PRIORITARIO**: Il campo mancante identificato dal sistema è: **${supervisorInsight.nextSubGoal.toUpperCase()}**. Concentrati su questo.` : '2. **NEXT FIELD**: Chiedi la PRIMA voce della checklist non ancora spuntata nella tua mente.'}
3. **IMMEDIATO**: Se l'utente ha appena detto "Sì/Ok", NON chiedere "Quale contatto preferisci?". Chiedi SUBITO la prima voce mancante.
4. **CONFERMA E NEXT**: Quando l'utente risponde, conferma brevemente e chiedi il SUCCESSIVO.
5. **RIPETI**: Continua finché hai spuntato TUTTA la checklist.

**ESEMPI DOPO CONSENSO ("sì", "ok", "va bene")**:
❌ SBAGLIATO: "Perfetto, puoi fornirmi le informazioni di contatto che preferisci?"
❌ SBAGLIATO: "Ottimo! Che tipo di dati vuoi condividere?"
✅ CORRETTO: "Perfetto! Come ti chiami?"
✅ CORRETTO: "Benissimo. Qual è il tuo nome?"

**ESEMPI**:
- Se mancano tutti -> Chiedi il primo (es. Nome).
- Se hai il Nome -> Chiedi la Email.
- Se hai Nome ed Email -> Chiedi il Telefono (se presente in lista).

**IMPORTANTISSIMO**:
- NON elencare tutti i campi richiesti ("Ti chiederò nome, email e telefono...")
- NON chiedere due campi insieme ("Qual è il tuo nome e email?")
- Se l'utente fornisce più dati insieme, ringraziali e chiedi il campo successivo mancante
- **DIVIETO ASSOLUTO**: NON usare MAI un nome estratto dall'email. Se l'email è "mario.rossi@example.com", NON chiamare l'utente "Mario" o "Mario Rossi". Il nome deve essere chiesto ESPLICITAMENTE.
- Se l'utente fornisce solo l'email, devi SEMPRE chiedere "Come ti chiami?" se il nome è nella checklist.
- NON SALUTARE finché non hai TUTTI i campi della checklist.
- Se l'utente rifiuta esplicitamente → termina con "INTERVIEW_COMPLETED"

**DIVIETO SALUTI PREMATURI**:
- NON dire "Buona giornata", "A presto", "Grazie, ci sentiamo" FINCHÉ non hai raccolto TUTTI i campi.
- Se manca anche UN SOLO campo della checklist, DEVI continuare a chiedere.

**CHIUSURA**: SOLO quando hai ricevuto TUTTI i campi della lista, ringrazia e scrivi: "INTERVIEW_COMPLETED"
` : `
## PHASE: DATA COLLECTION (CONTACTS)
The user has AGREED to leave their contact details.

**DATA CHECKLIST TO COMPLETE**:
${formattedChecklist}

**ABSOLUTE GOLDEN RULE**: Ask for details ONE AT A TIME. Never more than one field per turn.
**CHECK HISTORY**: Before asking, verify which fields the user has ALREADY provided.

**STEP-BY-STEP PROCESS**:
1. **ANALYZE**: Look at the chat. Which items in the CHECKLIST above are missing?
${supervisorInsight.nextSubGoal ? `2. **PRIORITY GOAL**: The system identified the missing field as: **${supervisorInsight.nextSubGoal.toUpperCase()}**. Focus on this.` : '2. **NEXT FIELD**: Ask for the FIRST unchecked item from the checklist.'}
3. **IMMEDIATE**: If user just said "Yes/Ok", DO NOT ask "Which contact?". Ask for the first missing item IMMEDIATELY.
4. **CONFIRM & NEXT**: When user responds, confirm and ask for the NEXT one.
5. **REPEAT**: Continue until the checklist is COMPLETE.

**EXAMPLES AFTER CONSENT ("yes", "ok", "sure")**:
❌ WRONG: "Great, what information would you like to provide?"
❌ WRONG: "Perfect! Which contact details do you prefer?"
✅ CORRECT: "Perfect! What is your name?"
✅ CORRECT: "Great. May I have your name?"

**EXAMPLES**:
- If all missing -> Ask first (e.g. Name).
- If you have Name -> Ask Email.
- If you have Name & Email -> Ask Phone (if in list).

**CRITICALLY IMPORTANT**:
- DO NOT list all required fields ("I'll need your name, email and phone...")
- DO NOT ask for two fields together ("What's your name and email?")
- If user provides multiple data points together, thank them and ask for next missing field

**ABSOLUTE PROHIBITION**: NEVER use a name extracted from an email address. If the email is "john.smith@example.com", DO NOT call the user "John" or "John Smith". The email username is NOT the user's name.
**PREMATURE GOODBYE PROHIBITION**: DO NOT say "Have a great day", "Thanks for your time", "Goodbye" or similar UNTIL you have collected ALL fields in the checklist above.
- If user provides only email, you MUST still ask for NAME separately if it is in the list.
- If user explicitly refuses → end with "INTERVIEW_COMPLETED"

**CLOSING**: ONLY when you have received ALL fields in the list, thank them and write: "INTERVIEW_COMPLETED"
`;

                return instructions.trim();

            } else if (supervisorInsight.status === 'TRANSITION') {
                const nextTopic = allTopics[topicIndex + 1];
                const nextTopicLabel = (supervisorInsight as any).nextTopic || nextTopic?.label || 'the next topic';
                const nextTopicObj = allTopics.find(t => t.label === nextTopicLabel) || nextTopic;
                const firstSubGoal = nextTopicObj?.subGoals?.[0] || nextTopicLabel;

                supervisorInstruction = `
> [!CRITICAL] SUPERVISOR INSTRUCTION: TOPIC TRANSITION - ACT NOW
> You have finished topic "${currentTopic.label}".
> **YOUR TASK**: Transition to "${nextTopicLabel}" and ask the FIRST question about it.
>
> **STRUCTURE**:
> 1. Brief acknowledgment (max 5 words, e.g., "Grazie per questi spunti.")
> 2. IMMEDIATELY ask a question about "${nextTopicLabel}"
>
> **QUESTION FOCUS**: ${firstSubGoal}
>
> **EXAMPLE**: "Interessante! Parlando di ${nextTopicLabel}, ${firstSubGoal.toLowerCase().includes('come') ? '' : 'come'} [question about ${firstSubGoal}]?"
>
> **PROHIBITIONS**:
> - ❌ Do NOT say "Ora passiamo a..." or "Let's move to..."
> - ❌ Do NOT ask permission ("Possiamo parlare di...?")
> - ❌ Do NOT conclude or ask for contacts
> - ✅ Just naturally ask the question about the new topic
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
                const subGoalsList = currentTopic.subGoals?.join(', ') || 'various aspects';
                supervisorInstruction = `
> [!IMPORTANT] PHASE 2: DEEPENING - Topic: "${currentTopic.label}"
> You are in DEEP DIVE phase exploring topic "${currentTopic.label}" more thoroughly.
> Suggested focus for this turn: "${focus}".
> Available sub-goals for this topic: ${subGoalsList}
>
> **YOUR OBJECTIVE** (pick ONE):
> 1. **Clarify an interesting SCAN response**: If the user said something noteworthy about "${currentTopic.label}" earlier, ask them to elaborate ("You mentioned X earlier, can you tell me more about...?")
> 2. **Explore a missing sub-goal**: If a sub-goal hasn't been discussed yet, ask about it now
> 3. **Vary the angle**: Ask for concrete examples, practical implications, or a different perspective on "${focus}"
>
> **WHAT YOU MUST DO**:
> - Ask ONE specific question (not generic)
> - Reference something from the conversation when possible
> - Focus on "${currentTopic.label}" - don't drift to other topics
>
> **WHAT YOU MUST NOT DO**:
> - ❌ Generic questions ("Is there anything else?", "Tell me more", "Any other thoughts?")
> - ❌ Repeat questions already asked in SCAN
> - ❌ Transition to another topic yourself - wait for SUPERVISOR's TRANSITION
> - ❌ Conclude or ask for contacts
>
> **FLOW**: The SUPERVISOR manages topic transitions. Keep probing "${currentTopic.label}" until you receive a TRANSITION instruction.
`;
                primaryInstruction = `Probe deeply into "${currentTopic.label}". Clarify interesting responses, explore missing sub-goals, or vary the angle.`;
            }
        }


        // SUPERVISOR SUPREMACY LOGIC
        // We must override the bot's tendency to say goodbye if the supervisor says "continue"
        // And we must force the data ask if the supervisor says "completion"

        let supervisorSupremacyInstruction = "";
        const isCompletion = supervisorInsight && (typeof supervisorInsight === 'string' ? false : supervisorInsight.status === 'COMPLETION');
        // Logic for Data Collection (Pre-check) - ensure we don't miss it
        const collectingData = bot.collectCandidateData;

        if (!isCompletion) {
            // ACTIVE PHASE (SCAN / DEEP / TRANSITION)
            // STRICTLY FORBID CLOSURE AND CONTACT REQUESTS
            supervisorSupremacyInstruction = `
> [!CRITICAL] SUPERVISOR SUPREMACY: INTERVIEW IS ACTIVE - PHASE ${supervisorInsight?.status || 'UNKNOWN'}
> The Interview Supervisor has indicated that the conversation MUST CONTINUE.
>
> **ABSOLUTE PROHIBITIONS (VIOLATING THESE = FAILURE):**
> 1. **NO GOODBYE**: Do NOT say "A presto", "Buona giornata", "Goodbye", "See you", "Grazie per il tempo"
> 2. **NO CONTACT REQUESTS**: Do NOT ask for email, phone, name, contacts, or ANY personal data
>    - ❌ "Posso chiederti i contatti?"
>    - ❌ "Prima di concludere, la tua email?"
>    - ❌ "Qual è il tuo nome/email/telefono?"
> 3. **NO WRAP-UP**: Do NOT say "Abbiamo finito", "Siamo alla fine", "Prima di salutarci"
>
> **YOUR ONLY JOB**: Ask questions about the CURRENT TOPIC. Nothing else.
> Contact collection happens LATER, in a different phase. NOT NOW.
>
> If the user said "prego" or "thank you", acknowledge briefly and IMMEDIATELY ask the next topic question.
`;
        } else {
            // COMPLETION PHASE
            if (collectingData) {
                supervisorSupremacyInstruction = `
> [!CRITICAL] SUPERVISOR SUPREMACY: DATA COLLECTION REQUIRED
> The active phase is now DATA COLLECTION.
> **DO NOT SAY GOODBYE YET.**
> You MUST explicitly ask for permission to collect contact details first.
> Phrase: "Before we finish, may I ask for your contact details to stay in touch?" (or Italian: "Prima di salutarci, posso chiederti i contatti per restare aggiornati?")
> ONLY after they agree can you proceed to collect fields.
`;
            } else {
                // Normal Completion
                supervisorSupremacyInstruction = `
> [!NOTE] SUPERVISOR SUPREMACY: COMPLETION
> You are authorized to wrap up and say goodbye.
`;
            }
        }

        return `
## CURRENT TOPIC: ${currentTopic.label} (${progress})
Description: ${currentTopic.description}
Sub-Goals to Cover:
1. ${currentTopic.subGoals.join('\n2. ')}

${supervisorInstruction}

${supervisorSupremacyInstruction}

INSTRUCTION:
${primaryInstruction}
- **STRICTLY ONE QUESTION AT A TIME**: Do not compound questions.
- **NO REPETITION**: Do not repeat phrases.
- **ALWAYS END WITH A QUESTION**: Every response MUST end with "?". Never end with just "Grazie!" or acknowledgments.
- **TRANSITION IMMEDIATELY**: If Supervisor says TRANSITION, obey instructions exactly. Use the provided label.
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
## FINAL REMINDER(CRITICAL):
        - EVERY response MUST end with a question mark(?).
- If you are transitioning, ask the first question of the new topic immediately.
- If you are probe - deepening, ask for a specific detail.
- NEVER end with a statement or a "Thank you" alone.Always follow with "?".
`.trim();
    }
}

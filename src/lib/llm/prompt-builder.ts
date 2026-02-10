
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { buildTopicAnchors } from '@/lib/interview/topic-anchors';

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
        const knowledgeText = bot.knowledgeSources?.map(k => `[${k.title}]: ${k.content}`).join('\n\n') || '';

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
Use this context to inform your questions, but DO NOT lecture the user.
${knowledgeText}
`.trim();
    }

    /**
     * 2. Methodology Prompt: Semi-static rules for probing and flow.
     * Loads from system knowledge or hardcoded best practices.
     */
    static buildMethodologyPrompt(methodologyContent: string, language: string = 'en'): string {
        const flowExplanation = language === 'it' ? `
## FLUSSO DELL'INTERVISTA (LEGGI ATTENTAMENTE)
L'intervista segue un flusso RIGIDO. Tu NON decidi quando passare alla fase successiva - lo fa il SUPERVISOR.

**FASE 1: SCAN** (Panoramica veloce) - OBBLIGATORIA
- Esplori TUTTI i topic con almeno 1 domanda ciascuno
- Il numero di domande per topic è definito dal **piano** (stabilito a monte)
- Obiettivo: capire le opinioni generali dell'utente su ogni tema
- ⛔ NON chiedere contatti. NON concludere. NON dire "prima di salutarci".

**FASE 2: DEEP** (Approfondimento) - DURATA VARIABILE
- Parte solo se c'è tempo residuo **oppure** se l'utente accetta di continuare
- **STRUTTURA**: Si ritorna su alcuni topic già esplorati (non necessariamente tutti)
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
- Explore ALL topics with at least 1 question each
- The number of questions per topic is defined by the **plan** (set upstream)
- Goal: understand the user's general opinions on each theme
- ⛔ DO NOT ask for contacts. DO NOT conclude. DO NOT say "before we wrap up".

**PHASE 2: DEEP** (Deep Dive) - VARIABLE DURATION
- Only starts if there is remaining time **or** the user agrees to continue
- **STRUCTURE**: We return to some topics already explored (not necessarily all)
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
1. **Neutrality**: Never judge. Never agree or disagree excessively.
1a. **NO PROMOS OR REWARDS (CRITICAL)**:
   - Do NOT advertise products, services, or external platforms.
   - Do NOT include emails, links, or calls to action (CTA).
   - Do NOT mention rewards, prizes, or promotions.
2. **ACKNOWLEDGMENT/BRIDGING & FOLLOW-UP (CRITICAL)**:
   - In **SCAN/DEEP**, ALWAYS start with a brief acknowledgment of what the user just said.
   - This creates conversational flow and shows you're listening.
   - The acknowledgment should:
     a) Reference SPECIFIC content from the user's last message (not generic phrases)
     b) Be brief (1-2 sentences max, 10-20 words)
     c) Use varied language - don't always say "Interessante!" or "Capisco"

   - **FOLLOW-UP WHEN IT DESERVES (CRITICAL)**:
     When the user shares something interesting, unexpected, or emotionally significant:
     - Ask a follow-up question on THAT point before moving on
     - Show genuine curiosity: "Mi incuriosisce quello che dici su X - come ci sei arrivato?"
     - Dig deeper: "Quando dici che è stato difficile, cosa intendi esattamente?"
     - Ask for examples: "Puoi farmi un esempio concreto di quando è successo?"

   - **EXAMPLES (Italian)**:
     ✅ "È un punto di vista che non avevo considerato, quello sulla gestione del tempo. Cosa ti ha portato a vederla così?"
     ✅ "Quindi la comunicazione con il team è stata la sfida principale - mi racconti un episodio specifico?"
     ✅ "Il fatto che tu abbia menzionato la formazione è molto rilevante. In che modo ha fatto la differenza?"
     ✅ "Questa esperienza con i clienti difficili sembra essere stata formativa. Cosa hai imparato da quella situazione?"
   - **EXAMPLES (English)**:
     ✅ "That's a perspective I hadn't considered. What led you to see it that way?"
     ✅ "So communication with the team was the main challenge - can you give me a specific example?"
     ✅ "The training aspect you mentioned is particularly relevant. How did it make a difference?"
   - **BAD EXAMPLES (avoid)**:
     ❌ "Interessante!" (too generic, doesn't reference content)
     ❌ "Capisco." (minimal effort, not engaging)
     ❌ "Grazie per aver condiviso." (too formal, robotic)
     ❌ Starting directly with the next question (no bridge)
     ❌ Ignoring an interesting point to rush to the next topic
3. **ONE QUESTION RULE (CRITICAL - ABSOLUTE)**:
   - Ask EXACTLY ONE question per message. NO EXCEPTIONS.
   - Your message must contain ONLY ONE question mark (?).
   - NEVER combine two questions in the same message.
   - NEVER ask a content question AND a permission question together.
   - BAD: "Quali implicazioni vedi? Posso chiederti i contatti?" (TWO questions = FORBIDDEN)
   - GOOD: "Posso chiederti i contatti per restare in contatto?" (ONE question = CORRECT)
   - If transitioning phases, ONLY ask the transition question, nothing else.
4. **Conversational**: Avoid robotic transitions like "Now let's move to". Make it flow naturally.
5. **Probing**: If a user gives a short or vague answer, ask for an example ("Can you tell me about a specific time when that happened?").
6. **NO REPETITION (STRICT)**: Always check the conversation history. Never ask a question that has already been answered or asked. Do not repeat the same concepts or words in consecutive turns.

## FINAL FAILSAFE RULE
End your response with a question mark (?) when you are asking a question (SCAN, DEEP, consent, data collection).
If the SUPERVISOR instructs completion or final goodbye, do NOT add a question mark.
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

        // Reward Logic (not surfaced during interviews to avoid promo/CTA)
        const rewardText = `REWARD STATUS: NONE.`;

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

    static buildPlanSummary(
        bot: Bot & { topics: TopicBlock[] },
        interviewPlan?: any
    ): string {
        if (!interviewPlan) return '';
        const topics = [...(bot.topics || [])].sort((a, b) => a.orderIndex - b.orderIndex);
        const scanMap = new Map<string, any>((interviewPlan.scan?.topics || []).map((t: any) => [t.topicId, t]));
        const deepMap = new Map<string, any>((interviewPlan.deep?.topics || []).map((t: any) => [t.topicId, t]));

        const topicLines = topics.map((t, idx) => {
            const scan = scanMap.get(t.id) as { maxTurns?: number } | undefined;
            const deep = deepMap.get(t.id) as { maxTurns?: number } | undefined;
            const scanTurns = scan?.maxTurns ?? 1;
            const deepTurns = deep?.maxTurns ?? interviewPlan.deep?.maxTurnsPerTopic ?? 1;
            const subGoals = (t.subGoals || []).join(' | ') || 'N/A';
            return `${idx + 1}. ${t.label} | scan: ${scanTurns} turn | deep: ${deepTurns} turn | sub-goals: ${subGoals}`;
        }).join('\n');

        return `
## INTERVIEW GAME PLAN (COACH MODE)
- Flow: SCAN all topics → DEEP on missing sub-goals → DATA COLLECTION (if enabled)
- Never end the interview during SCAN/DEEP
- Never ask for contacts during SCAN/DEEP
- Ask exactly one question per turn

TOPIC PLAN:
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
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string; transitionUserMessage?: string; transitionMode?: 'bridge' | 'clean_pivot'; transitionBridgeSnippet?: string; engagingSnippet?: string },
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
            // Offer user to continue with deeper questions (no hardcoded time phrasing)
            if (supervisorInsight.status === 'DEEP_OFFER_ASK') {
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const offerPrompt = isItalian ? `
## FASE: OFFERTA APPROFONDIMENTO
Puoi proporre un breve approfondimento opzionale.

**ISTRUZIONI**:
1. Ringrazia brevemente l'utente per le risposte finora.
2. Chiedi in modo leggero se ha qualche minuto in più per continuare con alcune domande extra di approfondimento.
3. Attendi la risposta dell'utente.

**DIVIETI**:
- NON chiedere dati di contatto ora
- NON fare altre domande sui topic
- SOLO offri la scelta di continuare o meno
- NON concludere l'intervista
` : `
## PHASE: DEEP DIVE OFFER
You may propose a short optional deep-dive.

**INSTRUCTIONS**:
1. Briefly thank the user for their answers so far.
2. Ask lightly if they have a few extra minutes to continue with a few extra deep-dive questions.
3. Wait for user's response.

**PROHIBITIONS**:
- DO NOT ask for contact details now
- DO NOT ask other topic questions
- ONLY offer the choice to continue or not
- DO NOT conclude the interview
`;
                return offerPrompt.trim();
            }

            if (supervisorInsight.status === 'START_DEEP') {
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';
                const focusTopic = supervisorInsight.focusPoint || currentTopic.label || allTopics[0]?.label || 'the first topic';
                const engagingSnippet = (supervisorInsight as any).engagingSnippet || '';

                const snippetHint = engagingSnippet
                    ? (isItalian
                        ? `L'utente ha mostrato particolare interesse quando ha detto: "${engagingSnippet}". Usa questo come aggancio.\n`
                        : `The user showed particular interest when they said: "${engagingSnippet}". Use this as a hook.\n`)
                    : '';

                const startDeepPrompt = isItalian ? `
## FASE: INIZIO APPROFONDIMENTO (DEEP)
${snippetHint}Abbiamo completato la panoramica generale di tutti i temi.
Ora approfondiamo alcuni punti interessanti, partendo da: "${focusTopic}".

**ISTRUZIONI**:
1. Fai una breve transizione naturale riconoscendo che l'utente ha accettato di continuare.
2. Torna al tema "${focusTopic}" e fai una domanda specifica di approfondimento.
3. Cita un dettaglio specifico che l'utente ha menzionato prima su questo tema.
` : `
## PHASE: START DEEP DIVE
${snippetHint}We have completed the general overview of all topics.
Now we dive deeper into interesting points, starting with: "${focusTopic}".

**INSTRUCTIONS**:
1. Make a brief natural transition acknowledging the user's agreement to continue.
2. Return to "${focusTopic}" and ask a specific follow-up question referencing a previous detail.
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
1. Ringrazia sinceramente l'utente per il tempo e le risposte.
2. Indica chiaramente che l'intervista è conclusa.
3. Chiedi se puoi fare alcune domande per raccogliere i dati di contatto per restare in contatto.
` : `
## PHASE: DATA COLLECTION CONSENT
The content interview is complete.
Now you must ask for PERMISSION to collect contact data.

**INSTRUCTIONS**:
1. Sincerely thank the user for their time and answers.
2. Explicitly state that the interview is completed.
3. Ask if you can ask for some contact details to stay in touch.
`;
                return consentPrompt.trim();
            }

            if (supervisorInsight.status === 'COMPLETE_WITHOUT_DATA') {
                const lang = bot?.language || 'en';
                return lang === 'it'
                    ? "## FASE: CONCLUSIONE\nL'intervista è finita. Ringrazia calorosamente e saluta. Non fare altre domande. Aggiungi alla fine del messaggio: INTERVIEW_COMPLETED"
                    : "## PHASE: COMPLETION\nThe interview is over. Warmly thank the user and say goodbye. Do not ask any more questions. Add at the end of the message: INTERVIEW_COMPLETED";
            }

            if (supervisorInsight.status === 'FINAL_GOODBYE') {
                const lang = bot?.language || 'en';
                return lang === 'it'
                    ? "## FASE: SALUTO FINALE\nHai raccolto tutte le informazioni necessarie. Ringrazia l'utente per la collaborazione e saluta cordialmente. Di' che verranno ricontattati presto. Aggiungi alla fine: INTERVIEW_COMPLETED"
                    : "## PHASE: FINAL GOODBYE\nYou have collected all necessary information. Thank the user for their cooperation and say goodbye cordially. Mention they will be contacted soon. Add at the end: INTERVIEW_COMPLETED";
            }

            if (supervisorInsight.status === 'CONFIRM_STOP') {
                const lang = bot?.language || 'en';
                return lang === 'it'
                    ? "## FASE: CONFERMA CHIUSURA\nHai notato che l'utente potrebbe essere stanco o ha detto 'no/basta'. Rileva questo sentimento con empatia e chiedi conferma se desidera concludere l'intervista ora o se preferisce continuare. NON concludere ancora.\n**ESEMPIO**: \"Capisco, forse siamo andati un po' per le lunghe. Vorresti concludere qui l'intervista o preferisci rispondere ancora a qualche domanda?\""
                    : "## PHASE: CONFIRM STOP\nYou noticed the user might be tired or said 'no/enough'. Acknowledge this with empathy and ask for confirmation if they want to conclude the interview now or if they'd like to continue. DO NOT conclude yet.\n**EXAMPLE**: \"I understand, maybe we've been going on for a bit. Would you like to wrap up the interview here, or would you prefer to answer a few more questions?\"";
            }

            // ========== DATA_COLLECTION ==========
            if (supervisorInsight.status === 'DATA_COLLECTION') {
                // RECRUITER MODE - DYNAMIC FIELDS
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                const rawFields = (bot?.candidateDataFields as any[]) || ['name', 'email'];
                const fieldIds = rawFields.map((f: any) => typeof f === 'string' ? f : (f.id || f.field));
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
                const transitionFocus = supervisorInsight.nextSubGoal || firstSubGoal;
                const transitionUserMessage = supervisorInsight.transitionUserMessage || '';
                const transitionMode = supervisorInsight.transitionMode || 'clean_pivot';
                const transitionBridgeSnippet = supervisorInsight.transitionBridgeSnippet || '';
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';

                supervisorInstruction = isItalian ? `
> [!CRITICAL] ISTRUZIONE SUPERVISOR: TRANSIZIONE TOPIC - AGISCI ORA
> Hai finito il topic "${currentTopic.label}".
> **IL TUO COMPITO**: Transiziona a "${nextTopicLabel}" e fai la PRIMA domanda.
>
> **STRUTTURA OBBLIGATORIA**:
> 1. **FRASE DI LEGATURA** (OBBLIGATORIA, max 15 parole): riconosci l'ultimo punto dell'utente con un riferimento SPECIFICO.
>    - Esempio: "Quello che dici su [dettaglio specifico] è un punto importante."
> 2. **CONNESSIONE NATURALE** al nuovo topic (opzionale, 5-10 parole)
> 3. **UNA DOMANDA** su "${nextTopicLabel}"
>
> **FOCUS DOMANDA**: ${transitionFocus}
> **VINCOLO**: La domanda deve essere chiaramente sul topic "${nextTopicLabel}".
${transitionUserMessage ? `> **ULTIMO MESSAGGIO UTENTE (interpretalo semanticamente, NON citarlo parola per parola)**: "${transitionUserMessage}"` : ''}
${transitionBridgeSnippet ? `> **DETTAGLIO UTENTE DA VALORIZZARE NELLA LEGATURA**: "${transitionBridgeSnippet}"` : ''}
> **SE L'UTENTE È CONFUSO**: riformula la domanda in modo semplice prima di chiedere.
${transitionMode === 'bridge'
    ? `> **MODALITÀ BRIDGE**: collega il passaggio in modo naturale usando un riconoscimento breve del punto utente, senza citazione letterale.`
    : '> **MODALITÀ CLEAN PIVOT**: fai un riconoscimento breve e neutro, poi passa al nuovo topic senza riusare dettagli non pertinenti.'}
>
> **DIVIETI**:
> - ❌ NON dire "Ora passiamo a..." o "Cambiamo argomento..."
> - ❌ NON chiedere permesso ("Possiamo parlare di...?")
> - ❌ NON concludere o chiedere contatti
> - ❌ NON fare citazioni letterali lunghe o copia-incolla della risposta utente
> - ❌ Evita pattern rigidi e ripetitivi ("Hai detto X..." sempre uguale)
> - ❌ NON iniziare direttamente con la domanda senza riconoscere la risposta precedente
> - ✅ Fai fluire la conversazione naturalmente
` : `
> [!CRITICAL] SUPERVISOR INSTRUCTION: TOPIC TRANSITION - ACT NOW
> You have finished topic "${currentTopic.label}".
> **YOUR TASK**: Transition to "${nextTopicLabel}" and ask the FIRST question about it.
>
> **MANDATORY STRUCTURE**:
> 1. **BRIDGING PHRASE** (REQUIRED, max 15 words): acknowledge the user's last point with a SPECIFIC reference.
>    - Example: "What you said about [specific detail] is an important point."
> 2. **NATURAL CONNECTION** to the new topic (optional, 5-10 words)
> 3. **ONE QUESTION** about "${nextTopicLabel}"
>
> **QUESTION FOCUS**: ${transitionFocus}
> **CONSTRAINT**: The question must clearly be about "${nextTopicLabel}".
${transitionUserMessage ? `> **LATEST USER MESSAGE (interpret semantically, DO NOT quote verbatim)**: "${transitionUserMessage}"` : ''}
${transitionBridgeSnippet ? `> **USER DETAIL TO LEVERAGE IN BRIDGING**: "${transitionBridgeSnippet}"` : ''}
> **IF USER IS CONFUSED**: rephrase simply before asking.
${transitionMode === 'bridge'
    ? `> **BRIDGE MODE**: connect naturally with a short acknowledgment of the user point, without literal quoting.`
    : '> **CLEAN PIVOT MODE**: use a short neutral acknowledgment, then pivot without reusing irrelevant user details.'}
>
> **PROHIBITIONS**:
> - ❌ Do NOT say "Now let's move to..." or "Let's change topic..."
> - ❌ Do NOT ask permission ("Can we talk about...?")
> - ❌ Do NOT conclude or ask for contacts
> - ❌ Do NOT use long literal quotes or copy-paste user wording
> - ❌ Avoid rigid repetitive patterns like always starting with "You said X..."
> - ❌ Do NOT start directly with the question without acknowledging the previous response
> - ✅ Let the conversation flow naturally
`;
            } else if (supervisorInsight.status === 'SCANNING') {
                const target = supervisorInsight.nextSubGoal || "the next sub-goal";
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';
                supervisorInstruction = isItalian ? `
> [!IMPORTANT] FASE 1: SCANNING
> Il tuo obiettivo è il sub-goal: "${target}".
>
> **STRUTTURA OBBLIGATORIA DEL MESSAGGIO**:
> 1. **FRASE DI LEGATURA** (OBBLIGATORIA): Inizia riconoscendo quello che l'utente ha appena detto. Cita un elemento SPECIFICO della sua risposta.
>    - Mantienila breve e naturale (10-20 parole).
>    - Esempio: "Quello che dici sulla [X] è interessante, soprattutto il punto su [Y]."
> 2. **UNA DOMANDA** su "${target}"
>    - Se l'utente ha detto qualcosa di interessante, approfondisci QUELLO prima di passare oltre.
>    - Esempio: "Mi incuriosisce quando dici [dettaglio] - puoi dirmi di più?"
>
> **ENGAGEMENT**: Se la risposta dell'utente merita approfondimento, APPROFONDISCI. Non correre al prossimo punto.
> NON saltare la frase di legatura. NON iniziare direttamente con la domanda.
> DO NOT output [CONCLUDE_INTERVIEW]. DO NOT say "Abbiamo finito".
` : `
> [!IMPORTANT] PHASE 1: SCANNING
> Your target is sub-goal: "${target}".
>
> **MANDATORY MESSAGE STRUCTURE**:
> 1. **BRIDGING PHRASE** (REQUIRED): Start by acknowledging what the user just said. Reference a SPECIFIC element from their response.
>    - Keep it short and natural (10-20 words).
>    - Example: "What you said about [X] is interesting, especially the point about [Y]."
> 2. **ONE QUESTION** about "${target}"
>    - If the user said something interesting, dig deeper into THAT before moving on.
>    - Example: "I'm curious about when you mentioned [detail] - can you tell me more?"
>
> **ENGAGEMENT**: If the user's answer deserves follow-up, FOLLOW UP. Don't rush to the next point.
> DO NOT skip the bridging phrase. DO NOT start directly with the question.
> DO NOT output [CONCLUDE_INTERVIEW]. DO NOT say "We are done".
`;
                primaryInstruction = "Focus ONLY on the target sub-goal for this turn (Scanning Mode). Remember to start with an acknowledgment of the user's previous answer. If their answer is interesting, probe deeper.";
            } else if (supervisorInsight.status === 'DEEPENING') {
                const focus = supervisorInsight.focusPoint || "their last point";
                const engagingSnippet = (supervisorInsight as any).engagingSnippet || '';
                const subGoalsList = currentTopic.subGoals?.join(', ') || 'various aspects';
                const lang = bot?.language || 'en';
                const isItalian = lang === 'it';
                supervisorInstruction = isItalian ? `
> [!IMPORTANT] FASE 2: DEEPENING - Topic: "${currentTopic.label}"
> Sei nella fase di APPROFONDIMENTO del topic "${currentTopic.label}".
> Focus suggerito: "${focus}".
${engagingSnippet ? `> **L'UTENTE HA MOSTRATO INTERESSE quando ha detto**: "${engagingSnippet}"\n> Usa questo come punto di partenza per approfondire.` : ''}
> Sub-goal disponibili: ${subGoalsList}
>
> **STRUTTURA OBBLIGATORIA DEL MESSAGGIO**:
> 1. **FRASE DI LEGATURA** (OBBLIGATORIA): Riconosci quello che l'utente ha appena detto.
>    - Mostra genuino interesse: "Mi colpisce quello che dici su [X]..."
>    - Fai sentire l'utente ascoltato: "Capisco cosa intendi quando parli di [Y]..."
> 2. **UNA DOMANDA** di approfondimento SPECIFICA
>    - Chiedi il "perché" o il "come": "Come ci sei arrivato a questa conclusione?"
>    - Chiedi esempi concreti: "Puoi farmi un esempio di quando è successo?"
>    - Esplora le implicazioni: "Cosa ha significato questo per te?"
>
> **ENGAGEMENT È LA PRIORITÀ**:
> - Segui il filo dell'utente, non la tua agenda
> - Se dice qualcosa di emotivamente significativo, riconoscilo
> - Fai domande che mostrano che hai DAVVERO ascoltato
>
> **EVITA**:
> - ❌ Domande generiche ("C'è altro?", "Dimmi di più")
> - ❌ Ignorare punti interessanti per passare oltre
> - ❌ Concludere o chiedere contatti
` : `
> [!IMPORTANT] PHASE 2: DEEPENING - Topic: "${currentTopic.label}"
> You are in DEEP DIVE phase exploring topic "${currentTopic.label}" more thoroughly.
> Suggested focus for this turn: "${focus}".
${engagingSnippet ? `> **THE USER SHOWED INTEREST when they said**: "${engagingSnippet}"\n> Use this as a starting point to dig deeper.` : ''}
> Available sub-goals for this topic: ${subGoalsList}
>
> **MANDATORY MESSAGE STRUCTURE**:
> 1. **BRIDGING PHRASE** (REQUIRED): Acknowledge what the user just said.
>    - Show genuine interest: "What you said about [X] really stands out..."
>    - Make them feel heard: "I understand what you mean about [Y]..."
> 2. **ONE SPECIFIC follow-up QUESTION**
>    - Ask "why" or "how": "How did you come to that conclusion?"
>    - Ask for concrete examples: "Can you give me an example of when that happened?"
>    - Explore implications: "What did that mean for you?"
>
> **ENGAGEMENT IS THE PRIORITY**:
> - Follow the user's thread, not your agenda
> - If they share something emotionally significant, acknowledge it
> - Ask questions that show you've REALLY listened
>
> **AVOID**:
> - ❌ Generic questions ("Is there anything else?", "Tell me more")
> - ❌ Ignoring interesting points to move on
> - ❌ Concluding or asking for contacts
>
> **FLOW**: The SUPERVISOR manages topic transitions. Keep probing "${currentTopic.label}" until you receive a TRANSITION instruction.
`;
                primaryInstruction = `Probe deeply into "${currentTopic.label}". Show genuine curiosity. Start with a bridging phrase that acknowledges the user's response, then ask a specific follow-up question.`;
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
> [!CRITICAL] ACTIVE INTERVIEW — CONTINUE QUESTIONING
> Your only job now: ask questions about the current topic.
> Do NOT say goodbye, ask for contacts, or wrap up. Those happen in a later phase.
`;
        } else {
            // COMPLETION PHASE
            if (collectingData) {
                supervisorSupremacyInstruction = `
> [!CRITICAL] SUPERVISOR SUPREMACY: DATA COLLECTION REQUIRED
> The active phase is now DATA COLLECTION.
> **DO NOT SAY GOODBYE YET.**
> You MUST explicitly ask for permission to collect contact details first.
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

        const lang = bot?.language || 'en';
        const isItalian = lang === 'it';
        const anchorData = buildTopicAnchors(currentTopic, lang);
        const anchorList = anchorData.anchors.join(', ');
        const anchorSection = anchorList
            ? (isItalian
                ? `## ANCORE TOPIC (OBBLIGATORIE)\nUsa almeno UN termine tra: ${anchorList}.\n`
                : `## TOPIC ANCHORS (REQUIRED)\nUse at least ONE term from: ${anchorList}.\n`)
            : '';

        return `
## CURRENT TOPIC: ${currentTopic.label} (${progress})
Description: ${currentTopic.description}
Sub-Goals to Cover:
1. ${currentTopic.subGoals.join('\n2. ')}

${supervisorInstruction}

${supervisorSupremacyInstruction}

${anchorSection}

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
        supervisorInsight?: { status: string; nextSubGoal?: string; focusPoint?: string; transitionUserMessage?: string; transitionMode?: 'bridge' | 'clean_pivot'; transitionBridgeSnippet?: string; engagingSnippet?: string } | string,
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

${planSummary}

${specificPrompt}

        ---
## FINAL REMINDER(CRITICAL):
- EVERY response MUST end with a question mark(?), UNLESS you are concluding the interview.
- If you are transitioning, ask the first question of the new topic immediately.
- If you are probe-deepening, ask for a specific detail.
- If you are concluding (INTERVIEW_COMPLETED), do NOT add a question mark at the end.
`.trim();
    }
}

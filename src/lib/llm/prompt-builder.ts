
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import { MemoryManager } from '@/lib/memory/memory-manager';
import type { SupervisorInsight } from '@/lib/interview/interview-supervisor';
import type { InterviewPlan, PlanTopic } from '@/lib/interview/plan-types';
import type { ValidationResponse } from '@/lib/interview/validation-response';
import type { CILAnalysis, CILState } from '@/lib/interview/cil/types';
import type { ConversationMemoryData } from '@/types/memory';
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

export class PromptBuilder {

    /**
     * BLOCK 1: IDENTITY
     * WHO the interviewer is + base rules (stated ONCE)
     * Consolidates: buildPersonaPrompt + methodology rules
     */
    private static buildIdentityBlock(
        bot: Bot & { knowledgeSources?: KnowledgeSource[]; rewardConfig?: any },
        interviewerQuality?: string
    ): string {
        const isAvanzato = interviewerQuality === 'avanzato';
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');

        // Sanitize admin-configured fields before prompt interpolation
        const safeName = sanitizeConfig(bot.name);
        const safeGoal = sanitizeConfig(bot.researchGoal);
        const safeAudience = sanitizeConfig(bot.targetAudience);
        const safeTone = sanitizeConfig(bot.tone);
        const knowledgePreviewLimit = isAvanzato ? 120 : 180;

        const knowledgeText = (bot.knowledgeSources || [])
            .slice(0, isAvanzato ? 2 : 3)
            .map((source) => {
                const title = sanitizeConfig(source.title || 'Untitled', 200);
                const preview = sanitizeConfig(
                    String(source.content || '').replace(/\s+/g, ' ').trim(),
                    knowledgePreviewLimit
                );
                return `- ${title}: ${preview}${preview.length >= knowledgePreviewLimit ? '…' : ''}`;
            })
            .join('\n');

        if (isAvanzato) {
            return isItalian ? `
## IDENTITÀ
Sei "${safeName}", ricercatore qualitativo professionista.
Missione: "${safeGoal}"
Pubblico: "${safeAudience}"
Tono: "${safeTone || 'Professionale, naturale, empatico'}"

## REGOLE BASE
- Una sola domanda per turno.
- Niente contatti fuori da DATA_COLLECTION.
- Niente promo, link o CTA.
- Evita ripetizioni letterali e opener rituali.
- Cerca insight reali, ma con domande brevi e specifiche.

## KNOWLEDGE BASE
${knowledgeText}
`.trim() : `
## IDENTITY
You are "${safeName}", a professional qualitative researcher.
Mission: "${safeGoal}"
Audience: "${safeAudience}"
Tone: "${safeTone || 'Professional, natural, empathetic'}"

## BASE RULES
- One question per turn.
- No contact requests outside DATA_COLLECTION.
- No promo, links, or CTA.
- Avoid literal repetition and ritual openers.
- Seek real insight, but keep questions brief and specific.

## KNOWLEDGE BASE
${knowledgeText}
`.trim();
        }

        return isItalian ? `
## IDENTITÀ
Sei "${safeName}", intervistatore professionale per una ricerca.
Missione: "${safeGoal}"
Pubblico: "${safeAudience}"
Tono: "${safeTone || 'Naturale, professionale, empatico'}"

## REGOLE BASE
- Una sola domanda per turno.
- Niente contatti fuori da DATA_COLLECTION.
- Niente promo, link o CTA.
- Mantieni il tono naturale ed evita opener rituali o ripetizioni letterali.
- Preferisci domande concrete, comparabili e facili da aggregare.

## FLOW
- ESPLORAZIONE: copri i topic con una domanda mirata sul sub-goal più utile.
- APPROFONDIMENTO: approfondisci solo se emerge un esempio, un impatto o un vincolo davvero utile.
- DATA_COLLECTION: chiedi consenso e poi raccogli un campo per volta.
- CHIUSURA: solo quando il supervisor lo indica.

## MODALITÀ STANDARD
- Resta conversazionale, ma diagnostico.
- Dopo una risposta già utile, avanza invece di aprire piste opzionali.
- Preferisci pratica attuale, frequenza, ostacolo, owner, canale, metrica, esempio recente o prossimo passo.
- Evita allargamenti troppo astratti o filosofici.

## KNOWLEDGE BASE
${knowledgeText}
`.trim() : `
## IDENTITY
You are "${safeName}", a professional research interviewer.
Mission: "${safeGoal}"
Audience: "${safeAudience}"
Tone: "${safeTone || 'Natural, professional, empathetic'}"

## BASE RULES
- One question per turn.
- No contact requests outside DATA_COLLECTION.
- No promo, links, or CTA.
- Keep the tone natural and avoid ritual openers or literal repetition.
- Prefer concrete, comparable questions that are easy to aggregate.

## FLOW
- EXPLORING: cover topics with one focused question on the most useful sub-goal.
- DEEPENING: deepen only when a real example, impact, or constraint appears.
- DATA_COLLECTION: ask consent, then collect one field at a time.
- CLOSURE: only when the supervisor indicates it.

## STANDARD MODE
- Stay conversational, but diagnostic.
- Stay on the current topic until the planned target coverage is plausibly satisfied; then move on cleanly instead of opening optional threads.
- Prefer current practice, frequency, blocker, owner, channel, metric, recent example, or next step.
- Avoid abstract or philosophical widening unless clearly useful.

## KNOWLEDGE BASE
${knowledgeText}
`.trim();
    }

    /**
     * BLOCK 2: INTERVIEW CONTEXT
     * Time status, pacing, topic roadmap
     * Consolidates: buildContextPrompt + buildPlanSummary
     */
    private static buildInterviewContextBlock(
        conversation: Conversation,
        bot: Bot & { topics: TopicBlock[] },
        effectiveDurationSeconds: number,
        interviewerQuality?: string
    ): string {
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');
        const isAvanzato = interviewerQuality === 'avanzato';
        const maxMins = bot.maxDurationMins || 10;
        const elapsedMins = Math.floor(effectiveDurationSeconds / 60);
        const remainingMins = maxMins - elapsedMins;

        // Pacing
        const allTopics = bot.topics || [];
        const currentTopicIndex = allTopics.findIndex(t => t.id === conversation.currentTopicId);
        const topicsRemaining = allTopics.length - (currentTopicIndex + 1);
        const idealTopicIndex = Math.floor((elapsedMins / maxMins) * allTopics.length);
        const isBehind = currentTopicIndex < idealTopicIndex;
        const isCriticalTime = remainingMins <= (topicsRemaining * 2);

        let statusInstruction = '';
        if (remainingMins <= 0) {
            statusInstruction = isItalian
                ? `STATO: TEMPO_ESAURITO. Segui il supervisor per il prossimo passo.`
                : `STATUS: TIME_BUDGET_REACHED. Follow supervisor guidance for next step.`;
        } else if (remainingMins < 2) {
            statusInstruction = isItalian
                ? `STATO: TEMPO_BASSO (${remainingMins}m). Domande focalizzate.`
                : `STATUS: LOW_TIME (${remainingMins}m). Focused questions only.`;
        } else if (isBehind || isCriticalTime) {
            statusInstruction = isItalian
                ? `STATO: IN_RITARDO (${remainingMins}m per ${topicsRemaining} topic).`
                : `STATUS: BEHIND_SCHEDULE (${remainingMins}m for ${topicsRemaining} topics).`;
        } else {
            statusInstruction = isItalian
                ? `STATO: IN_LINEA (${remainingMins}m restanti).`
                : `STATUS: ON_TRACK (${remainingMins}m left).`;
        }

        // Topic roadmap (labels are admin-configured)
        const useCompactRoadmap = isAvanzato || allTopics.length > 3;
        const topicLines = useCompactRoadmap
            ? [
                currentTopicIndex >= 0 && allTopics[currentTopicIndex]
                    ? `${isItalian ? 'Corrente' : 'Current'}: ${sanitizeConfig(allTopics[currentTopicIndex].label, 200)}`
                    : null,
                currentTopicIndex + 1 < allTopics.length && allTopics[currentTopicIndex + 1]
                    ? `${isItalian ? 'Prossimo' : 'Next'}: ${sanitizeConfig(allTopics[currentTopicIndex + 1].label, 200)}`
                    : null,
                allTopics.length > 0
                    ? `${isItalian ? 'Restanti' : 'Remaining'}: ${Math.max(0, allTopics.length - Math.max(currentTopicIndex, 0) - 1)}`
                    : null
            ].filter(Boolean).join('\n')
            : allTopics.map((t, idx) => {
                const marker = idx === currentTopicIndex ? '→ ' : '  ';
                const safeLabel = sanitizeConfig(t.label, 200);
                return `${marker}${idx + 1}. ${safeLabel}`;
            }).join('\n');

        return isItalian ? `
## CONTESTO INTERVISTA
Trascorso: ${elapsedMins}m / Budget: ${maxMins}m
${statusInstruction}

## ROADMAP TOPIC
${topicLines}
`.trim() : `
## INTERVIEW CONTEXT
Elapsed: ${elapsedMins}m / Budget: ${maxMins}m
${statusInstruction}

## TOPIC ROADMAP
${topicLines}
`.trim();
    }

    /**
     * BLOCK 3: TOPIC FOCUS
     * Phase-dependent instructions for WHAT to ask RIGHT NOW
     * Consolidates: buildTopicPrompt + status banner
     */
    private static buildTopicFocusBlock(
        currentTopic: TopicBlock | null,
        allTopics: TopicBlock[],
        supervisorInsight?: SupervisorInsight,
        bot?: any
    ): string {
        const isItalian = String(bot?.language || 'en').toLowerCase().startsWith('it');
        const status = supervisorInsight?.status;

        if (!currentTopic) {
            return isItalian
                ? `## STATO\nSiamo in chiusura/transizione. Ringrazia e segui il supervisor.`
                : `## STATE\nWe are in closure/transition. Thank and follow supervisor guidance.`;
        }

        // EXPLORING / EXPLORING_DEEP
        if (status === 'EXPLORING' || status === 'EXPLORING_DEEP') {
            const bonus = status === 'EXPLORING_DEEP' ? (isItalian ? ' [TURNO BONUS]' : ' [BONUS TURN]') : '';
            const subGoals = (currentTopic.subGoals || []).filter(Boolean).map(g => sanitizeConfig(g, 200));
            const subGoalPreview = subGoals.slice(0, 3).join(' | ') || (isItalian ? 'N/A' : 'N/A');
            const safeTopicLabel = sanitizeConfig(currentTopic.label, 200);
            const isAvanzatoLocal = ((bot as any)?.interviewerQuality || 'standard') === 'avanzato';

            const metodoIT = isAvanzatoLocal
                ? `Metodo: agganciati a un dettaglio concreto e fai una sola domanda distintiva sul sub-goal più promettente. Se l'utente apre un angolo nuovo, segui quel nuovo angolo invece di trascinare il dettaglio precedente.`
                : `Metodo: agganciati a un dettaglio concreto appena emerso e fai UNA sola domanda diagnostica, chiara e confrontabile sul sub-goal più utile. Evita opener rituali e domande troppo ampie.`;

            const methodEN = isAvanzatoLocal
                ? `Method: hook into one concrete detail and ask a single distinctive question on the most promising sub-goal. If the user opens a new angle, follow that new angle instead of dragging the previous detail forward.`
                : `Method: hook into one concrete detail that just emerged and ask ONE clear, comparable diagnostic question on the most useful sub-goal. Avoid ritual openers and overly broad prompts.`;

            return isItalian ? `
## FASE: ESPLORAZIONE${bonus}
Topic: "${safeTopicLabel}"
Sub-goal: ${subGoalPreview}
${metodoIT}

## REGOLE BASE
- Una sola domanda per turno.
- Nessuna chiusura e nessun contatto in ESPLORAZIONE.
- Agganciati sempre a un dettaglio specifico di ciò che l'utente ha detto.
`.trim() : `
## PHASE: EXPLORING${bonus}
Topic: "${safeTopicLabel}"
Sub-goal: ${subGoalPreview}
${methodEN}

## BASE RULES
- One question per turn.
- No closure or contact requests in EXPLORING.
- Always connect to a specific detail the user mentioned.
`.trim();
        }

        // TRANSITION
        if (status === 'TRANSITION') {
            const nextIndex = allTopics.findIndex(t => t.id === currentTopic.id) + 1;
            const nextTopic = nextIndex < allTopics.length ? allTopics[nextIndex] : null;
            const safeCurrentLabel = sanitizeConfig(currentTopic.label, 200);
            const nextLabel = sanitizeConfig(nextTopic?.label, 200) || (isItalian ? 'Chiusura' : 'Closure');
            // engagingSnippet = what the user said on the departing topic — sanitize as user data
            const engagingSnippet = sanitize(supervisorInsight?.engagingSnippet || '', 200).trim();
            const bridgeLine = engagingSnippet
                ? (isItalian
                    ? `Aggancia la transizione a qualcosa di concreto che l'utente ha condiviso: "${engagingSnippet}"`
                    : `Anchor the bridge to something concrete the user just shared: "${engagingSnippet}"`)
                : '';
            return isItalian ? `
## FASE: TRANSIZIONE
Stai per spostarti da "${safeCurrentLabel}" a "${nextLabel}".
${bridgeLine}
Fai un ponte breve e naturale, poi UNA domanda di apertura per il nuovo topic.
`.trim() : `
## PHASE: TRANSITION
Moving from "${safeCurrentLabel}" to "${nextLabel}".
${bridgeLine}
Brief natural bridge, then ONE opening question for the next topic.
`.trim();
        }

        // DEEPENING
        if (status === 'DEEPENING') {
            // engagingSnippet and crossTopicNotes originate from conversation analysis — sanitize as user data
            const engagingSnippet = sanitize(supervisorInsight?.engagingSnippet || '', 500).trim();
            const crossTopicNotes = sanitize(supervisorInsight?.crossTopicNotes || '', 400).trim();
            const safeLabel = sanitizeConfig(currentTopic.label, 200);
            const isAvanzatoDeep = ((bot as any)?.interviewerQuality || 'standard') === 'avanzato';

            if (isAvanzatoDeep) {
                return isItalian ? `
## FASE: APPROFONDIMENTO (QUALITATIVO)
Topic: "${safeLabel}"
${engagingSnippet ? `Spunto chiave: "${engagingSnippet}"` : ''}
Sei in modalità qualitativa. Non seguire uno script.
- Collega questo momento a quanto emerso in precedenza nella conversazione
- Formula un'ipotesi e chiedi conferma ("Mi sembra che tu stia dicendo che... — è così?")
- Cerca la contraddizione produttiva: metti in dialogo affermazioni diverse dell'utente
- Una sola domanda, ma la più incisiva e rivelante possibile
`.trim() : `
## PHASE: DEEPENING (QUALITATIVE)
Topic: "${safeLabel}"
${engagingSnippet ? `Key insight: "${engagingSnippet}"` : ''}
You are in qualitative mode. Do not follow a script.
- Connect this moment to what emerged earlier in the conversation
- Form a hypothesis and ask for confirmation ("It seems like you're saying that... — is that right?")
- Look for productive contradictions: put the user's different statements in dialogue
- One question only, but make it the most incisive and revealing possible
`.trim();
            }

            return isItalian ? `
## FASE: APPROFONDIMENTO
Topic: "${safeLabel}"
${engagingSnippet ? `Spunto chiave: "${engagingSnippet}"` : ''}
${crossTopicNotes ? `Contesto trasversale (altri topic): ${crossTopicNotes}` : ''}
Approfondisci i segnali significativi. Una sola domanda focalizzata.
`.trim() : `
## PHASE: DEEPENING
Topic: "${safeLabel}"
${engagingSnippet ? `Key insight: "${engagingSnippet}"` : ''}
${crossTopicNotes ? `Cross-topic context: ${crossTopicNotes}` : ''}
Deepen significant signals. One focused question.
`.trim();
        }

        // DEEP_OFFER_ASK
        if (status === 'DEEP_OFFER_ASK') {
            // extensionPreview = areas/focus points we'd explore (from uncovered topics)
            // extensionUserSnippets = what the user actually said on covered topics (user data → sanitize)
            const previewAreas = (supervisorInsight?.extensionPreview || [])
                .map(v => sanitizeConfig(String(v || '').trim(), 100))
                .filter(Boolean);
            const userSnippets = (supervisorInsight?.extensionUserSnippets || [])
                .map(v => sanitize(String(v || '').trim(), 120))
                .filter(Boolean);

            const areasLine = previewAreas.length > 0
                ? (isItalian
                    ? `Aree ancora da esplorare: ${previewAreas.map(a => `"${a}"`).join(', ')}`
                    : `Areas still to explore: ${previewAreas.map(a => `"${a}"`).join(', ')}`)
                : '';
            const snippetsLine = userSnippets.length > 0
                ? (isItalian
                    ? `Da quanto condiviso dall'utente: "${userSnippets[0]}"`
                    : `From what the user shared: "${userSnippets[0]}"`)
                : '';

            return isItalian ? `
## FASE: OFFERTA ESTENSIONE
Il tempo pianificato è quasi concluso.
${areasLine}
${snippetsLine}
1. Ringrazia brevemente per i contributi condivisi, facendo un riferimento specifico a qualcosa di concreto emerso.
2. Menziona naturalmente 1-2 aree specifiche che potrebbero essere approfondite.
3. Chiedi UNA sola domanda yes/no per sapere se vuole continuare ancora qualche minuto.
Tono caldo e naturale. Non chiedere contatti. Non porre domande di topic.
`.trim().replace(/\n{3,}/g, '\n') : `
## PHASE: EXTENSION OFFER
The planned interview time is almost over.
${areasLine}
${snippetsLine}
1. Briefly thank for the contributions, with a specific reference to something concrete that emerged.
2. Naturally mention 1-2 specific areas that could still be explored.
3. Ask exactly ONE yes/no question to check if they want to continue a few more minutes.
Warm and natural tone. Do not ask for contacts or topic questions.
`.trim().replace(/\n{3,}/g, '\n');
        }

        // DATA_COLLECTION_CONSENT
        if (status === 'DATA_COLLECTION_CONSENT') {
            return isItalian ? `
## FASE: CONSENSO DATI
L'intervista è conclusa. Ringrazia per la partecipazione.
Chiedi esplicitamente se puoi raccogliere i dati di contatto personali (es. nome ed email) per eventuali follow-up futuri.
La domanda deve riguardare chiaramente la condivisione dei dati personali, NON il proseguire o estendere l'intervista.
Una sola domanda. Nessuna domanda di topic.
`.trim() : `
## PHASE: DATA_COLLECTION_CONSENT
The interview is complete. Thank the participant for their time.
Explicitly ask if you may collect their personal contact information (e.g. name and email) for potential future follow-up.
The question must be clearly about sharing personal data, NOT about continuing or extending the interview.
One question only. No topic questions.
`.trim();
        }

        // DATA_COLLECTION
        if (status === 'DATA_COLLECTION') {
            const rawFields = (bot?.candidateDataFields as any[]) || ['name', 'email'];
            const fieldIds = rawFields.map((value: any) => typeof value === 'string' ? value : (value.id || value.field));
            const formattedChecklist = fieldIds.map((id) => String(id)).join(', ');
            const priorityField = sanitize(supervisorInsight?.nextSubGoal || '', 200).trim();

            return isItalian ? `
## FASE: RACCOLTA DATI
Field IDs canonici: ${formattedChecklist}
Raccogli un campo per volta. ${priorityField ? `Priorità: ${priorityField}.` : ''}
Formula sempre la domanda nella lingua del partecipante, non nella lingua dei field id.
Non dedurre nome da email. Nessun saluto finale finché mancano campi.
Quando completi: chiudi e aggiungi INTERVIEW_COMPLETED.
`.trim() : `
## PHASE: DATA_COLLECTION
Canonical field IDs: ${formattedChecklist}
Collect one field at a time. ${priorityField ? `Priority: ${priorityField}.` : ''}
Always phrase the question in the participant's language, not in the language of the field ids.
Never infer name from email. No goodbye until all fields complete.
When done: close and append INTERVIEW_COMPLETED.
`.trim();
        }

        // COMPLETE_WITHOUT_DATA / FINAL_GOODBYE
        if (status === 'COMPLETE_WITHOUT_DATA' || status === 'FINAL_GOODBYE') {
            return isItalian ? `
## FASE: CHIUSURA
Ringrazia e chiudi cordialmente. Nessuna domanda. Aggiungi INTERVIEW_COMPLETED.
`.trim() : `
## PHASE: CLOSURE
Thank and close politely. No question. Append INTERVIEW_COMPLETED.
`.trim();
        }

        // Default: EXPLORING
        return isItalian ? `
## FASE: ESPLORAZIONE
Fai una breve connessione e UNA sola domanda esplorativa.
`.trim() : `
## PHASE: EXPLORING
Brief connection, then ONE exploratory question.
`.trim();
    }

    /**
     * BLOCK 4: MEMORY
     * Delegates to MemoryManager.formatForPrompt()
     */
    private static async buildMemoryBlock(
        conversation: Conversation,
        interviewerQuality?: string,
        language?: string,
        prefetchedData?: ConversationMemoryData | null
    ): Promise<string | null> {
        try {
            const memory = prefetchedData !== undefined
                ? prefetchedData  // use pre-fetched data (avoids sequential DB call)
                : await MemoryManager.get(conversation.id);
            if (memory && memory.factsCollected.length > 0) {
                return MemoryManager.formatForPrompt(memory, {
                    language: language || 'en',
                    compactStyle: interviewerQuality === 'avanzato'
                        ? 'avanzato'
                        : interviewerQuality === 'standard'
                            ? 'standard'
                            : undefined
                });
            }
        } catch (error) {
            console.error('[PromptBuilder] Memory fetch failed:', error);
        }
        return null;
    }

    /**
     * BLOCK 5: KNOWLEDGE
     * Plan intelligence (interpretationCues, significanceSignals, probeAngles)
     * or manual knowledge guide
     */
    private static buildKnowledgeBlock(
        currentTopic: PlanTopic | null,
        interviewPlan?: InterviewPlan,
        manualGuide?: string,
        language?: string,
        interviewerQuality?: string
    ): string {
        if (!currentTopic) return '';
        const isAvanzato = interviewerQuality === 'avanzato';
        const isItalian = String(language || 'en').toLowerCase().startsWith('it');
        const guideLimit = isAvanzato ? 420 : 700;
        const cueLimit = isAvanzato ? 1 : 2;
        const cueTextLimit = isAvanzato ? 160 : 220;

        // Manual knowledge takes precedence
        if (manualGuide) {
            const compactGuide = sanitize(String(manualGuide || '').replace(/\s+/g, ' ').trim(), guideLimit);
            return isItalian
                ? `## GUIDA TOPIC\n${compactGuide}`
                : `## TOPIC GUIDE\n${compactGuide}`;
        }

        // Use plan intelligence (LLM-generated content — sanitize as user data)
        if (currentTopic.interpretationCues && currentTopic.significanceSignals && currentTopic.probeAngles) {
            const cues = currentTopic.interpretationCues.filter(Boolean).map(c => sanitize(c, cueTextLimit));
            const signals = currentTopic.significanceSignals.filter(Boolean).map(s => sanitize(s, cueTextLimit));
            const angles = currentTopic.probeAngles.filter(Boolean).map(a => sanitize(a, cueTextLimit));

            if (cues.length === 0 && signals.length === 0 && angles.length === 0) {
                return '';
            }

            const parts = [];

            if (cues.length > 0) {
                const label = isItalian ? 'INTERPRETAZIONI:' : 'INTERPRETATIONS:';
                parts.push(`${label} ${cues.slice(0, cueLimit).join(' | ')}`);
            }
            if (signals.length > 0) {
                const label = isItalian ? 'SEGNALI:' : 'SIGNALS:';
                parts.push(`${label} ${signals.slice(0, cueLimit).join(' | ')}`);
            }
            if (angles.length > 0) {
                const label = isItalian ? 'ANGOLI:' : 'ANGLES:';
                parts.push(`${label} ${angles.slice(0, cueLimit).join(' | ')}`);
            }

            const strategicTopicSummary = [
                `Topic importance: ${currentTopic.importanceBand} (${currentTopic.importanceScore})`,
                `Planned coverage: target=${currentTopic.targetSubGoalCount}/${currentTopic.fullCoverageSubGoalCount}, stretch=${currentTopic.stretchSubGoalCount}/${currentTopic.fullCoverageSubGoalCount}`,
                `Editorial order stays fixed. Use grading only to decide what is core, stretch, or marginal.`
            ];

            const keySubGoals = (currentTopic.subGoalPlans || [])
                .filter((subGoal) => subGoal.enabled && subGoal.coverageTier !== 'disabled')
                .sort((a, b) => a.editorialOrderIndex - b.editorialOrderIndex)
                .slice(0, 5)
                .map((subGoal) => `${sanitize(subGoal.label, 140)} [${subGoal.coverageTier}|${subGoal.importanceBand}]`);

            return `\n## KNOWLEDGE - ${sanitizeConfig(currentTopic.label, 200)}\n${strategicTopicSummary.join('\n')}\n${keySubGoals.length > 0 ? `Sub-goals: ${keySubGoals.join(' | ')}\n` : ''}${parts.join('\n')}`;
        }

        return '';
    }

    /**
     * BLOCK 5.5: AVANZATO QUALITATIVE METHODOLOGY
     * Only injected for avanzato tier. Adds deep qualitative interviewing rules.
     */
    private static buildAvanzatoMethodologyBlock(language: string): string {
        const isItalian = String(language || 'en').toLowerCase().startsWith('it');

        return isItalian ? `
## MODALITÀ QUALITATIVA PROFONDA
- Riconosci una sfumatura concreta della risposta, senza opener vuoti come "Interessante!".
- Preferisci domande aperte, narrative e specifiche; evita scale numeriche.
- Se l'utente esita, chiarisci o rendi la domanda più concreta.
- Se emerge un collegamento con un tema precedente, integralo brevemente.
- Valuta sempre il delta tra l'ultimo messaggio utente e il contesto storico disponibile.
- Se l'ultimo messaggio apre una direzione nuova e rilevante per il topic o per l'obiettivo dell'intervista, fai un follow-up su quel punto.
- Se l'ultimo messaggio NON apre una direzione nuova davvero rilevante, non forzare un follow-up: prosegui con il sub-goal o topic successivo e usa il contesto storico solo per rendere la domanda più precisa.
- Se noti fatica o risposte brevi, accorcia e semplifica.
`.trim() : `
## DEEP QUALITATIVE MODE
- Acknowledge one concrete nuance from the answer; avoid empty openers like "Interesting!".
- Prefer open, narrative, specific questions; avoid numeric scales.
- If the user hesitates, clarify or make the question more concrete.
- If a cross-topic link emerges, weave it in briefly.
- Always evaluate the delta between the latest user message and the historical context available.
- If the latest message opens a new direction that is relevant to the topic or interview objective, follow up on that direction.
- If the latest message does NOT open a genuinely relevant new direction, do not force a follow-up: continue with the next sub-goal or topic and use historical context only to sharpen the question.
- If the user shows fatigue, shorten and simplify.
`.trim();
    }

    /**
     * Build the static prompt (blocks 1-5, optionally 5.5)
     * Blocks 6 (Turn Guidance) and 7 (Guards) are added at runtime in route.ts
     */
    static async build(
        bot: Bot & { knowledgeSources?: KnowledgeSource[], topics: TopicBlock[], rewardConfig?: any },
        conversation: Conversation,
        currentTopic: TopicBlock | null,
        effectiveDurationSeconds: number,
        supervisorInsight?: SupervisorInsight,
        interviewPlan?: InterviewPlan,
        manualKnowledgeGuide?: string,
        interviewerQuality?: string,
        prefetchedMemoryData?: ConversationMemoryData | null  // NEW
    ): Promise<string> {
        const isAvanzato = interviewerQuality === 'avanzato';
        const isDataCollection = supervisorInsight?.status === 'DATA_COLLECTION_CONSENT'
            || supervisorInsight?.status === 'DATA_COLLECTION';
        const parts: string[] = [];

        // Block 1: Identity
        parts.push(this.buildIdentityBlock(bot, interviewerQuality));

        // Block 2: Interview Context
        parts.push(this.buildInterviewContextBlock(conversation, bot, effectiveDurationSeconds, interviewerQuality));

        // Block 3: Topic Focus — skip during DATA_COLLECTION phases (topic focus is irrelevant)
        if (!isDataCollection) {
            parts.push(this.buildTopicFocusBlock(currentTopic, bot.topics, supervisorInsight, bot));
        }

        // Block 4: Memory
        const memory = await this.buildMemoryBlock(conversation, interviewerQuality, bot.language, prefetchedMemoryData);
        if (memory) parts.push(memory);

        // Block 5: Knowledge
        const planTopic = currentTopic && interviewPlan
            ? (interviewPlan.explore?.topics || []).find(t => t.topicId === currentTopic.id)
            : null;
        const knowledge = this.buildKnowledgeBlock(planTopic || null, interviewPlan, manualKnowledgeGuide, bot.language, interviewerQuality);
        if (knowledge) parts.push(knowledge);

        // Block 5.5: Avanzato Qualitative Methodology (only for avanzato, not during DATA_COLLECTION)
        if (isAvanzato && !isDataCollection) {
            parts.push(this.buildAvanzatoMethodologyBlock(bot.language));
        }

        return parts.join('\n\n');
    }
}

/**
 * Integrates validation feedback into the system prompt
 * This function adds feedback context that guides the bot on how to respond
 * when previous input validation failed.
 *
 * @param basePrompt - The base system prompt
 * @param validationFeedback - Optional validation response with feedback
 * @param language - Language for feedback section ('it' or 'en')
 * @returns Enhanced prompt with validation feedback section, or base prompt if no feedback
 */
export function addValidationFeedbackToPrompt(
  basePrompt: string,
  validationFeedback?: ValidationResponse,
  language: 'it' | 'en' = 'it'
): string {
  if (!validationFeedback || validationFeedback.isValid) {
    return basePrompt;
  }

  // Validation feedback may contain user-influenced content — sanitize
  const safeFeedback = sanitize(validationFeedback.feedback || '', 500);
  const safeStrategy = sanitize(validationFeedback.strategy || '', 200);

  const feedbackSection = language === 'it'
    ? `\n\n⚠️ FEEDBACK IMPORTANTE: L'utente ha fornito una risposta che non è stata compresa correttamente.\nMessaggio da comunicare: "${safeFeedback}"\nStrategia: ${safeStrategy || 'chiedi di nuovo'}.\n`
    : `\n\n⚠️ IMPORTANT FEEDBACK: The user provided a response that wasn't understood correctly.\nMessage to communicate: "${safeFeedback}"\nStrategy: ${safeStrategy || 'ask again'}.\n`;

  return basePrompt + feedbackSection;
}

/**
 * Build CIL context block (Block 6.5) — avanzato only.
 * Returns empty string for other tiers or when nothing meaningful to show.
 */
export function buildCILContextBlock(
    analysis: CILAnalysis,
    cilState: CILState | null,
    interviewerQuality: string,
    options?: {
        latestUserMessage?: string | null;
        freshness?: 'fresh' | 'stale';
    }
): string {
    if (interviewerQuality !== 'avanzato') return '';

    const highThreads = analysis.openThreads.filter(t => t.strength === 'high');
    const mediumThreads = analysis.openThreads.filter(t => t.strength === 'medium');
    const themes = analysis.emergingThemes;
    const lra = analysis.lastResponseAnalysis;
    const latestUserMessage = sanitize(options?.latestUserMessage || '', 280);
    const freshness = options?.freshness || 'fresh';
    const hasMaterial = highThreads.length > 0 || themes.length > 0 ||
        lra.activeHypotheses.length > 0 || lra.contradictionFlags.length > 0 ||
        lra.interruptedThoughts.length > 0 || lra.emotionalCues.length > 0;

    if (!hasMaterial) return '';

    const lines: string[] = ['=== CONVERSATIONAL INTELLIGENCE ==='];

    if (highThreads.length > 0 || mediumThreads.length > 0) {
        lines.push('\nOpen threads:');
        for (const t of highThreads) {
            const hyp = t.anchoredHypothesis ? ` → ${t.anchoredHypothesis}` : '';
            lines.push(`• [HIGH] "${t.description}"${hyp}`);
        }
        for (const t of mediumThreads) {
            lines.push(`• [MEDIUM] "${t.description}"`);
        }
    }

    if (themes.length > 0) {
        lines.push(`\nEmerging themes: ${themes.join(' · ')}`);
    }

    const signals = [
        ...lra.activeHypotheses.map(h => `Hypothesis taking shape: ${sanitize(h, 200)}`),
        ...lra.contradictionFlags.map(f => `Contradiction: ${sanitize(f, 200)}`),
        ...lra.emotionalCues.map(c => sanitize(c, 200)),
        ...lra.interruptedThoughts.map(t => `Interrupted: ${sanitize(t, 200)}`)
    ].filter(Boolean).slice(0, 4);

    if (signals.length > 0) {
        lines.push('\nLast response — signals:');
        for (const s of signals) lines.push(`• ${s}`);
    }

    lines.push('\nUse policy:');
    lines.push('• Treat this CIL block as historical memory, not as the final truth of the current turn.');
    lines.push('• Before asking the next question, evaluate how the latest participant message confirms, weakens, contradicts, or redirects these threads.');
    lines.push('• If the latest participant message opens a new concrete angle that is relevant to the topic or interview objective, prioritize that angle and follow up on it.');
    lines.push('• If the latest participant message does not open a genuinely relevant new angle, do not force a follow-up: follow the supervisor/micro-planner progression and use older threads only to sharpen the next single question.');
    if (freshness === 'stale') {
        const lastUpdatedTurnIndex = typeof cilState?.lastUpdatedTurnIndex === 'number'
            ? cilState.lastUpdatedTurnIndex
            : null;
        const freshnessLine = lastUpdatedTurnIndex && lastUpdatedTurnIndex > 0
            ? `Historical snapshot: this CIL memory was last updated before the current participant message (last merged turn: ${lastUpdatedTurnIndex}).`
            : 'Historical snapshot: this CIL memory was last updated before the current participant message.';
        lines.push(`• ${freshnessLine}`);
    }
    if (latestUserMessage) {
        lines.push(`• Latest participant message to evaluate now: "${latestUserMessage}"`);
    }

    lines.push(`\nSuggested move: ${analysis.suggestedMove}`);
    lines.push('===');

    return lines.join('\n');
}

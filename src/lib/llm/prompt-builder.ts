
import { Bot, Conversation, TopicBlock, KnowledgeSource } from '@prisma/client';
import { MemoryManager } from '@/lib/memory/memory-manager';
import type { SupervisorInsight } from '@/lib/interview/interview-supervisor';
import type { InterviewPlan, PlanTopic } from '@/lib/interview/plan-types';
import type { ValidationResponse } from '@/lib/interview/validation-response';
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

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
     * BLOCK 1: IDENTITY
     * WHO the interviewer is + base rules (stated ONCE)
     * Consolidates: buildPersonaPrompt + methodology rules
     */
    private static buildIdentityBlock(
        bot: Bot & { knowledgeSources?: KnowledgeSource[]; rewardConfig?: any }
    ): string {
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');

        // Sanitize admin-configured fields before prompt interpolation
        const safeName = sanitizeConfig(bot.name);
        const safeGoal = sanitizeConfig(bot.researchGoal);
        const safeAudience = sanitizeConfig(bot.targetAudience);
        const safeTone = sanitizeConfig(bot.tone);

        const knowledgeText = (bot.knowledgeSources || [])
            .slice(0, 3)
            .map((source) => {
                const title = sanitizeConfig(source.title || 'Untitled', 200);
                const preview = sanitizeConfig(
                    String(source.content || '').replace(/\s+/g, ' ').trim(),
                    260
                );
                return `- ${title}: ${preview}${preview.length >= 260 ? '…' : ''}`;
            })
            .join('\n');

        return isItalian ? `
## IDENTITÀ & REGOLE BASE
Sei "${safeName}", una ricerca qualitativa.
Ruolo: Intervistatore esperienza
Missione: "${safeGoal}"
Pubblico: "${safeAudience}"
Tono: "${safeTone || 'Amichevole, professionale, empatico'}"
Lingua: Italiano

## TUA IDENTITÀ
- Sei "${safeName}", conducendo una ricerca qualitativa.
- La persona con cui parli è l'INTERVISTATO — che condivide esperienza e opinioni.
- Non assumere il loro ruolo (partecipante, creatore, cliente) a meno che esplicitamente dichiarato.
- Non dire "Il tuo progetto" a meno che specificamente configurato.
- Raccogli la loro prospettiva onesta su i temi dell'intervista.

## REGOLE FONDAMENTALI (SEMPRE)
1. Una sola domanda per turno.
2. Nessun contatto fuori da DATA_COLLECTION.
3. Nessuna promo, link, o CTA.
4. Ogni risposta termina con "?".
5. Mantieni lingua e tono consistenti.
6. No a ripetizioni letterali di domande precedenti.

## KNOWLEDGE BASE
${knowledgeText}
`.trim() : `
## IDENTITY & BASE RULES
You are "${safeName}", conducting qualitative research.
Role: Expert interviewer
Mission: "${safeGoal}"
Audience: "${safeAudience}"
Tone: "${safeTone || 'Friendly, professional, empathetic'}"
Language: English

## YOUR IDENTITY
- You are "${safeName}", conducting qualitative research.
- The person you are talking to is the INTERVIEWEE — someone sharing their experience and opinions.
- DO NOT assume their role (participant, creator, customer) unless explicitly stated.
- DO NOT say "Your project" unless specifically configured.
- Gather their honest perspective on the interview topics.

## FUNDAMENTAL RULES (ALWAYS)
1. One question per turn.
2. No contact requests outside DATA_COLLECTION.
3. No promo, links, or CTA.
4. Every response ends with "?".
5. Keep language and tone consistent.
6. Avoid literal repetition of previous questions.

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
        effectiveDurationSeconds: number
    ): string {
        const isItalian = String(bot.language || 'en').toLowerCase().startsWith('it');
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
        const topicLines = allTopics.map((t, idx) => {
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
            return isItalian ? `
## FASE: ESPLORAZIONE${bonus}
Topic: "${safeTopicLabel}"
Sub-goal: ${subGoalPreview}
Metodo: Fai una breve connessione e UNA sola domanda esplorativa. Ascolta segnali di profondità (esempi, impatti, vincoli).
`.trim() : `
## PHASE: EXPLORING${bonus}
Topic: "${safeTopicLabel}"
Sub-goal: ${subGoalPreview}
Method: Brief connection, then ONE exploratory question. Listen for depth signals (examples, impact, constraints).
`.trim();
        }

        // TRANSITION
        if (status === 'TRANSITION') {
            const nextIndex = allTopics.findIndex(t => t.id === currentTopic.id) + 1;
            const nextTopic = nextIndex < allTopics.length ? allTopics[nextIndex] : null;
            const safeCurrentLabel = sanitizeConfig(currentTopic.label, 200);
            const nextLabel = sanitizeConfig(nextTopic?.label, 200) || (isItalian ? 'Chiusura' : 'Closure');
            return isItalian ? `
## FASE: TRANSIZIONE
Stai per spostarti da "${safeCurrentLabel}" a "${nextLabel}".
Fai un ponte breve e naturale, poi UNA domanda di apertura per il nuovo topic.
`.trim() : `
## PHASE: TRANSITION
Moving from "${safeCurrentLabel}" to "${nextLabel}".
Brief natural bridge, then ONE opening question for the next topic.
`.trim();
        }

        // DEEPENING
        if (status === 'DEEPENING') {
            // engagingSnippet originates from conversation analysis — sanitize as user data
            const engagingSnippet = sanitize(supervisorInsight?.engagingSnippet || '', 500).trim();
            const safeLabel = sanitizeConfig(currentTopic.label, 200);
            return isItalian ? `
## FASE: APPROFONDIMENTO
Topic: "${safeLabel}"
${engagingSnippet ? `Spunto chiave: "${engagingSnippet}"` : ''}
Approfondisci i segnali significativi. Una sola domanda focalizzata.
`.trim() : `
## PHASE: DEEPENING
Topic: "${safeLabel}"
${engagingSnippet ? `Key insight: "${engagingSnippet}"` : ''}
Deepen significant signals. One focused question.
`.trim();
        }

        // DEEP_OFFER_ASK
        if (status === 'DEEP_OFFER_ASK') {
            return isItalian ? `
## FASE: OFFERTA ESTENSIONE
Il tempo è quasi concluso.
Offri di continuare per alcuni minuti. Una sola domanda yes/no, tono naturale.
Non chiedere contatti. Non porre domande di topic.
`.trim() : `
## PHASE: EXTENSION OFFER
Time is almost up.
Offer to continue for a few minutes. One yes/no question, natural tone.
Do not ask for contacts or topic questions.
`.trim();
        }

        // DATA_COLLECTION_CONSENT
        if (status === 'DATA_COLLECTION_CONSENT') {
            return isItalian ? `
## FASE: CONSENSO DATI
L'intervista contenutistica è conclusa.
Ringrazia brevemente. Chiedi il consenso per raccogliere i contatti.
Una sola domanda, nessuna domanda di topic.
`.trim() : `
## PHASE: DATA_COLLECTION_CONSENT
The content interview is complete.
Thank briefly. Ask permission to collect contact details.
One question only, no topic questions.
`.trim();
        }

        // DATA_COLLECTION
        if (status === 'DATA_COLLECTION') {
            const rawFields = (bot?.candidateDataFields as any[]) || ['name', 'email'];
            const fieldIds = rawFields.map((value: any) => typeof value === 'string' ? value : (value.id || value.field));
            const formattedChecklist = fieldIds.map((id) => {
                const label = FIELD_LABELS[id];
                return label ? (isItalian ? label.it : label.en) : String(id);
            }).join(', ');
            const priorityField = sanitize(supervisorInsight?.nextSubGoal || '', 200).trim();

            return isItalian ? `
## FASE: RACCOLTA DATI
Campi: ${formattedChecklist}
Raccogli un campo per volta. ${priorityField ? `Priorità: ${priorityField}.` : ''}
Non dedurre nome da email. Nessun saluto finale finché mancano campi.
Quando completi: chiudi e aggiungi INTERVIEW_COMPLETED.
`.trim() : `
## PHASE: DATA_COLLECTION
Fields: ${formattedChecklist}
Collect one field at a time. ${priorityField ? `Priority: ${priorityField}.` : ''}
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
    private static async buildMemoryBlock(conversation: Conversation): Promise<string | null> {
        try {
            const memory = await MemoryManager.get(conversation.id);
            if (memory && memory.factsCollected.length > 0) {
                return MemoryManager.formatForPrompt(memory);
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
        language?: string
    ): string {
        if (!currentTopic) return '';

        // Manual knowledge takes precedence
        if (manualGuide) {
            return manualGuide;
        }

        // Use plan intelligence (LLM-generated content — sanitize as user data)
        if (currentTopic.interpretationCues && currentTopic.significanceSignals && currentTopic.probeAngles) {
            const cues = currentTopic.interpretationCues.filter(Boolean).map(c => sanitize(c, 300));
            const signals = currentTopic.significanceSignals.filter(Boolean).map(s => sanitize(s, 300));
            const angles = currentTopic.probeAngles.filter(Boolean).map(a => sanitize(a, 300));

            if (cues.length === 0 && signals.length === 0 && angles.length === 0) {
                return '';
            }

            const isItalian = String(language || 'en').toLowerCase().startsWith('it');
            const parts = [];

            if (cues.length > 0) {
                const label = isItalian ? 'INTERPRETAZIONI:' : 'INTERPRETATIONS:';
                parts.push(`${label} ${cues.join(' | ')}`);
            }
            if (signals.length > 0) {
                const label = isItalian ? 'SEGNALI:' : 'SIGNALS:';
                parts.push(`${label} ${signals.join(' | ')}`);
            }
            if (angles.length > 0) {
                const label = isItalian ? 'ANGOLI:' : 'ANGLES:';
                parts.push(`${label} ${angles.join(' | ')}`);
            }

            return `\n## KNOWLEDGE - ${sanitizeConfig(currentTopic.label, 200)}\n${parts.join('\n')}`;
        }

        return '';
    }

    /**
     * Build the static prompt (blocks 1-5)
     * Blocks 6 (Turn Guidance) and 7 (Guards) are added at runtime in route.ts
     */
    static async build(
        bot: Bot & { knowledgeSources?: KnowledgeSource[], topics: TopicBlock[], rewardConfig?: any },
        conversation: Conversation,
        currentTopic: TopicBlock | null,
        effectiveDurationSeconds: number,
        supervisorInsight?: SupervisorInsight,
        interviewPlan?: InterviewPlan,
        manualKnowledgeGuide?: string
    ): Promise<string> {
        const parts: string[] = [];

        // Block 1: Identity
        parts.push(this.buildIdentityBlock(bot));

        // Block 2: Interview Context
        parts.push(this.buildInterviewContextBlock(conversation, bot, effectiveDurationSeconds));

        // Block 3: Topic Focus
        parts.push(this.buildTopicFocusBlock(currentTopic, bot.topics, supervisorInsight, bot));

        // Block 4: Memory
        const memory = await this.buildMemoryBlock(conversation);
        if (memory) parts.push(memory);

        // Block 5: Knowledge
        const planTopic = currentTopic && interviewPlan
            ? (interviewPlan.explore?.topics || []).find(t => t.topicId === currentTopic.id)
            : null;
        const knowledge = this.buildKnowledgeBlock(planTopic || null, interviewPlan, manualKnowledgeGuide, bot.language);
        if (knowledge) parts.push(knowledge);

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

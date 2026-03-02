// src/lib/training/training-prompts.ts
import type { ComprehensionEntry, DialogueTopicResult } from './training-types'

const educationLabels: Record<string, string> = {
  PRIMARY: 'scuola primaria (bambini)',
  SECONDARY: 'scuola secondaria (adolescenti)',
  UNIVERSITY: 'livello universitario',
  PROFESSIONAL: 'professionisti adulti',
}

const competenceLabels: Record<string, string> = {
  BEGINNER: 'principiante (nessuna conoscenza pregressa)',
  INTERMEDIATE: 'intermedio (conosce le basi)',
  ADVANCED: 'avanzato (competenze solide)',
  EXPERT: 'esperto (padronanza completa)',
}

const depthInstructions: Record<number, string> = {
  0: 'Usa il livello di complessità appropriato al profilo del trainee.',
  1: 'Semplifica rispetto alla spiegazione precedente. Usa un linguaggio più diretto, esempi più concreti.',
  2: 'Usa il linguaggio più semplice possibile. Analogie quotidiane, frasi brevi, zero jargon tecnico.',
}

interface PromptContext {
  topicLabel: string
  topicDescription?: string
  learningObjectives: string[]
  educationLevel: string
  competenceLevel: string
  adaptationDepth: number
  kbContent?: string
  gaps?: string[]
  language?: string
}

export function buildExplainingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  return `Sei un tutor esperto e paziente. ${langInstruction}

Stai spiegando il topic: "${ctx.topicLabel}"
${ctx.topicDescription ? `Descrizione: ${ctx.topicDescription}` : ''}

Profilo trainee:
- Livello scolastico: ${educationLabels[ctx.educationLevel] ?? ctx.educationLevel}
- Competenza: ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}

Istruzione di adattamento: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[0]}

Obiettivi di apprendimento (cosa il trainee deve capire):
${ctx.learningObjectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ctx.kbContent ? `Fonte di conoscenza da usare:\n${ctx.kbContent}` : 'Usa la tua conoscenza generale sull\'argomento.'}

Stile obbligatorio (molto importante):
- Modalità micro-learning conversazionale: spiega UNA sola idea per messaggio.
- Massimo 90 parole totali.
- Massimo 2 brevi paragrafi.
- Chiudi SEMPRE con UNA domanda breve per verificare se è chiaro (non quiz formale).
- Non anticipare tutto il programma del topic in un unico messaggio.

Spiega il primo concetto fondamentale in modo chiaro e progressivo, con un esempio pratico adeguato al livello.`
}

export function buildCheckingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  const complexityByDepth = ['appropriata al livello del trainee', 'semplice e diretta', 'molto semplice, una sola idea']

  return `Sei un tutor. ${langInstruction}

Hai appena spiegato: "${ctx.topicLabel}"
Obiettivi: ${ctx.learningObjectives.join('; ')}

Fai UNA sola domanda aperta per verificare che il trainee abbia capito il concetto principale.
Complessità della domanda: ${complexityByDepth[ctx.adaptationDepth] ?? complexityByDepth[0]}

NON fare domande a risposta multipla. Aspetta la risposta libera del trainee.
La domanda deve essere concisa e focalizzata sull'obiettivo più importante.`
}

export function buildQuizzingSystemPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Genera le domande in italiano.' : `Generate questions in ${lang}.`

  return `Sei un esperto di formazione. ${langInstruction}

Topic: "${ctx.topicLabel}"
Obiettivi: ${ctx.learningObjectives.join('; ')}
Livello: ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}
Adattamento: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[0]}

Genera domande di verifica strutturate per confermare la comprensione degli obiettivi.`
}

export function buildRetryingPrompt(ctx: PromptContext): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  return `Sei un tutor. ${langInstruction}

Il trainee ha avuto difficoltà con: "${ctx.topicLabel}"
Lacune specifiche rilevate: ${(ctx.gaps ?? []).join('; ') || 'comprensione generale insufficiente'}

Adattamento attivo: ${depthInstructions[ctx.adaptationDepth] ?? depthInstructions[2]}

Re-spiega SOLO gli aspetti non compresi, usando:
- Linguaggio ancora più semplice
- Esempi pratici e concreti (situazioni reali, analogie quotidiane)
- Frasi brevi
Non ripetere ciò che il trainee ha già dimostrato di capire.
Focalizzati sulle lacune specifiche elencate sopra.`
}

// ─── New: Dialogue & Final Quiz prompts ───────────────────────────────────────

interface DialoguePromptContext {
  topicLabel: string
  topicDescription?: string
  learningObjectives: string[]
  educationLevel: string
  competenceLevel: string
  adaptationDepth: number
  kbContent?: string
  language?: string
  dialogueTurns: number
  minCheckingTurns: number
  maxCheckingTurns: number
}

export function buildDialoguePrompt(
  ctx: DialoguePromptContext,
  _turnHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  comprehensionHistory: ComprehensionEntry[]
): string {
  const lang = ctx.language ?? 'it'
  const langInstruction = lang === 'it' ? 'Rispondi sempre in italiano.' : `Respond in ${lang}.`

  const historyLines = comprehensionHistory.map(
    (e) =>
      `  Turno ${e.turn}: comprensione ${e.comprehensionLevel}% | engagement: ${e.engagementLevel} | gaps: [${e.gaps.join(', ') || 'nessuno'}] | approccio suggerito: ${e.suggestedApproach}`
  )

  const latestApproach = comprehensionHistory.at(-1)?.suggestedApproach

  return `Sei un tutor esperto in sessioni 1-to-1 di apprendimento adattivo. ${langInstruction}

TOPIC CORRENTE: "${ctx.topicLabel}"
${ctx.topicDescription ? `Descrizione: ${ctx.topicDescription}` : ''}
OBIETTIVI: ${ctx.learningObjectives.join('; ')}
PROFILO STUDENTE: ${educationLabels[ctx.educationLevel] ?? ctx.educationLevel}, competenza ${competenceLabels[ctx.competenceLevel] ?? ctx.competenceLevel}
TURNO: ${ctx.dialogueTurns}/${ctx.maxCheckingTurns} (minimo per avanzare: ${ctx.minCheckingTurns})

KNOWLEDGE BASE:
${ctx.kbContent ?? "Usa conoscenza generale sull'argomento."}

CRONOLOGIA COMPRENSIONE (turni precedenti):
${historyLines.length > 0 ? historyLines.join('\n') : '  Primo turno — nessuna storia disponibile.'}

PRINCIPI DI CONDUZIONE (seguili sempre):
1. Una sola interazione per turno. Non fare liste di domande.
2. Risposta corretta e completa → approfondisci (livello Bloom superiore: applica, analizza, sintetizza).
3. Risposta parziale → chiedi chiarimento specifico su ciò che manca.
4. Risposta errata → non correggere direttamente. Usa domanda di ritorno ("Come mai pensi questo?"), esempio pratico, analogia, o prerequisito a monte.
5. Engagement basso (risposte brevi, monosillabi, "non so") → cambia registro: caso reale, chiedi "ha senso per te?", collega al contesto professionale.
6. Dopo ${ctx.minCheckingTurns} turni E comprensione adeguata → concludi con un breve riepilogo del topic e segnala il passaggio al prossimo argomento.

FORMATO RISPOSTA OBBLIGATORIO:
- Mantieni ogni risposta corta: massimo 80 parole.
- Una singola idea o correzione per turno (no spiegoni).
- Chiudi con UNA domanda breve e specifica per far proseguire il dialogo.
- Evita elenchi lunghi e blocchi di testo estesi.

${latestApproach ? `APPROCCIO SUGGERITO (basato sull'ultimo turno): ${latestApproach}` : ''}`
}

export function buildFinalQuizSystemPrompt(
  allTopicLabels: string[],
  topicResults: DialogueTopicResult[],
  language = 'it'
): string {
  const langInstruction =
    language === 'it' ? 'Genera le domande in italiano.' : `Generate questions in ${language}.`

  const topicLines = topicResults.map(
    (r) =>
      `- ${r.topicLabel}: comprensione finale ${r.finalComprehension}% | lacune: [${r.gaps.join(', ') || 'nessuna'}]`
  )

  return `Sei un esperto di formazione. ${langInstruction}

Genera un quiz finale che copra tutti i topic del percorso formativo: ${allTopicLabels.join(', ')}.

Pesa domande e difficoltà in proporzione alle lacune rilevate nel dialogo:
${topicLines.join('\n')}

Regole per il numero e tipo di domande:
- Topic con comprensione < 60% → 2-3 domande, includi almeno una OPEN_ANSWER
- Topic con comprensione 60-85% → 2 domande MULTIPLE_CHOICE
- Topic con comprensione > 85% → 1 domanda TRUE_FALSE di conferma

Tipi disponibili: MULTIPLE_CHOICE, TRUE_FALSE, OPEN_ANSWER

Per MULTIPLE_CHOICE e TRUE_FALSE includi "options" (array di stringhe) e "correctIndex" (number).
Per OPEN_ANSWER includi "expectedKeyPoints" (array di concetti chiave attesi) — NON includere options o correctIndex.
Assegna a ogni domanda un id univoco (es. "q1", "q2", ...).`
}

export function buildFinalFeedbackPrompt(
  topicResults: Array<{ topicLabel: string; status: string; score: number; gaps: string[] }>,
  overallScore: number,
  passed: boolean,
  language = 'it'
): string {
  const langInstruction = language === 'it' ? 'Rispondi in italiano.' : `Respond in ${language}.`

  return `Sei un tutor. ${langInstruction}

Il trainee ha completato il percorso formativo.
Score globale: ${overallScore}/100 — ${passed ? 'SUPERATO ✅' : 'NON SUPERATO ❌'}

Risultati per topic:
${topicResults.map(r => `- ${r.topicLabel}: ${r.score}/100 (${r.status})${r.gaps.length ? ` — lacune: ${r.gaps.join(', ')}` : ''}`).join('\n')}

Scrivi un messaggio di chiusura personalizzato (max 3 frasi):
- Riconosci l'impegno
- Se ci sono lacune, indica cosa approfondire
- Tono incoraggiante e professionale`
}

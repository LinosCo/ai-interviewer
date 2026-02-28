// src/lib/training/training-prompts.ts

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

Spiega il concetto in modo chiaro e progressivo. Usa esempi pratici adeguati al livello.
Alla fine, indica che sei pronto a verificare la comprensione.`
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

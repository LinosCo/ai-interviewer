# Fase 4: Adattività del Tono e Follow-up Proattivi

## Obiettivo

L'AI deve adattarsi allo stile comunicativo dell'utente (formale/informale, breve/verboso) e offrire suggerimenti proattivi invece di rispondere passivamente con "cosa intendi?".

---

## 1. Sistema di Tone Mirroring

### Principio

Un intervistatore esperto "legge la stanza" e si adatta. Se l'utente usa un linguaggio formale, rispondiamo formalmente. Se è colloquiale, lo siamo anche noi. Se le risposte sono brevi, facciamo domande più dirette.

### File: src/lib/tone/tone-analyzer.ts

```typescript
export interface ToneProfile {
  register: 'formal' | 'neutral' | 'casual';
  verbosity: 'brief' | 'moderate' | 'verbose';
  emotionality: 'reserved' | 'balanced' | 'expressive';
  usesEmoji: boolean;
  avgWordCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

interface ToneSignals {
  formalIndicators: string[];
  casualIndicators: string[];
  emojiCount: number;
  punctuationStyle: 'minimal' | 'standard' | 'expressive';
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
}

/**
 * Analizza il tono di un messaggio utente
 */
export function analyzeTone(message: string): ToneSignals {
  const text = message.trim();
  
  // Indicatori formali
  const formalPatterns = [
    /\bLei\b/,
    /\bVoi\b/,
    /cortesemente/i,
    /gentilmente/i,
    /\bprego\b/i,
    /distinti saluti/i,
    /cordiali saluti/i,
    /\bdesidero\b/i,
    /\britengo\b/i,
    /\bsottoscritto\b/i
  ];
  
  // Indicatori casuali
  const casualPatterns = [
    /\bhaha\b/i,
    /\blol\b/i,
    /\bok\b/i,
    /\byep\b/i,
    /\bnope\b/i,
    /\bboh\b/i,
    /\bmah\b/i,
    /\bfigo\b/i,
    /\btipo\b/i,
    /\binsomma\b/i,
    /\bcioè\b/i,
    /!/g
  ];
  
  const formalIndicators = formalPatterns
    .filter(p => p.test(text))
    .map(p => p.source);
    
  const casualIndicators = casualPatterns
    .filter(p => p.test(text))
    .map(p => p.source);
  
  // Emoji
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiRegex) || []).length;
  
  // Punteggiatura
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const ellipsis = (text.match(/\.\.\./g) || []).length;
  
  let punctuationStyle: 'minimal' | 'standard' | 'expressive' = 'standard';
  if (exclamations > 2 || ellipsis > 1 || emojiCount > 0) {
    punctuationStyle = 'expressive';
  } else if (exclamations === 0 && questions <= 1) {
    punctuationStyle = 'minimal';
  }
  
  // Conteggi
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  return {
    formalIndicators,
    casualIndicators,
    emojiCount,
    punctuationStyle,
    sentenceCount: sentences.length,
    wordCount: words.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0
  };
}

/**
 * Costruisce un profilo di tono aggregato da più messaggi
 */
export function buildToneProfile(messages: string[]): ToneProfile {
  if (messages.length === 0) {
    return getDefaultProfile();
  }
  
  const analyses = messages.map(analyzeTone);
  
  // Aggregazione
  const totalFormal = analyses.reduce((sum, a) => sum + a.formalIndicators.length, 0);
  const totalCasual = analyses.reduce((sum, a) => sum + a.casualIndicators.length, 0);
  const totalEmoji = analyses.reduce((sum, a) => sum + a.emojiCount, 0);
  const totalWords = analyses.reduce((sum, a) => sum + a.wordCount, 0);
  const avgWords = totalWords / messages.length;
  const avgWordsPerSentence = analyses.reduce((sum, a) => sum + a.avgWordsPerSentence, 0) / analyses.length;
  
  // Determina register
  let register: ToneProfile['register'] = 'neutral';
  if (totalFormal > totalCasual + 2) {
    register = 'formal';
  } else if (totalCasual > totalFormal + 2) {
    register = 'casual';
  }
  
  // Determina verbosity
  let verbosity: ToneProfile['verbosity'] = 'moderate';
  if (avgWords < 15) {
    verbosity = 'brief';
  } else if (avgWords > 50) {
    verbosity = 'verbose';
  }
  
  // Determina emotionality
  const expressiveCount = analyses.filter(a => a.punctuationStyle === 'expressive').length;
  let emotionality: ToneProfile['emotionality'] = 'balanced';
  if (expressiveCount > messages.length * 0.6) {
    emotionality = 'expressive';
  } else if (expressiveCount < messages.length * 0.2) {
    emotionality = 'reserved';
  }
  
  // Complessità linguistica
  let complexity: ToneProfile['complexity'] = 'moderate';
  if (avgWordsPerSentence < 8) {
    complexity = 'simple';
  } else if (avgWordsPerSentence > 20) {
    complexity = 'complex';
  }
  
  return {
    register,
    verbosity,
    emotionality,
    usesEmoji: totalEmoji > 0,
    avgWordCount: Math.round(avgWords),
    complexity
  };
}

function getDefaultProfile(): ToneProfile {
  return {
    register: 'neutral',
    verbosity: 'moderate',
    emotionality: 'balanced',
    usesEmoji: false,
    avgWordCount: 30,
    complexity: 'moderate'
  };
}
```

---

## 2. Prompt Adapter per Tone Mirroring

### File: src/lib/tone/tone-prompt-adapter.ts

```typescript
import { ToneProfile } from './tone-analyzer';

interface ToneInstructions {
  register: string;
  questionStyle: string;
  responseLength: string;
  emojiGuidance: string;
}

/**
 * Genera istruzioni per il prompt basate sul profilo tono
 */
export function generateToneInstructions(profile: ToneProfile): ToneInstructions {
  
  // Register
  const registerInstructions: Record<ToneProfile['register'], string> = {
    formal: `Usa un registro formale e professionale. Evita abbreviazioni e slang. 
Dai del "Lei" se l'utente lo fa. Mantieni un tono rispettoso e misurato.`,
    
    neutral: `Usa un registro neutro e accessibile. Né troppo formale né troppo colloquiale.
Sii professionale ma amichevole.`,
    
    casual: `Usa un tono colloquiale e amichevole. Puoi usare espressioni informali.
L'utente apprezza un approccio rilassato e diretto.`
  };
  
  // Question style basato su verbosity
  const questionStyles: Record<ToneProfile['verbosity'], string> = {
    brief: `L'utente preferisce risposte brevi. Fai domande CONCISE e DIRETTE.
Evita preamboli e frasi di cortesia eccessive. Vai dritto al punto.
Esempio: "Cosa ti è piaciuto di più?" invece di "Potresti raccontarmi nel dettaglio cosa ti è piaciuto maggiormente della tua esperienza?"`,
    
    moderate: `Bilanciamento tra concisione e contesto. Fornisci abbastanza contesto 
per la domanda senza essere prolisso.`,
    
    verbose: `L'utente è loquace e apprezza le conversazioni articolate.
Puoi permetterti domande più elaborate e seguire tangenti interessanti.
Riconosci e valorizza i dettagli che condivide.`
  };
  
  // Response length guidance
  const lengthGuidance: Record<ToneProfile['verbosity'], string> = {
    brief: `Le tue risposte non devono superare 2-3 frasi. 
Se devi fare follow-up, scegli UN SOLO aspetto da approfondire.`,
    
    moderate: `Risposte di lunghezza media (3-5 frasi).
Bilanciamento tra riconoscimento di quanto detto e nuova domanda.`,
    
    verbose: `Puoi permetterti risposte più articolate (fino a 5-7 frasi).
Riprendi elementi specifici dalle risposte dell'utente per mostrare ascolto attivo.`
  };
  
  // Emoji
  const emojiGuidance = profile.usesEmoji 
    ? `L'utente usa emoji. Puoi usarne occasionalmente (max 1 per messaggio) per mantenere un tono affine.`
    : `L'utente non usa emoji. Evita di usarle nelle tue risposte.`;
  
  return {
    register: registerInstructions[profile.register],
    questionStyle: questionStyles[profile.verbosity],
    responseLength: lengthGuidance[profile.verbosity],
    emojiGuidance
  };
}

/**
 * Costruisce la sezione del prompt dedicata all'adattamento del tono
 */
export function buildToneAdaptationPrompt(profile: ToneProfile): string {
  const instructions = generateToneInstructions(profile);
  
  return `## ADATTAMENTO STILE COMUNICATIVO

Analisi del tono dell'utente:
- Registro: ${profile.register}
- Verbosità: ${profile.verbosity} (media ${profile.avgWordCount} parole)
- Emotività: ${profile.emotionality}
- Complessità: ${profile.complexity}

### Istruzioni di adattamento:

**Registro:**
${instructions.register}

**Stile domande:**
${instructions.questionStyle}

**Lunghezza risposte:**
${instructions.responseLength}

**Emoji:**
${instructions.emojiGuidance}

⚠️ IMPORTANTE: Adattati progressivamente. Non cambiare stile bruscamente.
Se noti un cambiamento nel tono dell'utente, adeguati gradualmente.`;
}
```

---

## 3. Sistema di Follow-up Proattivi

### Problema

Quando l'utente dice "vorrei vedere qualcosa di più veronese", l'AI chiede "cosa intendi?" invece di offrire suggerimenti. Questo fa sembrare che l'utente stia lavorando per l'AI.

### Soluzione: Knowledge Context + Suggerimenti

### File: src/lib/proactive/proactive-suggestions.ts

```typescript
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

interface ProactiveSuggestion {
  trigger: string;       // Tipo di trigger rilevato
  suggestions: string[]; // Suggerimenti da offrire
  questionFormat: string; // Come formulare la domanda con suggerimenti
}

const suggestionSchema = z.object({
  shouldOfferSuggestions: z.boolean(),
  trigger: z.string().nullable(),
  suggestions: z.array(z.string()).max(4),
  questionFormat: z.string()
});

/**
 * Analizza se la risposta utente richiede suggerimenti proattivi
 */
export async function analyzeForProactiveSuggestions(
  userMessage: string,
  currentTopicLabel: string,
  knowledgeBase: string | null,
  apiKey: string
): Promise<ProactiveSuggestion | null> {
  
  // Pattern che indicano richiesta implicita di suggerimenti
  const vaguePatterns = [
    /qualcosa di (più|diverso|tipico|speciale)/i,
    /non saprei/i,
    /mi piacerebbe.*ma non so/i,
    /cosa (mi )?consigli/i,
    /hai (dei )?suggerimenti/i,
    /tipo\?$/i,
    /per esempio\?$/i
  ];
  
  const needsSuggestions = vaguePatterns.some(p => p.test(userMessage));
  
  if (!needsSuggestions && !userMessage.endsWith('?')) {
    return null;
  }
  
  // Se abbiamo una knowledge base, usiamola per generare suggerimenti contestuali
  if (knowledgeBase) {
    return await generateContextualSuggestions(
      userMessage,
      currentTopicLabel,
      knowledgeBase,
      apiKey
    );
  }
  
  // Altrimenti, suggerimenti generici
  return generateGenericSuggestions(userMessage, currentTopicLabel);
}

async function generateContextualSuggestions(
  userMessage: string,
  topicLabel: string,
  knowledgeBase: string,
  apiKey: string
): Promise<ProactiveSuggestion | null> {
  
  const openai = createOpenAI({ apiKey });
  
  const prompt = `
Analizza questa risposta in un'intervista e determina se serve offrire suggerimenti.

RISPOSTA UTENTE: "${userMessage}"
TOPIC CORRENTE: ${topicLabel}

KNOWLEDGE BASE DISPONIBILE:
${knowledgeBase.slice(0, 3000)} // Limitiamo per costi

COMPITO:
1. Determina se l'utente sta chiedendo (implicitamente o esplicitamente) suggerimenti
2. Se sì, genera 2-4 suggerimenti pertinenti dalla knowledge base
3. Formula una domanda che OFFRA i suggerimenti invece di chiedere chiarimenti

ESEMPIO CORRETTO:
- Input: "vorrei vedere qualcosa di più veronese"
- Output: "Intendi cose come l'Arena, le osterie tipiche del centro, o magari quartieri meno turistici come Veronetta? Cosa ti attira di più?"

ESEMPIO SBAGLIATO:
- Input: "vorrei vedere qualcosa di più veronese"
- Output: "Cosa intendi esattamente con 'veronese'?" ← NO, troppo passivo
`;

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: suggestionSchema,
      prompt
    });
    
    if (!result.object.shouldOfferSuggestions) {
      return null;
    }
    
    return {
      trigger: result.object.trigger || 'vague_request',
      suggestions: result.object.suggestions,
      questionFormat: result.object.questionFormat
    };
  } catch (error) {
    console.error('Proactive suggestions generation failed:', error);
    return null;
  }
}

function generateGenericSuggestions(
  userMessage: string,
  topicLabel: string
): ProactiveSuggestion | null {
  
  // Suggerimenti generici basati su pattern comuni
  if (/qualcosa di (più|diverso)/i.test(userMessage)) {
    return {
      trigger: 'vague_more_request',
      suggestions: [],
      questionFormat: `Capisco! Potresti dirmi se pensi a qualcosa di specifico, 
oppure se preferisci che ti faccia qualche esempio di quello che intendo io?`
    };
  }
  
  if (/non saprei/i.test(userMessage)) {
    return {
      trigger: 'uncertainty',
      suggestions: [],
      questionFormat: `Nessun problema, è normale. Proviamo da un'altra angolazione: 
c'è qualcosa che ti ha colpito particolarmente, anche una piccola cosa?`
    };
  }
  
  return null;
}
```

---

## 4. Integrazione nel Prompt Builder

### Modifiche a src/lib/prompts/index.ts

```typescript
import { buildToneAdaptationPrompt } from '@/lib/tone/tone-prompt-adapter';
import { buildToneProfile } from '@/lib/tone/tone-analyzer';
import { analyzeForProactiveSuggestions } from '@/lib/proactive/proactive-suggestions';

export async function buildInterviewPrompt(params: {
  bot: BotWithConfig;
  conversation: ConversationWithMessages;
  currentTopic: TopicBlock | null;
  nextTopic: TopicBlock | null;
  timeContext: TimeContext;
  memory: ConversationMemoryData;
}): Promise<string> {
  
  // Estrai messaggi utente per analisi tono
  const userMessages = params.conversation.messages
    .filter(m => m.role === 'user')
    .map(m => m.content);
  
  // Costruisci profilo tono
  const toneProfile = buildToneProfile(userMessages);
  
  // Genera sezione adattamento tono
  const toneSection = buildToneAdaptationPrompt(toneProfile);
  
  // Assembla prompt
  const sections = [
    buildPersonaPrompt(params.bot),
    buildMethodologyPrompt(),
    toneSection, // NUOVO: Adattamento tono
    MemoryManager.formatForPrompt(params.memory), // Dalla Fase 1
    buildContextPrompt(params.conversation, params.timeContext),
    buildTopicPrompt(params.currentTopic, params.nextTopic),
    buildProactiveInstructions(), // NUOVO
    buildClosingPrompt(params.bot.rewardConfig, params.conversation.id),
  ];
  
  return sections.join('\n\n---\n\n');
}

function buildProactiveInstructions(): string {
  return `## COMPORTAMENTO PROATTIVO

Quando l'utente esprime una preferenza vaga o incertezza:
- NON chiedere "cosa intendi?" o "potresti spiegare meglio?"
- OFFRI suggerimenti concreti: "Intendi cose come X, Y, o Z?"
- AIUTA l'utente a esplorare le sue preferenze

Quando l'utente sembra in difficoltà:
- Offri esempi concreti
- Proponi prospettive alternative
- Riformula la domanda in modo più accessibile

ESEMPIO CORRETTO:
Utente: "Vorrei qualcosa di più tipico"
Tu: "Capisco! Pensi a esperienze come [esempio 1], [esempio 2], oppure [esempio 3]? Cosa ti attira di più?"

ESEMPIO SBAGLIATO:
Utente: "Vorrei qualcosa di più tipico"
Tu: "Cosa intendi con tipico?" ← Troppo passivo, mette l'utente in difficoltà`;
}
```

---

## 5. Varianti di Wording per Domande Chiave

### File: src/lib/wording/question-variants.ts

```typescript
import { ToneProfile } from '@/lib/tone/tone-analyzer';

type QuestionType = 
  | 'closing'           // Fine intervista
  | 'topic_transition'  // Passaggio tra topic
  | 'follow_up'         // Approfondimento
  | 'clarification'     // Richiesta chiarimento
  | 'encouragement';    // Incoraggiamento

interface WordingVariant {
  formal: string;
  neutral: string;
  casual: string;
}

const WORDING_VARIANTS: Record<QuestionType, WordingVariant[]> = {
  closing: [
    {
      formal: "C'è qualcos'altro che desidera aggiungere prima di concludere?",
      neutral: "Prima di chiudere, c'è qualcosa che vorresti aggiungere?",
      casual: "Ok, ultima cosa: manca qualcosa secondo te?"
    },
    {
      formal: "Abbiamo trattato i temi principali. Ha ulteriori osservazioni?",
      neutral: "Siamo quasi alla fine. C'è altro che ti viene in mente?",
      casual: "Dai che abbiamo quasi finito! Qualcos'altro da dire?"
    }
  ],
  
  topic_transition: [
    {
      formal: "La ringrazio per queste informazioni. Passiamo ora a parlare di...",
      neutral: "Grazie, molto utile. Ora parliamo di...",
      casual: "Perfetto! Cambiamo argomento, parliamo di..."
    },
    {
      formal: "Interessante prospettiva. Vorrei ora esplorare un altro aspetto...",
      neutral: "Capito. Spostiamoci su un altro tema...",
      casual: "Ok capito! Adesso ti chiedo di..."
    }
  ],
  
  follow_up: [
    {
      formal: "Potrebbe approfondire questo aspetto?",
      neutral: "Puoi dirmi qualcosa di più su questo?",
      casual: "Raccontami di più!"
    },
    {
      formal: "Sarebbe interessante capire meglio le motivazioni.",
      neutral: "Cosa ti ha portato a questa conclusione?",
      casual: "Come mai? Sono curioso!"
    }
  ],
  
  clarification: [
    {
      formal: "Mi permetta di assicurarmi di aver compreso correttamente...",
      neutral: "Fammi capire meglio...",
      casual: "Aspetta, vuoi dire che..."
    }
  ],
  
  encouragement: [
    {
      formal: "Comprendo, è una considerazione valida.",
      neutral: "Capisco, ha senso.",
      casual: "Sì, capisco cosa intendi!"
    },
    {
      formal: "Apprezzo la sua sincerità.",
      neutral: "Grazie per la trasparenza.",
      casual: "Grazie per essere sincero/a!"
    }
  ]
};

/**
 * Seleziona la variante di wording più appropriata
 */
export function selectWording(
  questionType: QuestionType,
  toneProfile: ToneProfile,
  usedVariants: string[] = []
): string {
  
  const variants = WORDING_VARIANTS[questionType];
  const register = toneProfile.register;
  
  // Filtra varianti già usate per evitare ripetizioni
  const availableVariants = variants.filter(v => 
    !usedVariants.includes(v[register])
  );
  
  // Se tutte usate, riparti da capo
  const pool = availableVariants.length > 0 ? availableVariants : variants;
  
  // Selezione casuale tra le disponibili
  const selected = pool[Math.floor(Math.random() * pool.length)];
  
  return selected[register];
}

/**
 * Genera un set di varianti per il prompt
 */
export function generateWordingGuidance(toneProfile: ToneProfile): string {
  return `## VARIANTI DI FORMULAZIONE

Usa queste varianti per mantenere freschezza nelle domande:

**Per passare a nuovo argomento:**
- "${selectWording('topic_transition', toneProfile)}"

**Per approfondire:**
- "${selectWording('follow_up', toneProfile)}"

**Per chiudere:**
- "${selectWording('closing', toneProfile)}"

**Per incoraggiare:**
- "${selectWording('encouragement', toneProfile)}"

⚠️ NON ripetere la stessa formulazione due volte nella conversazione.`;
}
```

---

## 6. Test di Adattamento

### File: src/lib/tone/__tests__/tone-analyzer.test.ts

```typescript
import { analyzeTone, buildToneProfile } from '../tone-analyzer';

describe('ToneAnalyzer', () => {
  
  describe('analyzeTone', () => {
    it('should detect formal indicators', () => {
      const result = analyzeTone('Desidero sottoporre alla Sua attenzione questa questione.');
      expect(result.formalIndicators.length).toBeGreaterThan(0);
    });
    
    it('should detect casual indicators', () => {
      const result = analyzeTone('Boh, tipo non saprei haha');
      expect(result.casualIndicators.length).toBeGreaterThan(0);
    });
    
    it('should count emoji', () => {
      const result = analyzeTone('Bellissimo! 😍🎉');
      expect(result.emojiCount).toBe(2);
    });
  });
  
  describe('buildToneProfile', () => {
    it('should identify formal profile', () => {
      const messages = [
        'La ringrazio per la domanda.',
        'Desidero precisare che la situazione richiede attenzione.',
        'Cordiali saluti.'
      ];
      
      const profile = buildToneProfile(messages);
      expect(profile.register).toBe('formal');
    });
    
    it('should identify brief verbosity', () => {
      const messages = ['Sì', 'No grazie', 'Ok', 'Va bene'];
      
      const profile = buildToneProfile(messages);
      expect(profile.verbosity).toBe('brief');
    });
    
    it('should identify expressive emotionality', () => {
      const messages = [
        'Fantastico!!! 😍',
        'Che bello!!!',
        'Wow... incredibile!'
      ];
      
      const profile = buildToneProfile(messages);
      expect(profile.emotionality).toBe('expressive');
    });
  });
});
```

---

## Checklist Implementazione Fase 4

- [ ] Implementare tone-analyzer.ts
- [ ] Implementare tone-prompt-adapter.ts
- [ ] Implementare proactive-suggestions.ts
- [ ] Implementare question-variants.ts
- [ ] Integrare nel prompt builder principale
- [ ] Aggiungere test unitari
- [ ] Test end-to-end con conversazioni simulate
- [ ] Verificare che il tono si adatti progressivamente
- [ ] Verificare che i suggerimenti proattivi funzionino con knowledge base

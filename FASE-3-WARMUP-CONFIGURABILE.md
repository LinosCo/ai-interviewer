# Fase 3: Warm-up Configurabile

## Obiettivo

Permettere al creatore dell'intervista di scegliere come iniziare la conversazione. Una domanda completamente aperta può essere traumatica in contesti "freddi" (es. turisti che non ti conoscono). Offrire alternative per abbassare la barriera d'ingresso.

---

## 1. Schema Database

### Nuovi campi per configurazione warm-up

```prisma
// schema.prisma - MODIFICHE al model Bot

model Bot {
  // ... campi esistenti ...
  
  // NUOVI CAMPI per warm-up
  warmupStyle          String   @default("open")  // "open" | "choice" | "icebreaker" | "context"
  warmupChoices        Json?    // Array di opzioni per stile "choice"
  warmupIcebreaker     String?  // Domanda ice-breaker personalizzata
  warmupContextPrompt  String?  // Prompt per domanda contestuale (es. "Da dove ci scrivi?")
  
  // Comportamento dopo warm-up
  warmupFollowup       Boolean  @default(true)  // Se fare follow-up sulla risposta warm-up
}
```

### Struttura warmupChoices

```typescript
// types/warmup.ts

export interface WarmupChoice {
  id: string;
  label: string;           // "Vacanza"
  value: string;           // "vacation"
  followupPrompt?: string; // Prompt specifico per follow-up su questa scelta
}

export type WarmupStyle = 'open' | 'choice' | 'icebreaker' | 'context';

export interface WarmupConfig {
  style: WarmupStyle;
  choices?: WarmupChoice[];
  icebreaker?: string;
  contextPrompt?: string;
  followup: boolean;
}
```

---

## 2. Componenti UI per Warm-up

### File: src/components/interview/WarmupQuestion.tsx

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, ChevronRight } from 'lucide-react';

interface WarmupChoice {
  id: string;
  label: string;
  value: string;
}

interface WarmupQuestionProps {
  style: 'open' | 'choice' | 'icebreaker' | 'context';
  questionText: string;
  choices?: WarmupChoice[];
  placeholder?: string;
  language: 'it' | 'en';
  onAnswer: (answer: string, choiceId?: string) => void;
}

const TRANSLATIONS = {
  it: {
    placeholder: 'Scrivi qui...',
    send: 'Continua',
    other: 'Altro...',
    typeYourAnswer: 'Scrivi la tua risposta'
  },
  en: {
    placeholder: 'Type here...',
    send: 'Continue',
    other: 'Other...',
    typeYourAnswer: 'Type your answer'
  }
};

export function WarmupQuestion({
  style,
  questionText,
  choices = [],
  placeholder,
  language = 'it',
  onAnswer
}: WarmupQuestionProps) {
  
  const t = TRANSLATIONS[language];
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  const handleChoiceSelect = (choice: WarmupChoice) => {
    setSelectedChoice(choice.id);
    setShowCustomInput(false);
    // Invio immediato per scelte predefinite
    onAnswer(choice.label, choice.id);
  };
  
  const handleOtherClick = () => {
    setSelectedChoice('other');
    setShowCustomInput(true);
  };
  
  const handleCustomSubmit = () => {
    if (customAnswer.trim()) {
      onAnswer(customAnswer.trim(), 'custom');
    }
  };
  
  // Stile OPEN: solo textarea
  if (style === 'open' || style === 'icebreaker' || style === 'context') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-800 leading-relaxed">{questionText}</p>
        </div>
        
        <div className="relative">
          <textarea
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder={placeholder || t.placeholder}
            rows={3}
            className="w-full p-4 pr-14 rounded-xl border border-gray-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customAnswer.trim()}
            className={`
              absolute bottom-3 right-3 p-2 rounded-lg
              transition-all duration-200
              ${customAnswer.trim() 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-gray-100 text-gray-400'
              }
            `}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }
  
  // Stile CHOICE: opzioni + altro
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-gray-800 leading-relaxed">{questionText}</p>
      </div>
      
      {/* Scelte predefinite */}
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice, index) => (
          <motion.button
            key={choice.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleChoiceSelect(choice)}
            className={`
              p-4 rounded-xl text-left transition-all duration-200
              ${selectedChoice === choice.id
                ? 'bg-amber-100 border-2 border-amber-400 text-amber-800'
                : 'bg-white border-2 border-gray-100 hover:border-amber-200 text-gray-700'
              }
            `}
          >
            <span className="font-medium">{choice.label}</span>
          </motion.button>
        ))}
        
        {/* Opzione "Altro" */}
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: choices.length * 0.05 }}
          onClick={handleOtherClick}
          className={`
            p-4 rounded-xl text-left transition-all duration-200
            ${selectedChoice === 'other'
              ? 'bg-gray-100 border-2 border-gray-300 text-gray-800'
              : 'bg-white border-2 border-dashed border-gray-200 hover:border-gray-300 text-gray-500'
            }
          `}
        >
          <span>{t.other}</span>
        </motion.button>
      </div>
      
      {/* Input per "Altro" */}
      {showCustomInput && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="relative"
        >
          <input
            type="text"
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder={t.typeYourAnswer}
            className="w-full p-4 pr-14 rounded-xl border border-gray-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomSubmit();
              }
            }}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customAnswer.trim()}
            className={`
              absolute top-1/2 -translate-y-1/2 right-3 p-2 rounded-lg
              transition-all duration-200
              ${customAnswer.trim() 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-gray-100 text-gray-400'
              }
            `}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
```

---

## 3. Logica di Generazione Domanda Warm-up

### File: src/lib/warmup/warmup-generator.ts

```typescript
import { Bot, TopicBlock } from '@prisma/client';
import { WarmupConfig, WarmupChoice } from '@/types/warmup';

interface WarmupQuestion {
  text: string;
  style: WarmupConfig['style'];
  choices?: WarmupChoice[];
}

/**
 * Genera la domanda di warm-up basata sulla configurazione del bot
 */
export function generateWarmupQuestion(
  bot: Bot & { topics: TopicBlock[] },
  language: 'it' | 'en' = 'it'
): WarmupQuestion {
  
  const config: WarmupConfig = {
    style: bot.warmupStyle as WarmupConfig['style'],
    choices: bot.warmupChoices as WarmupChoice[] | undefined,
    icebreaker: bot.warmupIcebreaker || undefined,
    contextPrompt: bot.warmupContextPrompt || undefined,
    followup: bot.warmupFollowup
  };
  
  switch (config.style) {
    case 'choice':
      return generateChoiceWarmup(bot, config.choices || [], language);
      
    case 'icebreaker':
      return generateIcebreakerWarmup(config.icebreaker, language);
      
    case 'context':
      return generateContextWarmup(config.contextPrompt, language);
      
    case 'open':
    default:
      return generateOpenWarmup(bot, language);
  }
}

function generateOpenWarmup(
  bot: Bot & { topics: TopicBlock[] },
  language: 'it' | 'en'
): WarmupQuestion {
  // Usa introMessage del bot o genera uno di default
  const defaultIntros = {
    it: `Ciao! ${bot.introMessage || 'Grazie per aver accettato di partecipare. Raccontami un po\' di te e di quello che ti porta qui oggi.'}`,
    en: `Hi! ${bot.introMessage || 'Thanks for agreeing to participate. Tell me a bit about yourself and what brings you here today.'}`
  };
  
  return {
    text: defaultIntros[language],
    style: 'open'
  };
}

function generateChoiceWarmup(
  bot: Bot & { topics: TopicBlock[] },
  choices: WarmupChoice[],
  language: 'it' | 'en'
): WarmupQuestion {
  
  // Se non ci sono scelte configurate, genera quelle di default basate sul contesto
  const effectiveChoices = choices.length > 0 
    ? choices 
    : getDefaultChoices(bot.targetAudience || '', language);
  
  const questionTexts = {
    it: 'Per iniziare, come descriveresti il motivo principale per cui sei qui oggi?',
    en: 'To start, how would you describe the main reason you\'re here today?'
  };
  
  return {
    text: questionTexts[language],
    style: 'choice',
    choices: effectiveChoices
  };
}

function generateIcebreakerWarmup(
  customIcebreaker: string | undefined,
  language: 'it' | 'en'
): WarmupQuestion {
  
  const defaultIcebreakers = {
    it: 'Prima di iniziare, una curiosità: da dove ci scrivi in questo momento?',
    en: 'Before we start, just curious: where are you writing from right now?'
  };
  
  return {
    text: customIcebreaker || defaultIcebreakers[language],
    style: 'icebreaker'
  };
}

function generateContextWarmup(
  customPrompt: string | undefined,
  language: 'it' | 'en'
): WarmupQuestion {
  
  const defaultContextPrompts = {
    it: 'Per contestualizzare le tue risposte, potresti dirmi brevemente qual è il tuo ruolo o la tua situazione attuale?',
    en: 'To put your answers in context, could you briefly tell me about your role or current situation?'
  };
  
  return {
    text: customPrompt || defaultContextPrompts[language],
    style: 'context'
  };
}

/**
 * Genera scelte di default basate sul target audience
 */
function getDefaultChoices(
  targetAudience: string,
  language: 'it' | 'en'
): WarmupChoice[] {
  
  // Analisi semplice del target per generare scelte pertinenti
  const targetLower = targetAudience.toLowerCase();
  
  // Turismo
  if (targetLower.includes('turist') || targetLower.includes('visit') || targetLower.includes('travel')) {
    return language === 'it' ? [
      { id: '1', label: 'Vacanza', value: 'vacation' },
      { id: '2', label: 'Lavoro', value: 'business' },
      { id: '3', label: 'Weekend/Gita', value: 'weekend' },
      { id: '4', label: 'Evento specifico', value: 'event' }
    ] : [
      { id: '1', label: 'Vacation', value: 'vacation' },
      { id: '2', label: 'Business', value: 'business' },
      { id: '3', label: 'Weekend trip', value: 'weekend' },
      { id: '4', label: 'Specific event', value: 'event' }
    ];
  }
  
  // Clienti/Feedback prodotto
  if (targetLower.includes('client') || targetLower.includes('custom') || targetLower.includes('utent')) {
    return language === 'it' ? [
      { id: '1', label: 'Uso quotidiano', value: 'daily_user' },
      { id: '2', label: 'Uso occasionale', value: 'occasional' },
      { id: '3', label: 'Nuovo utente', value: 'new_user' },
      { id: '4', label: 'Ex utente', value: 'former_user' }
    ] : [
      { id: '1', label: 'Daily use', value: 'daily_user' },
      { id: '2', label: 'Occasional use', value: 'occasional' },
      { id: '3', label: 'New user', value: 'new_user' },
      { id: '4', label: 'Former user', value: 'former_user' }
    ];
  }
  
  // HR/Dipendenti
  if (targetLower.includes('dipendent') || targetLower.includes('employ') || targetLower.includes('team')) {
    return language === 'it' ? [
      { id: '1', label: 'Meno di 1 anno', value: 'junior' },
      { id: '2', label: '1-3 anni', value: 'mid' },
      { id: '3', label: '3-5 anni', value: 'senior' },
      { id: '4', label: 'Più di 5 anni', value: 'veteran' }
    ] : [
      { id: '1', label: 'Less than 1 year', value: 'junior' },
      { id: '2', label: '1-3 years', value: 'mid' },
      { id: '3', label: '3-5 years', value: 'senior' },
      { id: '4', label: 'More than 5 years', value: 'veteran' }
    ];
  }
  
  // Default generico
  return language === 'it' ? [
    { id: '1', label: 'Interesse personale', value: 'personal' },
    { id: '2', label: 'Interesse professionale', value: 'professional' },
    { id: '3', label: 'Consiglio di altri', value: 'referral' },
    { id: '4', label: 'Curiosità', value: 'curiosity' }
  ] : [
    { id: '1', label: 'Personal interest', value: 'personal' },
    { id: '2', label: 'Professional interest', value: 'professional' },
    { id: '3', label: 'Recommendation', value: 'referral' },
    { id: '4', label: 'Curiosity', value: 'curiosity' }
  ];
}
```

---

## 4. Prompt Integration per Follow-up Warm-up

### File: src/lib/prompts/warmup-context.ts

```typescript
import { WarmupChoice } from '@/types/warmup';

interface WarmupResponse {
  answer: string;
  choiceId?: string;
  style: 'open' | 'choice' | 'icebreaker' | 'context';
}

/**
 * Genera il contesto per il prompt basato sulla risposta warm-up
 */
export function buildWarmupContext(
  warmupResponse: WarmupResponse,
  choices?: WarmupChoice[]
): string {
  
  const selectedChoice = choices?.find(c => c.id === warmupResponse.choiceId);
  
  let context = `## CONTESTO WARM-UP

L'utente ha risposto alla domanda iniziale.
`;

  switch (warmupResponse.style) {
    case 'choice':
      if (selectedChoice) {
        context += `
Risposta: "${warmupResponse.answer}" (scelta predefinita: ${selectedChoice.value})

${selectedChoice.followupPrompt 
  ? `Suggerimento follow-up: ${selectedChoice.followupPrompt}` 
  : 'Usa questa informazione per contestualizzare le domande successive.'}
`;
      } else {
        // Risposta "Altro"
        context += `
Risposta libera: "${warmupResponse.answer}"

L'utente ha scelto di dare una risposta personalizzata. Approfondisci brevemente prima di passare ai topic principali.
`;
      }
      break;
      
    case 'icebreaker':
      context += `
Risposta ice-breaker: "${warmupResponse.answer}"

Questa era una domanda leggera per rompere il ghiaccio. Fai un breve commento di cortesia e passa ai topic principali.
`;
      break;
      
    case 'context':
      context += `
Contesto fornito: "${warmupResponse.answer}"

Usa questa informazione per adattare le domande al profilo dell'utente.
`;
      break;
      
    case 'open':
    default:
      context += `
Risposta iniziale: "${warmupResponse.answer}"

Analizza la risposta e identifica spunti da approfondire. Fai UN breve follow-up prima di passare ai topic strutturati.
`;
  }
  
  return context;
}
```

---

## 5. Configurazione nel Bot Builder

### File: src/components/bot-builder/WarmupSettings.tsx

```tsx
'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { WarmupChoice, WarmupStyle } from '@/types/warmup';

interface WarmupSettingsProps {
  style: WarmupStyle;
  choices: WarmupChoice[];
  icebreaker?: string;
  contextPrompt?: string;
  followup: boolean;
  onChange: (updates: Partial<{
    warmupStyle: WarmupStyle;
    warmupChoices: WarmupChoice[];
    warmupIcebreaker: string;
    warmupContextPrompt: string;
    warmupFollowup: boolean;
  }>) => void;
}

const STYLE_OPTIONS = [
  { 
    value: 'open' as const, 
    label: 'Domanda aperta',
    description: 'L\'utente risponde liberamente. Ideale per contesti "caldi" (clienti fedeli, dipendenti).'
  },
  { 
    value: 'choice' as const, 
    label: 'Scelta multipla + Altro',
    description: 'L\'utente sceglie tra opzioni predefinite. Abbassa la barriera d\'ingresso.'
  },
  { 
    value: 'icebreaker' as const, 
    label: 'Ice-breaker leggero',
    description: 'Domanda semplice e non impegnativa per iniziare (es. "Da dove ci scrivi?")'
  },
  { 
    value: 'context' as const, 
    label: 'Domanda contestuale',
    description: 'Raccoglie informazioni di contesto utili per le domande successive.'
  }
];

export function WarmupSettings({
  style,
  choices,
  icebreaker,
  contextPrompt,
  followup,
  onChange
}: WarmupSettingsProps) {
  
  const [newChoiceLabel, setNewChoiceLabel] = useState('');
  
  const addChoice = () => {
    if (!newChoiceLabel.trim()) return;
    
    const newChoice: WarmupChoice = {
      id: `choice_${Date.now()}`,
      label: newChoiceLabel.trim(),
      value: newChoiceLabel.trim().toLowerCase().replace(/\s+/g, '_')
    };
    
    onChange({ warmupChoices: [...choices, newChoice] });
    setNewChoiceLabel('');
  };
  
  const removeChoice = (id: string) => {
    onChange({ warmupChoices: choices.filter(c => c.id !== id) });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Domanda iniziale (Warm-up)</h3>
        <p className="text-sm text-gray-500 mt-1">
          Come vuoi iniziare la conversazione? Una partenza efficace riduce gli abbandoni.
        </p>
      </div>
      
      {/* Style selector */}
      <div className="space-y-3">
        {STYLE_OPTIONS.map((option) => (
          <label 
            key={option.value}
            className={`
              flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer
              transition-all duration-200
              ${style === option.value 
                ? 'border-amber-400 bg-amber-50' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <input
              type="radio"
              name="warmupStyle"
              value={option.value}
              checked={style === option.value}
              onChange={() => onChange({ warmupStyle: option.value })}
              className="mt-1 text-amber-500 focus:ring-amber-500"
            />
            <div>
              <span className="font-medium text-gray-900">{option.label}</span>
              <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
      
      {/* Configurazione specifica per stile */}
      {style === 'choice' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-700">Opzioni di risposta</h4>
          
          {/* Lista scelte esistenti */}
          <div className="space-y-2">
            {choices.map((choice, index) => (
              <div 
                key={choice.id}
                className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="flex-1">{choice.label}</span>
                <button
                  onClick={() => removeChoice(choice.id)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Aggiungi nuova scelta */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newChoiceLabel}
              onChange={(e) => setNewChoiceLabel(e.target.value)}
              placeholder="Aggiungi opzione..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200"
              onKeyDown={(e) => e.key === 'Enter' && addChoice()}
            />
            <button
              onClick={addChoice}
              disabled={!newChoiceLabel.trim()}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500">
            L'opzione "Altro..." verrà aggiunta automaticamente per permettere risposte libere.
          </p>
        </div>
      )}
      
      {style === 'icebreaker' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Domanda ice-breaker personalizzata
          </label>
          <input
            type="text"
            value={icebreaker || ''}
            onChange={(e) => onChange({ warmupIcebreaker: e.target.value })}
            placeholder="Es: Da dove ci scrivi oggi?"
            className="w-full px-4 py-3 rounded-xl border border-gray-200"
          />
        </div>
      )}
      
      {style === 'context' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Domanda di contesto personalizzata
          </label>
          <textarea
            value={contextPrompt || ''}
            onChange={(e) => onChange({ warmupContextPrompt: e.target.value })}
            placeholder="Es: Qual è il tuo ruolo in azienda?"
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-gray-200"
          />
        </div>
      )}
      
      {/* Follow-up toggle */}
      <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          checked={followup}
          onChange={(e) => onChange({ warmupFollowup: e.target.checked })}
          className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
        />
        <div>
          <span className="font-medium text-gray-700">Fai follow-up sulla risposta</span>
          <p className="text-sm text-gray-500">
            L'AI farà una breve domanda di approfondimento prima di passare ai topic principali.
          </p>
        </div>
      </label>
    </div>
  );
}
```

---

## 6. Integrazione nel Flusso Conversazione

### Modifiche a src/app/api/chat/route.ts

```typescript
// Aggiungere import
import { buildWarmupContext } from '@/lib/prompts/warmup-context';

// Nel handler, dopo la prima risposta utente:

// Controlla se siamo ancora in fase warm-up
const messageCount = messages.length;
const isWarmupPhase = messageCount <= 2; // Primo scambio

if (isWarmupPhase && messageCount === 2) {
  // L'utente ha appena risposto al warm-up
  const warmupResponse = {
    answer: message,
    choiceId: req.headers.get('x-warmup-choice-id') || undefined,
    style: conversation.bot.warmupStyle as any
  };
  
  const warmupContext = buildWarmupContext(
    warmupResponse,
    conversation.bot.warmupChoices as any
  );
  
  // Aggiungi al system prompt
  systemPrompt = warmupContext + '\n\n' + systemPrompt;
  
  // Se followup è disabilitato, salta direttamente al primo topic
  if (!conversation.bot.warmupFollowup) {
    systemPrompt += `\n\n⚠️ NON fare follow-up sul warm-up. Passa direttamente al primo topic.`;
  }
}
```

---

## Checklist Implementazione Fase 3

- [ ] Aggiornare schema.prisma con campi warm-up
- [ ] Creare types/warmup.ts
- [ ] Implementare WarmupQuestion.tsx
- [ ] Implementare warmup-generator.ts
- [ ] Implementare warmup-context.ts
- [ ] Creare WarmupSettings.tsx per bot builder
- [ ] Modificare API chat per gestire fase warm-up
- [ ] Eseguire migration database
- [ ] Test con diversi stili di warm-up
- [ ] Verificare passaggio corretto dal warm-up ai topic

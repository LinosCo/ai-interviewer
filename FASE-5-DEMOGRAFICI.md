# Fase 5: Sezione Socio-Demografica Configurabile

## Obiettivo

Permettere la raccolta di dati strutturati (età, genere, professione, ecc.) che non richiedono conversazione AI ma sono utili per l'analisi. Questi dati possono essere raccolti prima o dopo l'intervista conversazionale.

---

## 1. Schema Database

### Nuove tabelle e campi

```prisma
// schema.prisma

// Configurazione domande demografiche per il bot
model DemographicQuestion {
  id              String   @id @default(cuid())
  botId           String
  bot             Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  
  // Configurazione domanda
  questionKey     String   // es: "age", "gender", "education"
  questionText    String   // Testo della domanda localizzato
  questionType    String   // "single_choice" | "multi_choice" | "text" | "number" | "scale"
  
  // Opzioni (per choice types)
  options         Json?    // Array di {value: string, label: string}
  
  // Validazione
  isRequired      Boolean  @default(false)
  minValue        Int?     // Per number/scale
  maxValue        Int?     // Per number/scale
  
  // Posizionamento
  position        String   @default("before") // "before" | "after" | "both"
  orderIndex      Int      @default(0)
  
  // Metadata
  category        String?  // "basic" | "contextual" | "custom"
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([botId, questionKey])
  @@index([botId, position])
}

// Risposte demografiche per conversazione
model DemographicResponse {
  id              String   @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  questionKey     String
  value           String   // Valore serializzato (JSON per multi-choice)
  
  answeredAt      DateTime @default(now())
  
  @@unique([conversationId, questionKey])
  @@index([conversationId])
}

// Aggiornamento Bot
model Bot {
  // ... campi esistenti ...
  
  // Nuovi campi demografici
  demographicEnabled      Boolean @default(false)
  demographicPosition     String  @default("before") // "before" | "after"
  demographicIntroText    String? // Testo introduttivo sezione demografica
  
  demographicQuestions    DemographicQuestion[]
}

// Aggiornamento Conversation
model Conversation {
  // ... campi esistenti ...
  
  demographicResponses    DemographicResponse[]
  demographicCompleted    Boolean @default(false)
}
```

---

## 2. Tipi TypeScript

### File: src/types/demographics.ts

```typescript
export type DemographicQuestionType = 
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'number'
  | 'scale';

export interface DemographicOption {
  value: string;
  label: string;
  icon?: string; // Emoji o icona opzionale
}

export interface DemographicQuestion {
  id: string;
  questionKey: string;
  questionText: string;
  questionType: DemographicQuestionType;
  options?: DemographicOption[];
  isRequired: boolean;
  minValue?: number;
  maxValue?: number;
  position: 'before' | 'after';
  orderIndex: number;
  category?: 'basic' | 'contextual' | 'custom';
}

export interface DemographicResponse {
  questionKey: string;
  value: string | string[] | number;
}

// Template predefiniti per settore
export interface DemographicTemplate {
  id: string;
  name: string;
  description: string;
  sector: string; // "tourism" | "hr" | "customer" | "general"
  questions: Omit<DemographicQuestion, 'id' | 'botId'>[];
}
```

---

## 3. Template Demografici Predefiniti

### File: src/lib/demographics/templates.ts

```typescript
import { DemographicTemplate } from '@/types/demographics';

export const DEMOGRAPHIC_TEMPLATES: DemographicTemplate[] = [
  // TURISMO
  {
    id: 'tourism_basic',
    name: 'Turismo - Base',
    description: 'Domande essenziali per feedback turistici',
    sector: 'tourism',
    questions: [
      {
        questionKey: 'visit_type',
        questionText: 'Che tipo di visita è questa?',
        questionType: 'single_choice',
        options: [
          { value: 'vacation', label: 'Vacanza', icon: '🏖️' },
          { value: 'business', label: 'Lavoro', icon: '💼' },
          { value: 'weekend', label: 'Weekend/Gita', icon: '🚗' },
          { value: 'event', label: 'Evento specifico', icon: '🎭' },
          { value: 'other', label: 'Altro', icon: '📍' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 0,
        category: 'contextual'
      },
      {
        questionKey: 'travel_party',
        questionText: 'Con chi viaggi?',
        questionType: 'single_choice',
        options: [
          { value: 'alone', label: 'Da solo/a', icon: '🧍' },
          { value: 'partner', label: 'In coppia', icon: '👫' },
          { value: 'family', label: 'Famiglia con bambini', icon: '👨‍👩‍👧‍👦' },
          { value: 'friends', label: 'Amici', icon: '👯' },
          { value: 'group', label: 'Gruppo organizzato', icon: '🚌' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 1,
        category: 'contextual'
      },
      {
        questionKey: 'stay_duration',
        questionText: 'Quanto dura il tuo soggiorno?',
        questionType: 'single_choice',
        options: [
          { value: 'day', label: 'Giornata', icon: '☀️' },
          { value: '1-2_nights', label: '1-2 notti', icon: '🌙' },
          { value: '3-5_nights', label: '3-5 notti', icon: '🌛' },
          { value: 'week_plus', label: 'Una settimana o più', icon: '📅' }
        ],
        isRequired: false,
        position: 'before',
        orderIndex: 2,
        category: 'contextual'
      },
      {
        questionKey: 'age_range',
        questionText: 'In quale fascia di età ti collochi?',
        questionType: 'single_choice',
        options: [
          { value: '18-24', label: '18-24' },
          { value: '25-34', label: '25-34' },
          { value: '35-44', label: '35-44' },
          { value: '45-54', label: '45-54' },
          { value: '55-64', label: '55-64' },
          { value: '65+', label: '65+' }
        ],
        isRequired: false,
        position: 'after',
        orderIndex: 0,
        category: 'basic'
      },
      {
        questionKey: 'country',
        questionText: 'Da quale paese provieni?',
        questionType: 'text',
        isRequired: false,
        position: 'after',
        orderIndex: 1,
        category: 'basic'
      }
    ]
  },
  
  // HR / DIPENDENTI
  {
    id: 'hr_basic',
    name: 'HR - Base',
    description: 'Domande per feedback dipendenti',
    sector: 'hr',
    questions: [
      {
        questionKey: 'tenure',
        questionText: 'Da quanto tempo lavori in azienda?',
        questionType: 'single_choice',
        options: [
          { value: 'less_1', label: 'Meno di 1 anno' },
          { value: '1-2', label: '1-2 anni' },
          { value: '3-5', label: '3-5 anni' },
          { value: '5-10', label: '5-10 anni' },
          { value: '10+', label: 'Più di 10 anni' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 0,
        category: 'contextual'
      },
      {
        questionKey: 'department',
        questionText: 'In quale area lavori?',
        questionType: 'single_choice',
        options: [
          { value: 'sales', label: 'Vendite' },
          { value: 'marketing', label: 'Marketing' },
          { value: 'tech', label: 'Tech/IT' },
          { value: 'operations', label: 'Operations' },
          { value: 'hr', label: 'HR' },
          { value: 'finance', label: 'Finance' },
          { value: 'other', label: 'Altro' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 1,
        category: 'contextual'
      },
      {
        questionKey: 'role_level',
        questionText: 'Qual è il tuo livello di responsabilità?',
        questionType: 'single_choice',
        options: [
          { value: 'individual', label: 'Individual contributor' },
          { value: 'team_lead', label: 'Team lead' },
          { value: 'manager', label: 'Manager' },
          { value: 'director', label: 'Director+' }
        ],
        isRequired: false,
        position: 'before',
        orderIndex: 2,
        category: 'contextual'
      }
    ]
  },
  
  // CUSTOMER FEEDBACK
  {
    id: 'customer_basic',
    name: 'Clienti - Base',
    description: 'Domande per feedback clienti B2B/B2C',
    sector: 'customer',
    questions: [
      {
        questionKey: 'customer_type',
        questionText: 'Come ti definiresti?',
        questionType: 'single_choice',
        options: [
          { value: 'new', label: 'Nuovo cliente', icon: '🆕' },
          { value: 'returning', label: 'Cliente abituale', icon: '🔄' },
          { value: 'loyal', label: 'Cliente fedele (2+ anni)', icon: '⭐' },
          { value: 'former', label: 'Ex cliente', icon: '👋' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 0,
        category: 'contextual'
      },
      {
        questionKey: 'usage_frequency',
        questionText: 'Con che frequenza usi il nostro servizio/prodotto?',
        questionType: 'single_choice',
        options: [
          { value: 'daily', label: 'Ogni giorno' },
          { value: 'weekly', label: 'Ogni settimana' },
          { value: 'monthly', label: 'Ogni mese' },
          { value: 'rarely', label: 'Raramente' },
          { value: 'first_time', label: 'Prima volta' }
        ],
        isRequired: true,
        position: 'before',
        orderIndex: 1,
        category: 'contextual'
      },
      {
        questionKey: 'nps',
        questionText: 'Quanto consiglieresti il nostro servizio? (0-10)',
        questionType: 'scale',
        minValue: 0,
        maxValue: 10,
        isRequired: false,
        position: 'after',
        orderIndex: 0,
        category: 'basic'
      }
    ]
  },
  
  // GENERICO
  {
    id: 'general_basic',
    name: 'Generale - Base',
    description: 'Domande demografiche standard',
    sector: 'general',
    questions: [
      {
        questionKey: 'age_range',
        questionText: 'Fascia di età',
        questionType: 'single_choice',
        options: [
          { value: '18-24', label: '18-24' },
          { value: '25-34', label: '25-34' },
          { value: '35-44', label: '35-44' },
          { value: '45-54', label: '45-54' },
          { value: '55-64', label: '55-64' },
          { value: '65+', label: '65+' }
        ],
        isRequired: false,
        position: 'after',
        orderIndex: 0,
        category: 'basic'
      },
      {
        questionKey: 'gender',
        questionText: 'Genere',
        questionType: 'single_choice',
        options: [
          { value: 'male', label: 'Uomo' },
          { value: 'female', label: 'Donna' },
          { value: 'non_binary', label: 'Non binario' },
          { value: 'prefer_not', label: 'Preferisco non rispondere' }
        ],
        isRequired: false,
        position: 'after',
        orderIndex: 1,
        category: 'basic'
      },
      {
        questionKey: 'education',
        questionText: 'Titolo di studio',
        questionType: 'single_choice',
        options: [
          { value: 'middle', label: 'Scuola media' },
          { value: 'high', label: 'Diploma' },
          { value: 'bachelor', label: 'Laurea triennale' },
          { value: 'master', label: 'Laurea magistrale' },
          { value: 'phd', label: 'Dottorato' }
        ],
        isRequired: false,
        position: 'after',
        orderIndex: 2,
        category: 'basic'
      }
    ]
  }
];

/**
 * Recupera template per settore
 */
export function getTemplatesBySector(sector: string): DemographicTemplate[] {
  return DEMOGRAPHIC_TEMPLATES.filter(t => t.sector === sector);
}

/**
 * Recupera template per ID
 */
export function getTemplateById(id: string): DemographicTemplate | undefined {
  return DEMOGRAPHIC_TEMPLATES.find(t => t.id === id);
}
```

---

## 4. Componente UI Domande Demografiche

### File: src/components/interview/DemographicForm.tsx

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { DemographicQuestion, DemographicResponse } from '@/types/demographics';

interface DemographicFormProps {
  questions: DemographicQuestion[];
  introText?: string;
  language: 'it' | 'en';
  onComplete: (responses: DemographicResponse[]) => void;
  onSkip?: () => void;
}

const TRANSLATIONS = {
  it: {
    intro: 'Prima di iniziare, alcune domande veloci',
    skip: 'Salta',
    next: 'Avanti',
    back: 'Indietro',
    finish: 'Completa',
    required: 'Obbligatoria',
    optional: 'Facoltativa',
    selectOne: 'Seleziona una risposta',
    selectMultiple: 'Seleziona una o più risposte',
    typeHere: 'Scrivi qui...'
  },
  en: {
    intro: 'Before we start, a few quick questions',
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    finish: 'Complete',
    required: 'Required',
    optional: 'Optional',
    selectOne: 'Select one answer',
    selectMultiple: 'Select one or more answers',
    typeHere: 'Type here...'
  }
};

export function DemographicForm({
  questions,
  introText,
  language = 'it',
  onComplete,
  onSkip
}: DemographicFormProps) {
  
  const t = TRANSLATIONS[language];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[] | number>>({});
  
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const currentResponse = responses[currentQuestion?.questionKey];
  
  const canProceed = !currentQuestion?.isRequired || 
    (currentResponse !== undefined && currentResponse !== '' && 
     (Array.isArray(currentResponse) ? currentResponse.length > 0 : true));
  
  const handleResponse = (value: string | string[] | number) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.questionKey]: value
    }));
  };
  
  const handleNext = () => {
    if (isLastQuestion) {
      const formattedResponses: DemographicResponse[] = Object.entries(responses)
        .filter(([_, value]) => value !== undefined && value !== '')
        .map(([key, value]) => ({
          questionKey: key,
          value: Array.isArray(value) ? JSON.stringify(value) : String(value)
        }));
      onComplete(formattedResponses);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };
  
  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-gray-900">
          {introText || t.intro}
        </h2>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-4">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${idx === currentIndex 
                  ? 'w-6 bg-amber-500' 
                  : idx < currentIndex 
                    ? 'bg-green-500' 
                    : 'bg-gray-200'
                }
              `}
            />
          ))}
        </div>
      </div>
      
      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {/* Question text */}
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-800">
              {currentQuestion.questionText}
            </p>
            <span className={`text-xs ${currentQuestion.isRequired ? 'text-amber-600' : 'text-gray-400'}`}>
              {currentQuestion.isRequired ? t.required : t.optional}
            </span>
          </div>
          
          {/* Answer input based on type */}
          {renderQuestionInput(currentQuestion, currentResponse, handleResponse, t)}
        </motion.div>
      </AnimatePresence>
      
      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={`
            flex items-center gap-1 px-4 py-2 rounded-lg
            ${currentIndex === 0 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-600 hover:bg-gray-100'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          {t.back}
        </button>
        
        <div className="flex gap-2">
          {onSkip && currentIndex === 0 && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              {t.skip}
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
              flex items-center gap-1 px-6 py-2 rounded-lg font-medium
              transition-all duration-200
              ${canProceed
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {isLastQuestion ? t.finish : t.next}
            {isLastQuestion ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderQuestionInput(
  question: DemographicQuestion,
  value: string | string[] | number | undefined,
  onChange: (value: string | string[] | number) => void,
  t: typeof TRANSLATIONS['it']
) {
  switch (question.questionType) {
    case 'single_choice':
      return (
        <div className="grid grid-cols-2 gap-3">
          {question.options?.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                p-4 rounded-xl text-left transition-all duration-200
                ${value === option.value
                  ? 'bg-amber-100 border-2 border-amber-400 text-amber-800'
                  : 'bg-white border-2 border-gray-100 hover:border-amber-200 text-gray-700'
                }
              `}
            >
              {option.icon && <span className="mr-2">{option.icon}</span>}
              {option.label}
            </button>
          ))}
        </div>
      );
      
    case 'multi_choice':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{t.selectMultiple}</p>
          <div className="grid grid-cols-2 gap-3">
            {question.options?.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    const newValue = isSelected
                      ? selectedValues.filter(v => v !== option.value)
                      : [...selectedValues, option.value];
                    onChange(newValue);
                  }}
                  className={`
                    p-4 rounded-xl text-left transition-all duration-200
                    ${isSelected
                      ? 'bg-amber-100 border-2 border-amber-400 text-amber-800'
                      : 'bg-white border-2 border-gray-100 hover:border-amber-200 text-gray-700'
                    }
                  `}
                >
                  {option.icon && <span className="mr-2">{option.icon}</span>}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      );
      
    case 'text':
      return (
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.typeHere}
          className="w-full p-4 rounded-xl border border-gray-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        />
      );
      
    case 'number':
      return (
        <input
          type="number"
          value={value !== undefined ? Number(value) : ''}
          onChange={(e) => onChange(parseInt(e.target.value))}
          min={question.minValue}
          max={question.maxValue}
          className="w-full p-4 rounded-xl border border-gray-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        />
      );
      
    case 'scale':
      const scaleValue = value !== undefined ? Number(value) : undefined;
      const min = question.minValue || 0;
      const max = question.maxValue || 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      
      return (
        <div className="space-y-4">
          <div className="flex justify-between">
            {steps.map((step) => (
              <button
                key={step}
                onClick={() => onChange(step)}
                className={`
                  w-10 h-10 rounded-full font-medium transition-all duration-200
                  ${scaleValue === step
                    ? 'bg-amber-500 text-white scale-110'
                    : 'bg-gray-100 text-gray-600 hover:bg-amber-100'
                  }
                `}
              >
                {step}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Per niente</span>
            <span>Assolutamente sì</span>
          </div>
        </div>
      );
      
    default:
      return null;
  }
}
```

---

## 5. API per Gestione Demografici

### File: src/app/api/demographics/route.ts

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Recupera domande demografiche per un bot
export async function GET(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get('botId');
  const position = req.nextUrl.searchParams.get('position'); // 'before' | 'after'
  
  if (!botId) {
    return Response.json({ error: 'botId required' }, { status: 400 });
  }
  
  const questions = await prisma.demographicQuestion.findMany({
    where: {
      botId,
      ...(position ? { position } : {})
    },
    orderBy: { orderIndex: 'asc' }
  });
  
  return Response.json({ questions });
}

// POST: Salva risposte demografiche
export async function POST(req: NextRequest) {
  const { conversationId, responses } = await req.json();
  
  if (!conversationId || !responses) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Salva tutte le risposte
  await prisma.$transaction([
    // Upsert per ogni risposta
    ...responses.map((r: { questionKey: string; value: string }) =>
      prisma.demographicResponse.upsert({
        where: {
          conversationId_questionKey: {
            conversationId,
            questionKey: r.questionKey
          }
        },
        create: {
          conversationId,
          questionKey: r.questionKey,
          value: r.value
        },
        update: {
          value: r.value
        }
      })
    ),
    // Marca completamento
    prisma.conversation.update({
      where: { id: conversationId },
      data: { demographicCompleted: true }
    })
  ]);
  
  return Response.json({ success: true });
}
```

---

## 6. Integrazione nel Flusso Intervista

### Modifiche a src/components/interview-chat.tsx

```tsx
// Aggiungere import
import { DemographicForm } from './interview/DemographicForm';

// Nuovi state
const [phase, setPhase] = useState<'demographics_before' | 'interview' | 'demographics_after' | 'complete'>('demographics_before');
const [demographicsBeforeQuestions, setDemographicsBeforeQuestions] = useState<DemographicQuestion[]>([]);
const [demographicsAfterQuestions, setDemographicsAfterQuestions] = useState<DemographicQuestion[]>([]);

// Fetch demografici al mount
useEffect(() => {
  async function loadDemographics() {
    if (!botId) return;
    
    const [beforeRes, afterRes] = await Promise.all([
      fetch(`/api/demographics?botId=${botId}&position=before`),
      fetch(`/api/demographics?botId=${botId}&position=after`)
    ]);
    
    const beforeData = await beforeRes.json();
    const afterData = await afterRes.json();
    
    setDemographicsBeforeQuestions(beforeData.questions || []);
    setDemographicsAfterQuestions(afterData.questions || []);
    
    // Se non ci sono domande before, salta direttamente a interview
    if (!beforeData.questions?.length) {
      setPhase('interview');
    }
  }
  
  loadDemographics();
}, [botId]);

// Gestione completamento demografici
const handleDemographicsComplete = async (responses: DemographicResponse[]) => {
  await fetch('/api/demographics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, responses })
  });
  
  if (phase === 'demographics_before') {
    setPhase('interview');
  } else {
    setPhase('complete');
  }
};

// Render condizionale
if (phase === 'demographics_before' && demographicsBeforeQuestions.length > 0) {
  return (
    <DemographicForm
      questions={demographicsBeforeQuestions}
      language={language as 'it' | 'en'}
      onComplete={handleDemographicsComplete}
      onSkip={() => setPhase('interview')}
    />
  );
}

if (phase === 'demographics_after') {
  return (
    <DemographicForm
      questions={demographicsAfterQuestions}
      introText="Ultime domande prima di concludere"
      language={language as 'it' | 'en'}
      onComplete={handleDemographicsComplete}
    />
  );
}

// ... resto del componente chat normale ...
```

---

## 7. Export Dati con Demografici

### Aggiornamento export analytics

```typescript
// In src/lib/analytics/export.ts

export async function exportConversationsWithDemographics(botId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { botId },
    include: {
      demographicResponses: true,
      messages: {
        where: { role: 'user' }
      }
    }
  });
  
  // Formatta per export
  return conversations.map(conv => {
    const demographics: Record<string, string> = {};
    conv.demographicResponses.forEach(r => {
      demographics[r.questionKey] = r.value;
    });
    
    return {
      id: conv.id,
      completedAt: conv.completedAt,
      demographics,
      messageCount: conv.messages.length,
      // ... altri campi
    };
  });
}
```

---

## Checklist Implementazione Fase 5

- [ ] Aggiornare schema.prisma con tabelle demografiche
- [ ] Creare types/demographics.ts
- [ ] Implementare templates.ts con template predefiniti
- [ ] Creare DemographicForm.tsx
- [ ] Creare API /api/demographics
- [ ] Integrare nel flusso interview-chat.tsx
- [ ] Aggiungere configurazione demografici nel bot builder
- [ ] Aggiornare export analytics
- [ ] Eseguire migration database
- [ ] Test con diversi tipi di domande
- [ ] Verificare salvataggio e recupero risposte

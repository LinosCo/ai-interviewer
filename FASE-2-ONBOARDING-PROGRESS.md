# Fase 2: Onboarding Trasparente e Progress Semantico

## Obiettivo

Rendere immediatamente chiaro all'utente cosa sta per fare, quanto durerà e come funziona. Eliminare l'ambiguità "è un form? è un'intervista?" che genera sospetto e abbandono.

---

## 1. Schema Database

### Nuovi campi per Bot

```prisma
// schema.prisma - MODIFICHE al model Bot

model Bot {
  // ... campi esistenti ...
  
  // NUOVI CAMPI per onboarding
  showProgressBar        Boolean  @default(true)
  progressBarStyle       String   @default("semantic") // "semantic" | "numeric" | "hidden"
  showEstimatedTime      Boolean  @default(true)
  showTopicPreview       Boolean  @default(false)      // Mostra i topic come "tappe"
  
  // Messaggi personalizzabili
  welcomeTitle           String?  // Override del titolo benvenuto
  welcomeSubtitle        String?  // Sottotitolo esplicativo
  formatExplanation      String?  // Spiegazione del formato conversazionale
}
```

---

## 2. Componente Welcome Screen Riprogettato

### File: src/components/interview/WelcomeScreen.tsx

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageCircle, Shield, ChevronRight, Check } from 'lucide-react';

interface WelcomeScreenProps {
  botName: string;
  botDescription?: string;
  estimatedDuration: number; // in minuti
  topicsCount: number;
  topicLabels?: string[]; // Per preview tappe
  showTopicPreview: boolean;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  formatExplanation?: string;
  privacyNotice?: string;
  rewardEnabled: boolean;
  rewardText?: string;
  language: 'it' | 'en';
  onStart: () => void;
}

const TRANSLATIONS = {
  it: {
    defaultTitle: 'Ciao! Grazie per il tuo tempo.',
    defaultSubtitle: 'Vorremmo farti alcune domande per capire meglio la tua esperienza.',
    formatExplanation: 'Questa è una conversazione guidata, non un questionario tradizionale. Rispondi liberamente, come se stessi parlando con qualcuno.',
    estimatedTime: 'Tempo stimato',
    minutes: 'minuti',
    topics: 'argomenti da esplorare',
    topicsPreviewTitle: 'Di cosa parleremo',
    privacyDefault: 'Le tue risposte sono anonime e verranno utilizzate solo per migliorare il servizio.',
    rewardLabel: 'Al termine',
    startButton: 'Inizia la conversazione',
    skipInfo: 'Puoi saltare qualsiasi domanda',
    conversationFormat: 'Formato conversazione'
  },
  en: {
    defaultTitle: 'Hi! Thanks for your time.',
    defaultSubtitle: 'We\'d like to ask you a few questions to better understand your experience.',
    formatExplanation: 'This is a guided conversation, not a traditional questionnaire. Feel free to answer naturally, as if you were talking to someone.',
    estimatedTime: 'Estimated time',
    minutes: 'minutes',
    topics: 'topics to explore',
    topicsPreviewTitle: 'What we\'ll discuss',
    privacyDefault: 'Your answers are anonymous and will only be used to improve the service.',
    rewardLabel: 'Upon completion',
    startButton: 'Start conversation',
    skipInfo: 'You can skip any question',
    conversationFormat: 'Conversation format'
  }
};

export function WelcomeScreen({
  botName,
  botDescription,
  estimatedDuration,
  topicsCount,
  topicLabels = [],
  showTopicPreview,
  welcomeTitle,
  welcomeSubtitle,
  formatExplanation,
  privacyNotice,
  rewardEnabled,
  rewardText,
  language = 'it',
  onStart
}: WelcomeScreenProps) {
  
  const t = TRANSLATIONS[language];
  const [consentGiven, setConsentGiven] = useState(false);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">
          {welcomeTitle || t.defaultTitle}
        </h1>
        <p className="text-gray-600">
          {welcomeSubtitle || botDescription || t.defaultSubtitle}
        </p>
      </div>
      
      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tempo stimato */}
        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-amber-600 font-medium">{t.estimatedTime}</p>
            <p className="text-lg font-semibold text-amber-700">
              {estimatedDuration} {t.minutes}
            </p>
          </div>
        </div>
        
        {/* Numero argomenti */}
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium">{t.conversationFormat}</p>
            <p className="text-lg font-semibold text-blue-700">
              {topicsCount} {t.topics}
            </p>
          </div>
        </div>
      </div>
      
      {/* Spiegazione formato */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="text-sm text-gray-600 leading-relaxed">
          {formatExplanation || t.formatExplanation}
        </p>
      </div>
      
      {/* Preview Topic (opzionale) */}
      {showTopicPreview && topicLabels.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">{t.topicsPreviewTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {topicLabels.map((label, index) => (
              <span 
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600"
              >
                <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Reward (se abilitato) */}
      {rewardEnabled && rewardText && (
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-lg">🎁</span>
          </div>
          <div>
            <p className="text-xs text-green-600 font-medium">{t.rewardLabel}</p>
            <p className="text-sm font-medium text-green-700">{rewardText}</p>
          </div>
        </div>
      )}
      
      {/* Privacy e Consenso */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <Shield className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            {privacyNotice || t.privacyDefault}
          </p>
        </div>
        
        <label className="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-600">
            Accetto il trattamento dei dati per finalità di ricerca
          </span>
        </label>
      </div>
      
      {/* CTA */}
      <div className="space-y-2">
        <button
          onClick={onStart}
          disabled={!consentGiven}
          className={`
            w-full py-4 rounded-xl font-medium text-lg
            flex items-center justify-center gap-2
            transition-all duration-200
            ${consentGiven 
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-300' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {t.startButton}
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <p className="text-center text-xs text-gray-400">
          {t.skipInfo}
        </p>
      </div>
    </motion.div>
  );
}
```

---

## 3. Progress Bar Semantica

### File: src/components/interview/SemanticProgressBar.tsx

```tsx
'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Topic {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface SemanticProgressBarProps {
  topics: Topic[];
  currentTopicId: string;
  style: 'semantic' | 'numeric' | 'minimal';
  estimatedMinutesLeft?: number;
  language: 'it' | 'en';
}

const TRANSLATIONS = {
  it: {
    current: 'Ora',
    next: 'Prossimo',
    completed: 'Completato',
    minutesLeft: 'min rimanenti'
  },
  en: {
    current: 'Now',
    next: 'Next',
    completed: 'Completed',
    minutesLeft: 'min left'
  }
};

export function SemanticProgressBar({
  topics,
  currentTopicId,
  style,
  estimatedMinutesLeft,
  language = 'it'
}: SemanticProgressBarProps) {
  
  const t = TRANSLATIONS[language];
  const currentIndex = topics.findIndex(t => t.id === currentTopicId);
  const progress = ((currentIndex + 1) / topics.length) * 100;
  
  if (style === 'minimal') {
    return (
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    );
  }
  
  if (style === 'numeric') {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">
          {currentIndex + 1} / {topics.length}
        </span>
        <div className="flex-1 mx-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        {estimatedMinutesLeft !== undefined && (
          <span className="text-sm text-gray-500">
            ~{estimatedMinutesLeft} {t.minutesLeft}
          </span>
        )}
      </div>
    );
  }
  
  // Style: semantic (default)
  return (
    <div className="px-4 py-3 bg-white border-b border-gray-100">
      {/* Topic pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {topics.map((topic, index) => {
          const isCurrent = topic.id === currentTopicId;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;
          
          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap
                transition-all duration-300
                ${isCurrent 
                  ? 'bg-amber-100 text-amber-700 font-medium ring-2 ring-amber-300' 
                  : isCompleted 
                    ? 'bg-green-50 text-green-600' 
                    : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              {isCompleted && (
                <Check className="w-3.5 h-3.5" />
              )}
              {isCurrent && (
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              )}
              <span>{topic.label}</span>
            </motion.div>
          );
        })}
      </div>
      
      {/* Current status */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          {t.current}: <span className="font-medium text-gray-700">{topics[currentIndex]?.label}</span>
        </span>
        {currentIndex < topics.length - 1 && (
          <span>
            {t.next}: {topics[currentIndex + 1]?.label}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## 4. Integrazione nel Chat Component

### Modifiche a src/components/interview-chat.tsx

```tsx
// AGGIUNTE agli import
import { WelcomeScreen } from './interview/WelcomeScreen';
import { SemanticProgressBar } from './interview/SemanticProgressBar';

// NUOVE props dell'interfaccia
interface InterviewChatProps {
  // ... props esistenti ...
  
  // Nuove props per onboarding
  progressBarStyle?: 'semantic' | 'numeric' | 'minimal' | 'hidden';
  showTopicPreview?: boolean;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  formatExplanation?: string;
  topics?: Array<{ id: string; label: string }>;
  currentTopicId?: string;
}

export function InterviewChat({
  // ... destructuring esistente ...
  progressBarStyle = 'semantic',
  showTopicPreview = false,
  welcomeTitle,
  welcomeSubtitle,
  formatExplanation,
  topics = [],
  currentTopicId
}: InterviewChatProps) {
  
  const [hasStarted, setHasStarted] = useState(false);
  
  // Calcola status topic per progress bar
  const topicsWithStatus = topics.map((topic, index) => {
    const currentIdx = topics.findIndex(t => t.id === currentTopicId);
    return {
      ...topic,
      status: index < currentIdx ? 'completed' : index === currentIdx ? 'current' : 'upcoming'
    };
  });
  
  // Se non ha iniziato, mostra welcome screen
  if (!hasStarted) {
    return (
      <WelcomeScreen
        botName={botName}
        botDescription={botDescription}
        estimatedDuration={parseInt(estimatedDuration || '5')}
        topicsCount={topics.length}
        topicLabels={topics.map(t => t.label)}
        showTopicPreview={showTopicPreview}
        welcomeTitle={welcomeTitle}
        welcomeSubtitle={welcomeSubtitle}
        formatExplanation={formatExplanation}
        privacyNotice={privacyNotice}
        rewardEnabled={rewardConfig?.enabled || false}
        rewardText={rewardConfig?.displayText || undefined}
        language={language as 'it' | 'en'}
        onStart={() => setHasStarted(true)}
      />
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar (se non hidden) */}
      {progressBarStyle !== 'hidden' && topics.length > 0 && (
        <SemanticProgressBar
          topics={topicsWithStatus}
          currentTopicId={currentTopicId || topics[0]?.id}
          style={progressBarStyle}
          language={language as 'it' | 'en'}
        />
      )}
      
      {/* Chat Area esistente */}
      <div className="flex-1 overflow-y-auto">
        {/* ... contenuto chat esistente ... */}
      </div>
    </div>
  );
}
```

---

## 5. API per Recuperare Info Topic

### Modifiche a src/app/api/interview/[id]/route.ts

```typescript
// Aggiungere alla response esistente

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      bot: {
        include: {
          topics: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              label: true,
              orderIndex: true
            }
          }
        }
      }
    }
  });
  
  if (!conversation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  
  return Response.json({
    conversationId: conversation.id,
    bot: {
      name: conversation.bot.name,
      description: conversation.bot.description,
      estimatedDuration: conversation.bot.maxDurationMins,
      language: conversation.bot.language,
      // Nuovi campi
      progressBarStyle: conversation.bot.progressBarStyle,
      showTopicPreview: conversation.bot.showTopicPreview,
      welcomeTitle: conversation.bot.welcomeTitle,
      welcomeSubtitle: conversation.bot.welcomeSubtitle,
      formatExplanation: conversation.bot.formatExplanation,
      topics: conversation.bot.topics.map(t => ({
        id: t.id,
        label: t.label
      }))
    },
    currentTopicId: conversation.currentTopicId,
    // ... altri campi esistenti ...
  });
}
```

---

## 6. Configurazione Bot Builder

### Aggiungere sezione nel form di creazione bot

```tsx
// In src/components/bot-builder/OnboardingSettings.tsx

export function OnboardingSettings({ 
  values, 
  onChange 
}: { 
  values: BotConfig; 
  onChange: (updates: Partial<BotConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Esperienza di benvenuto</h3>
      
      {/* Progress Bar Style */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Stile barra di progresso
        </label>
        <select
          value={values.progressBarStyle}
          onChange={(e) => onChange({ progressBarStyle: e.target.value })}
          className="w-full rounded-lg border-gray-300"
        >
          <option value="semantic">Semantico (mostra argomenti)</option>
          <option value="numeric">Numerico (1/5)</option>
          <option value="minimal">Minimale (solo barra)</option>
          <option value="hidden">Nascosto</option>
        </select>
        <p className="text-xs text-gray-500">
          Lo stile "semantico" mostra i temi come tappe, riducendo l'ansia da "quante domande mancano?"
        </p>
      </div>
      
      {/* Preview Topic */}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={values.showTopicPreview}
          onChange={(e) => onChange({ showTopicPreview: e.target.checked })}
          className="rounded border-gray-300"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">
            Mostra anteprima argomenti
          </span>
          <p className="text-xs text-gray-500">
            Nella schermata di benvenuto, mostra i temi che verranno discussi
          </p>
        </div>
      </label>
      
      {/* Custom Welcome */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Titolo di benvenuto (opzionale)
        </label>
        <input
          type="text"
          value={values.welcomeTitle || ''}
          onChange={(e) => onChange({ welcomeTitle: e.target.value })}
          placeholder="Es: Raccontaci la tua esperienza!"
          className="w-full rounded-lg border-gray-300"
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Spiegazione formato (opzionale)
        </label>
        <textarea
          value={values.formatExplanation || ''}
          onChange={(e) => onChange({ formatExplanation: e.target.value })}
          placeholder="Es: Rispondi come se stessi chiacchierando con un amico..."
          rows={3}
          className="w-full rounded-lg border-gray-300"
        />
        <p className="text-xs text-gray-500">
          Spiega all'utente che non è un questionario tradizionale
        </p>
      </div>
    </div>
  );
}
```

---

## Checklist Implementazione Fase 2

- [ ] Aggiornare schema.prisma con nuovi campi Bot
- [ ] Creare WelcomeScreen.tsx
- [ ] Creare SemanticProgressBar.tsx
- [ ] Modificare InterviewChat per integrare i nuovi componenti
- [ ] Aggiornare API /interview/[id] per restituire info topic
- [ ] Creare OnboardingSettings nel bot builder
- [ ] Eseguire migration database
- [ ] Test su mobile e desktop
- [ ] Verificare traduzioni IT/EN

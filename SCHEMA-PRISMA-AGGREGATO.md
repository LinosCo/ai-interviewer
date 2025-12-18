# Schema Prisma - Modifiche Aggregate

Questo file contiene tutte le modifiche allo schema Prisma necessarie per implementare le 6 fasi di miglioramento. Copiare le sezioni rilevanti nel file `schema.prisma` esistente.

---

## Nuovi Model da Aggiungere

```prisma
// ============================================
// FASE 1: Memory Layer
// ============================================

model ConversationMemory {
  id              String   @id @default(cuid())
  conversationId  String   @unique
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // Fatti raccolti (JSON array di CollectedFact)
  factsCollected  Json     @default("[]")
  
  // Temi già esplorati (JSON array di ExploredTopic)
  topicsExplored  Json     @default("[]")
  
  // Aree ancora da esplorare (JSON array di UnansweredArea)
  unansweredAreas Json     @default("[]")
  
  // Segnali di fatica utente (0-1)
  userFatigueScore Float   @default(0)
  
  // Stile comunicativo rilevato
  detectedTone    String?  // "formal" | "casual" | "brief" | "verbose"
  avgResponseLength Int    @default(0)
  usesEmoji       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


// ============================================
// FASE 5: Demografici
// ============================================

model DemographicQuestion {
  id              String   @id @default(cuid())
  botId           String
  bot             Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  
  // Configurazione domanda
  questionKey     String   // es: "age", "gender", "education"
  questionText    String   // Testo della domanda localizzato
  questionType    String   // "single_choice" | "multi_choice" | "text" | "number" | "scale"
  
  // Opzioni (per choice types) - JSON array di {value, label, icon?}
  options         Json?
  
  // Validazione
  isRequired      Boolean  @default(false)
  minValue        Int?     // Per number/scale
  maxValue        Int?     // Per number/scale
  
  // Posizionamento
  position        String   @default("before") // "before" | "after"
  orderIndex      Int      @default(0)
  
  // Metadata
  category        String?  // "basic" | "contextual" | "custom"
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([botId, questionKey])
  @@index([botId, position])
}

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
```

---

## Modifiche al Model Bot

Aggiungere questi campi al model `Bot` esistente:

```prisma
model Bot {
  // ============================================
  // CAMPI ESISTENTI (mantenere tutti)
  // ============================================
  id                    String   @id @default(cuid())
  userId                String
  name                  String
  description           String?
  researchGoal          String
  targetAudience        String?
  tone                  String?
  language              String   @default("it")
  maxDurationMins       Int      @default(10)
  introMessage          String?
  closingMessage        String?
  // ... altri campi esistenti ...
  
  // ============================================
  // NUOVI CAMPI - FASE 2: Onboarding e Progress
  // ============================================
  
  showProgressBar        Boolean  @default(true)
  progressBarStyle       String   @default("semantic") // "semantic" | "numeric" | "minimal" | "hidden"
  showTopicPreview       Boolean  @default(false)
  welcomeTitle           String?
  welcomeSubtitle        String?
  formatExplanation      String?
  
  // ============================================
  // NUOVI CAMPI - FASE 3: Warm-up
  // ============================================
  
  warmupStyle            String   @default("open")  // "open" | "choice" | "icebreaker" | "context"
  warmupChoices          Json?    // Array di WarmupChoice
  warmupIcebreaker       String?
  warmupContextPrompt    String?
  warmupFollowup         Boolean  @default(true)
  
  // ============================================
  // NUOVI CAMPI - FASE 5: Demografici
  // ============================================
  
  demographicEnabled     Boolean  @default(false)
  demographicPosition    String   @default("before") // "before" | "after"
  demographicIntroText   String?
  
  // ============================================
  // NUOVE RELAZIONI
  // ============================================
  
  demographicQuestions   DemographicQuestion[]
}
```

---

## Modifiche al Model Conversation

Aggiungere questi campi al model `Conversation` esistente:

```prisma
model Conversation {
  // ============================================
  // CAMPI ESISTENTI (mantenere tutti)
  // ============================================
  id                String   @id @default(cuid())
  botId             String
  bot               Bot      @relation(fields: [botId], references: [id], onDelete: Cascade)
  currentTopicId    String?
  status            String   @default("active")
  // ... altri campi esistenti ...
  
  // ============================================
  // NUOVI CAMPI - FASE 1: Memory
  // ============================================
  
  memory            ConversationMemory?
  
  // ============================================
  // NUOVI CAMPI - FASE 5: Demografici
  // ============================================
  
  demographicResponses    DemographicResponse[]
  demographicCompleted    Boolean  @default(false)
}
```

---

## Migration Steps

Eseguire le migration in questo ordine:

```bash
# 1. Memory Layer (Fase 1)
npx prisma migrate dev --name add_conversation_memory

# 2. Onboarding fields (Fase 2)
npx prisma migrate dev --name add_onboarding_fields

# 3. Warmup fields (Fase 3)
npx prisma migrate dev --name add_warmup_config

# 4. Demographics (Fase 5)
npx prisma migrate dev --name add_demographics

# Oppure tutto insieme:
npx prisma migrate dev --name business_tuner_improvements_v2
```

---

## Types TypeScript Correlati

### types/memory.ts (Fase 1)

```typescript
export interface CollectedFact {
  id: string;
  content: string;
  topic: string;
  extractedAt: string;
  confidence: number;
  keywords: string[];
}

export interface ExploredTopic {
  topicId: string;
  topicLabel: string;
  coverageLevel: 'shallow' | 'moderate' | 'deep';
  subGoalsCovered: string[];
  subGoalsMissing: string[];
  lastExploredAt: string;
}

export interface UnansweredArea {
  area: string;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  skipReason?: string;
}

export interface ConversationMemoryData {
  factsCollected: CollectedFact[];
  topicsExplored: ExploredTopic[];
  unansweredAreas: UnansweredArea[];
  userFatigueScore: number;
  detectedTone: 'formal' | 'casual' | 'brief' | 'verbose' | null;
  avgResponseLength: number;
  usesEmoji: boolean;
}
```

### types/warmup.ts (Fase 3)

```typescript
export interface WarmupChoice {
  id: string;
  label: string;
  value: string;
  followupPrompt?: string;
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

### types/demographics.ts (Fase 5)

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
  icon?: string;
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
```

### types/tone.ts (Fase 4)

```typescript
export interface ToneProfile {
  register: 'formal' | 'neutral' | 'casual';
  verbosity: 'brief' | 'moderate' | 'verbose';
  emotionality: 'reserved' | 'balanced' | 'expressive';
  usesEmoji: boolean;
  avgWordCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ToneSignals {
  formalIndicators: string[];
  casualIndicators: string[];
  emojiCount: number;
  punctuationStyle: 'minimal' | 'standard' | 'expressive';
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
}
```

---

## Indici Consigliati per Performance

```prisma
// Aggiunti automaticamente dai @@index, ma verificare:

// ConversationMemory
@@index([conversationId])

// DemographicQuestion  
@@index([botId, position])
@@index([botId, orderIndex])

// DemographicResponse
@@index([conversationId])
@@index([conversationId, questionKey])
```

---

## Note Importanti

1. **Backup prima di migrare**: Fare sempre un backup del database prima di eseguire migration in produzione.

2. **Campi JSON**: I campi `factsCollected`, `topicsExplored`, `unansweredAreas`, `warmupChoices`, `options` sono JSON. Prisma li gestisce automaticamente, ma assicurarsi di validare i dati prima di salvarli.

3. **Default values**: Tutti i nuovi campi hanno default values per garantire backward compatibility con bot esistenti.

4. **Cascade delete**: Le relazioni usano `onDelete: Cascade` per pulire automaticamente i dati correlati quando si elimina un bot o una conversazione.

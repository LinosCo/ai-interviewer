# Fase 1: Memory Layer Anti-Ridondanza

## Obiettivo

Eliminare la sensazione "te l'ho già detto" implementando un sistema di memoria conversazionale che traccia cosa l'utente ha già comunicato e impedisce all'AI di riformulare domande su temi già coperti.

---

## 1. Schema Database

### Nuova tabella: ConversationMemory

```prisma
// schema.prisma - AGGIUNTE

model ConversationMemory {
  id              String   @id @default(cuid())
  conversationId  String   @unique
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // Fatti raccolti (JSON array di stringhe)
  factsCollected  Json     @default("[]")
  
  // Temi già esplorati con livello di profondità
  topicsExplored  Json     @default("[]")
  
  // Aree ancora da esplorare
  unansweredAreas Json     @default("[]")
  
  // Segnali di fatica utente
  userFatigueScore Float   @default(0)
  
  // Stile comunicativo rilevato
  detectedTone    String?  // "formal" | "casual" | "brief" | "verbose"
  avgResponseLength Int    @default(0)
  usesEmoji       Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Aggiornare Conversation per includere la relazione
model Conversation {
  // ... campi esistenti ...
  memory          ConversationMemory?
}
```

### Struttura JSON dei campi

```typescript
// types/memory.ts

export interface CollectedFact {
  id: string;
  content: string;           // "L'utente è a Verona per una vacanza romantica"
  topic: string;             // ID del topic di riferimento
  extractedAt: string;       // ISO timestamp
  confidence: number;        // 0-1, quanto siamo sicuri dell'estrazione
  keywords: string[];        // ["Verona", "vacanza", "romantica"]
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
  area: string;              // "budget del viaggio"
  priority: 'high' | 'medium' | 'low';
  attempts: number;          // Quante volte abbiamo provato a chiedere
  skipReason?: string;       // "user_declined" | "off_topic" | "time_limit"
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

---

## 2. Servizio di Estrazione Fatti

### File: src/lib/memory/fact-extractor.ts

```typescript
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { CollectedFact } from '@/types/memory';

const factSchema = z.object({
  facts: z.array(z.object({
    content: z.string().describe('Fatto estratto in forma assertiva'),
    confidence: z.number().min(0).max(1).describe('Confidenza estrazione'),
    keywords: z.array(z.string()).describe('Parole chiave')
  })),
  detectedTone: z.enum(['formal', 'casual', 'brief', 'verbose']).nullable(),
  fatigueSignals: z.number().min(0).max(1).describe('0 = engaged, 1 = fatigued')
});

export async function extractFactsFromResponse(
  userMessage: string,
  currentTopicLabel: string,
  existingFacts: CollectedFact[],
  apiKey: string
): Promise<{
  newFacts: Omit<CollectedFact, 'id' | 'extractedAt'>[];
  detectedTone: string | null;
  fatigueScore: number;
}> {
  
  const openai = createOpenAI({ apiKey });
  
  const existingFactsSummary = existingFacts
    .map(f => `- ${f.content}`)
    .join('\n');
  
  const prompt = `
Analizza questa risposta dell'utente in un'intervista.

RISPOSTA UTENTE:
"${userMessage}"

TOPIC CORRENTE: ${currentTopicLabel}

FATTI GIÀ NOTI:
${existingFactsSummary || '(nessuno)'}

COMPITI:
1. Estrai NUOVI fatti concreti dalla risposta (non ripetere quelli già noti)
2. Rileva il tono comunicativo (formale/casual/breve/verboso)
3. Valuta segnali di fatica (risposte telegrafiche, "non so", evasioni)

REGOLE ESTRAZIONE FATTI:
- Solo informazioni concrete e verificabili
- Forma assertiva: "L'utente [fatto]"
- NO interpretazioni o inferenze
- NO fatti già presenti nella lista
- Se la risposta è vaga, restituisci array vuoto
`.trim();

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'), // Modello economico per questa operazione
      schema: factSchema,
      prompt
    });

    return {
      newFacts: result.object.facts.map(f => ({
        content: f.content,
        topic: currentTopicLabel,
        confidence: f.confidence,
        keywords: f.keywords
      })),
      detectedTone: result.object.detectedTone,
      fatigueScore: result.object.fatigueSignals
    };
  } catch (error) {
    console.error('Fact extraction failed:', error);
    return {
      newFacts: [],
      detectedTone: null,
      fatigueScore: 0
    };
  }
}
```

---

## 3. Servizio Memory Manager

### File: src/lib/memory/memory-manager.ts

```typescript
import { prisma } from '@/lib/prisma';
import { extractFactsFromResponse } from './fact-extractor';
import { 
  ConversationMemoryData, 
  CollectedFact, 
  ExploredTopic,
  UnansweredArea 
} from '@/types/memory';
import { v4 as uuidv4 } from 'uuid';

export class MemoryManager {
  
  /**
   * Inizializza la memoria per una nuova conversazione
   */
  static async initialize(conversationId: string): Promise<void> {
    await prisma.conversationMemory.create({
      data: {
        conversationId,
        factsCollected: [],
        topicsExplored: [],
        unansweredAreas: []
      }
    });
  }

  /**
   * Recupera la memoria esistente
   */
  static async get(conversationId: string): Promise<ConversationMemoryData | null> {
    const memory = await prisma.conversationMemory.findUnique({
      where: { conversationId }
    });
    
    if (!memory) return null;
    
    return {
      factsCollected: memory.factsCollected as CollectedFact[],
      topicsExplored: memory.topicsExplored as ExploredTopic[],
      unansweredAreas: memory.unansweredAreas as UnansweredArea[],
      userFatigueScore: memory.userFatigueScore,
      detectedTone: memory.detectedTone as ConversationMemoryData['detectedTone'],
      avgResponseLength: memory.avgResponseLength,
      usesEmoji: memory.usesEmoji
    };
  }

  /**
   * Aggiorna la memoria dopo una risposta utente
   */
  static async updateAfterUserResponse(
    conversationId: string,
    userMessage: string,
    currentTopicId: string,
    currentTopicLabel: string,
    apiKey: string
  ): Promise<ConversationMemoryData> {
    
    // 1. Recupera memoria esistente
    let memory = await this.get(conversationId);
    if (!memory) {
      await this.initialize(conversationId);
      memory = await this.get(conversationId);
    }
    
    // 2. Estrai nuovi fatti
    const extraction = await extractFactsFromResponse(
      userMessage,
      currentTopicLabel,
      memory!.factsCollected,
      apiKey
    );
    
    // 3. Aggiungi nuovi fatti
    const newFacts: CollectedFact[] = extraction.newFacts.map(f => ({
      ...f,
      id: uuidv4(),
      extractedAt: new Date().toISOString()
    }));
    
    const updatedFacts = [...memory!.factsCollected, ...newFacts];
    
    // 4. Aggiorna statistiche tono
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(userMessage);
    const messageLength = userMessage.length;
    const currentAvg = memory!.avgResponseLength;
    const messageCount = memory!.factsCollected.length + 1;
    const newAvg = Math.round((currentAvg * (messageCount - 1) + messageLength) / messageCount);
    
    // 5. Aggiorna fatica (media mobile)
    const newFatigueScore = (memory!.userFatigueScore * 0.7) + (extraction.fatigueScore * 0.3);
    
    // 6. Salva
    await prisma.conversationMemory.update({
      where: { conversationId },
      data: {
        factsCollected: updatedFacts,
        userFatigueScore: newFatigueScore,
        detectedTone: extraction.detectedTone || memory!.detectedTone,
        avgResponseLength: newAvg,
        usesEmoji: memory!.usesEmoji || hasEmoji
      }
    });
    
    return {
      ...memory!,
      factsCollected: updatedFacts,
      userFatigueScore: newFatigueScore,
      detectedTone: extraction.detectedTone || memory!.detectedTone,
      avgResponseLength: newAvg,
      usesEmoji: memory!.usesEmoji || hasEmoji
    };
  }

  /**
   * Marca un topic come esplorato
   */
  static async markTopicExplored(
    conversationId: string,
    topicId: string,
    topicLabel: string,
    coverageLevel: 'shallow' | 'moderate' | 'deep',
    subGoalsCovered: string[],
    subGoalsMissing: string[]
  ): Promise<void> {
    
    const memory = await this.get(conversationId);
    if (!memory) return;
    
    const existingIndex = memory.topicsExplored.findIndex(t => t.topicId === topicId);
    
    const exploredTopic: ExploredTopic = {
      topicId,
      topicLabel,
      coverageLevel,
      subGoalsCovered,
      subGoalsMissing,
      lastExploredAt: new Date().toISOString()
    };
    
    let updatedTopics: ExploredTopic[];
    if (existingIndex >= 0) {
      updatedTopics = [...memory.topicsExplored];
      updatedTopics[existingIndex] = exploredTopic;
    } else {
      updatedTopics = [...memory.topicsExplored, exploredTopic];
    }
    
    await prisma.conversationMemory.update({
      where: { conversationId },
      data: { topicsExplored: updatedTopics }
    });
  }

  /**
   * Genera il contesto memoria per il prompt
   */
  static formatForPrompt(memory: ConversationMemoryData): string {
    const sections: string[] = [];
    
    // Fatti raccolti
    if (memory.factsCollected.length > 0) {
      const factsText = memory.factsCollected
        .filter(f => f.confidence >= 0.6)
        .map(f => `• ${f.content}`)
        .join('\n');
      
      sections.push(`## INFORMAZIONI GIÀ RACCOLTE
${factsText}

⚠️ NON chiedere nuovamente informazioni su questi temi. Se devi approfondire, parti da quello che già sai.`);
    }
    
    // Topic esplorati
    if (memory.topicsExplored.length > 0) {
      const topicsText = memory.topicsExplored
        .map(t => `• ${t.topicLabel}: ${t.coverageLevel} (coperti: ${t.subGoalsCovered.join(', ') || 'nessuno'})`)
        .join('\n');
      
      sections.push(`## TOPIC GIÀ DISCUSSI
${topicsText}`);
    }
    
    // Segnali fatica
    if (memory.userFatigueScore > 0.5) {
      sections.push(`## ⚠️ ATTENZIONE: SEGNALI DI FATICA
L'utente mostra segni di stanchezza (score: ${memory.userFatigueScore.toFixed(2)}).
- Fai domande più brevi e dirette
- Considera di saltare approfondimenti non essenziali
- Valuta se concludere prima del previsto`);
    }
    
    // Stile comunicativo
    if (memory.detectedTone) {
      const toneInstructions: Record<string, string> = {
        formal: 'Mantieni un registro formale e professionale.',
        casual: 'Usa un tono colloquiale e amichevole.',
        brief: 'L\'utente preferisce risposte brevi. Fai domande concise e dirette.',
        verbose: 'L\'utente è loquace. Puoi permetterti domande più articolate.'
      };
      
      sections.push(`## STILE COMUNICATIVO RILEVATO
${toneInstructions[memory.detectedTone]}
${memory.usesEmoji ? 'L\'utente usa emoji, puoi usarle occasionalmente.' : ''}`);
    }
    
    return sections.join('\n\n');
  }
}
```

---

## 4. Integrazione nel Flusso Chat

### Modifiche a src/app/api/chat/route.ts

```typescript
// AGGIUNTE all'inizio del file
import { MemoryManager } from '@/lib/memory/memory-manager';

// Nel handler POST, dopo aver ricevuto il messaggio utente:

export async function POST(req: Request) {
  // ... codice esistente per parsing request ...

  const { conversationId, message } = await req.json();
  
  // ... recupero conversazione esistente ...
  
  // NUOVO: Aggiorna memoria dopo messaggio utente
  const apiKey = process.env.OPENAI_API_KEY || '';
  const currentTopic = conversation.bot.topics.find(
    (t: any) => t.id === conversation.currentTopicId
  );
  
  const memory = await MemoryManager.updateAfterUserResponse(
    conversationId,
    message,
    currentTopic?.id || '',
    currentTopic?.label || 'Generale',
    apiKey
  );
  
  // ... codice esistente per costruzione prompt ...
  
  // NUOVO: Aggiungi contesto memoria al system prompt
  const memoryContext = MemoryManager.formatForPrompt(memory);
  
  let systemPrompt = PromptBuilder.build(
    conversation.bot,
    conversation,
    currentTopic || null,
    methodology,
    updatedEffectiveDuration
  );
  
  // Inserisci il contesto memoria PRIMA delle istruzioni operative
  systemPrompt = systemPrompt.replace(
    '## TRANSITION & COMPLETION CONTROL',
    `${memoryContext}\n\n## TRANSITION & COMPLETION CONTROL`
  );
  
  // ... resto del codice ...
}
```

---

## 5. Test e Validazione

### File: src/lib/memory/__tests__/memory-manager.test.ts

```typescript
import { MemoryManager } from '../memory-manager';
import { extractFactsFromResponse } from '../fact-extractor';

describe('MemoryManager', () => {
  
  describe('formatForPrompt', () => {
    it('should format facts correctly', () => {
      const memory = {
        factsCollected: [
          { 
            id: '1', 
            content: 'L\'utente è a Verona per vacanza', 
            topic: 'motivazioni',
            extractedAt: new Date().toISOString(),
            confidence: 0.9,
            keywords: ['Verona', 'vacanza']
          }
        ],
        topicsExplored: [],
        unansweredAreas: [],
        userFatigueScore: 0.2,
        detectedTone: 'casual' as const,
        avgResponseLength: 50,
        usesEmoji: false
      };
      
      const result = MemoryManager.formatForPrompt(memory);
      
      expect(result).toContain('INFORMAZIONI GIÀ RACCOLTE');
      expect(result).toContain('L\'utente è a Verona per vacanza');
      expect(result).toContain('NON chiedere nuovamente');
    });
    
    it('should warn about user fatigue', () => {
      const memory = {
        factsCollected: [],
        topicsExplored: [],
        unansweredAreas: [],
        userFatigueScore: 0.7,
        detectedTone: null,
        avgResponseLength: 15,
        usesEmoji: false
      };
      
      const result = MemoryManager.formatForPrompt(memory);
      
      expect(result).toContain('SEGNALI DI FATICA');
      expect(result).toContain('domande più brevi');
    });
  });
});
```

---

## 6. Migration Script

```bash
# Esegui dopo aver aggiornato schema.prisma
npx prisma migrate dev --name add_conversation_memory
```

---

## Checklist Implementazione Fase 1

- [ ] Aggiornare schema.prisma con ConversationMemory
- [ ] Creare types/memory.ts con le interfacce
- [ ] Implementare src/lib/memory/fact-extractor.ts
- [ ] Implementare src/lib/memory/memory-manager.ts
- [ ] Modificare src/app/api/chat/route.ts per integrazione
- [ ] Scrivere test unitari
- [ ] Eseguire migration database
- [ ] Test end-to-end con conversazione reale

# VOLER.AI - Piano di Sviluppo Completo

## Contesto del Progetto

Voler.AI è una piattaforma SaaS che democratizza la ricerca qualitativa attraverso interviste conversazionali automatizzate con AI. Il valore chiave è permettere a chiunque (product manager, HR, founder, consulenti, responsabili operativi) di lanciare un'indagine qualitativa in 10 minuti senza competenze tecniche o metodologiche.

La piattaforma esiste già con funzionalità core implementate. Questo piano definisce i miglioramenti necessari per trasformarla in un prodotto commerciale self-service.

## Principi Guida

1. **Zero friction per utenti non tecnici**: ogni decisione deve semplificare, non complicare
2. **Il valore si realizza negli insight, non nella configurazione**: minimizza il tempo di setup, massimizza la qualità dell'output
3. **Growth guidata dal prodotto**: il prodotto deve vendersi da solo attraverso l'esperienza
4. **Metodologia invisibile ma presente**: l'AI applica best practice senza che l'utente debba conoscerle

---

## Architettura dei Limiti e Monetizzazione

### Modello di pricing

| Tier | Prezzo | Bot attivi | Interviste/mese | Utenti | Features |
|------|--------|------------|-----------------|--------|----------|
| Free | €0 | 1 | 30 | 1 | Analytics base, watermark, template base |
| Starter | €29/mese | 3 | 150 | 1 | No watermark, export PDF, tutti i template |
| Pro | €79/mese | 10 | 500 | 3 | Branding custom, analytics avanzati, API |
| Business | €199/mese | Unlimited | 2000 | 10 | SSO, priority support, onboarding dedicato |
| Enterprise | Custom | Unlimited | Custom | Unlimited | SLA, HRIS integration, deployment dedicato |

### Logica dei limiti

- **Bot attivi**: conta i bot con status "published". I bot in draft non contano.
- **Interviste/mese**: conta le conversazioni con status COMPLETED. Reset il primo del mese.
- **Utenti**: membri del workspace con ruolo attivo.

### Rimozione API keys utente

Rimuovi completamente la possibilità per gli utenti di inserire le proprie API keys nel flusso standard. Le chiavi sono gestite a livello piattaforma.

Mantieni un flag nascosto `allowCustomApiKeys` a livello Organization per clienti enterprise che richiedono di usare il proprio contratto con i provider AI per ragioni di compliance.

---

## FASE 1: Semplificazione e Magic Moment

Obiettivo: un nuovo utente deve poter creare e condividere un'intervista funzionante in meno di 5 minuti.

### 1.1 Nuovo Onboarding Wizard

Sostituisci il flusso attuale (dashboard → new project → new bot → form complesso) con un wizard guidato.

**Flusso nuovo utente:**

```
Registrazione/Login
        ↓
"Cosa vuoi capire?" (pagina dedicata, non modal)
        ↓
[Textarea grande con placeholder esempi]
"Esempio: Voglio capire perché i miei clienti abbandonano il carrello"
"Esempio: Voglio raccogliere feedback sul nuovo processo di onboarding"
        ↓
[Bottone: Genera la mia intervista]
        ↓
Loading con messaggi educativi:
"Sto analizzando il tuo obiettivo..."
"Definisco le domande giuste..."
"Applico le best practice di ricerca qualitativa..."
        ↓
Preview dell'intervista generata:
- Nome suggerito (editabile inline)
- Obiettivo riformulato (editabile)
- 3-5 topic con descrizione (collassabili, editabili)
- Anteprima del messaggio di benvenuto
        ↓
[Bottone: Prova l'intervista] → Apre simulatore
[Bottone: Pubblica e condividi] → Genera link
        ↓
Pagina di successo con:
- Link copiabile
- QR code
- Opzioni di condivisione (email, WhatsApp, Slack)
- "Riceverai una notifica quando arrivano le prime risposte"
```

**File da creare/modificare:**

- `src/app/onboarding/page.tsx` - Wizard principale
- `src/app/onboarding/generate/page.tsx` - Step di generazione
- `src/app/onboarding/preview/page.tsx` - Preview e pubblicazione
- `src/components/onboarding/goal-input.tsx` - Input con esempi cliccabili
- `src/components/onboarding/generation-loading.tsx` - Loading con messaggi
- `src/components/onboarding/interview-preview.tsx` - Preview editabile
- `src/components/onboarding/share-options.tsx` - Opzioni condivisione

**Logica:**

- Al primo login, redirect automatico a `/onboarding`
- Crea automaticamente un Project di default "Il mio workspace"
- Il bot viene creato in stato "draft" fino alla pubblicazione
- La pubblicazione cambia lo stato in "published" e genera lo slug

### 1.2 Simulatore di Preview

Prima di pubblicare, l'utente deve poter testare l'intervista come se fosse un partecipante.

**Comportamento:**

- Apre un modal/drawer con l'interfaccia di chat
- Simula 3-5 scambi usando l'AI reale ma senza salvare in database
- Mostra un banner "Modalità anteprima - le risposte non vengono salvate"
- Bottoni: "Ricomincia", "Modifica intervista", "Sono soddisfatto, pubblica"

**File da creare:**

- `src/components/bot-simulator.tsx` - Componente simulatore
- `src/app/api/simulate/route.ts` - Endpoint che non persiste

### 1.3 Template Library

Crea una libreria di template predefiniti per casi d'uso comuni.

**Template da creare:**

1. **Feedback prodotto** - "Capire cosa pensano gli utenti di un prodotto/feature"
2. **Exit interview** - "Raccogliere feedback da chi lascia l'azienda"
3. **Onboarding check-in** - "Verificare l'esperienza dei nuovi assunti"
4. **Customer churn** - "Capire perché i clienti se ne vanno"
5. **Concept testing** - "Validare un'idea prima di svilupparla"
6. **Post-evento** - "Raccogliere feedback dopo un evento/workshop"
7. **Retrospettiva progetto** - "Analizzare cosa ha funzionato e cosa no"
8. **Voice of supplier** - "Feedback dalla rete fornitori"
9. **Employee pulse** - "Sentiment periodico del team"
10. **Win/loss analysis** - "Capire perché si vincono o perdono deal"

**Struttura template:**

```typescript
interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'hr' | 'product' | 'sales' | 'operations' | 'strategy';
  icon: string;
  defaultConfig: {
    researchGoal: string;
    targetAudience: string;
    language: string;
    tone: string;
    maxDurationMins: number;
    introMessage: string;
    topics: {
      label: string;
      description: string;
      subGoals: string[];
      maxTurns: number;
    }[];
  };
  examplePrompt: string; // Cosa avrebbe scritto l'utente per generarlo
}
```

**File da creare:**

- `src/lib/templates/index.ts` - Registry dei template
- `src/lib/templates/[template-name].ts` - Definizione di ogni template
- `src/app/templates/page.tsx` - Galleria pubblica dei template
- `src/components/template-card.tsx` - Card per la galleria
- `src/components/template-picker.tsx` - Picker nell'onboarding

**Logica:**

- I template sono mostrati nella home dell'onboarding come alternativa a "scrivi il tuo obiettivo"
- Click su template → precompila il form → l'utente può modificare o pubblicare direttamente
- I template sono anche accessibili da una pagina pubblica `/templates` per SEO

### 1.4 Semplificazione Dashboard

La dashboard attuale è orientata a "progetti e bot". Per utenti non tecnici serve una vista orientata a "le mie interviste e i risultati".

**Nuova struttura dashboard:**

```
/dashboard
├── Home (overview)
│   ├── Interviste attive con risposte recenti
│   ├── Notifiche ("5 nuove risposte su Exit Interview")
│   └── Quick actions ("Crea nuova intervista")
│
├── /interviews (lista bot)
│   ├── Card per ogni bot con: nome, risposte, status, link rapido
│   └── Filtri: attive, in pausa, archiviate
│
├── /interviews/[id] (dettaglio bot)
│   ├── Tab: Risposte | Insights | Impostazioni
│   └── Risposte: lista conversazioni con preview
│
├── /templates (galleria)
│
└── /settings
    ├── Profilo
    ├── Piano e fatturazione
    └── Team (se Pro+)
```

**File da modificare:**

- `src/app/dashboard/page.tsx` - Nuova home
- `src/app/dashboard/interviews/page.tsx` - Lista interviste (rinomina da "bots")
- `src/app/dashboard/layout.tsx` - Nuova sidebar

**Terminologia:**

Rinomina ovunque nell'UI:
- "Bot" → "Intervista"
- "Project" → "Workspace" (o rimuovi del tutto per tier free/starter)
- "Conversation" → "Risposta"
- "Analytics" → "Insights"

### 1.5 Rimozione Complessità

Rimuovi o nascondi dal flusso standard:

- Selezione model provider e model name (usa default ottimale)
- API keys utente (gestite a livello piattaforma)
- Knowledge sources (sposta in "Impostazioni avanzate")
- Configurazione topic manuale (solo via AI generation o template)
- Branding avanzato per tier free (solo colore primario)

Queste opzioni restano accessibili in una sezione "Impostazioni avanzate" per power user, ma non sono nel flusso principale.

---

## FASE 2: Sistema di Pricing e Pagamenti

### 2.1 Modello Dati per Subscription

**Nuove tabelle Prisma:**

```prisma
model Subscription {
  id              String   @id @default(cuid())
  
  // Relazione con Organization (non User, per supportare team)
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  
  // Piano
  tier            SubscriptionTier @default(FREE)
  status          SubscriptionStatus @default(ACTIVE)
  
  // Stripe
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  stripePriceId         String?
  
  // Limiti correnti (copiati dal piano per performance)
  maxActiveBots         Int @default(1)
  maxInterviewsPerMonth Int @default(30)
  maxUsers              Int @default(1)
  
  // Tracking uso
  currentPeriodStart    DateTime @default(now())
  currentPeriodEnd      DateTime
  interviewsUsedThisMonth Int @default(0)
  
  // Billing
  billingEmail          String?
  billingName           String?
  vatNumber             String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  canceledAt      DateTime?
  
  invoices        Invoice[]
}

enum SubscriptionTier {
  FREE
  STARTER
  PRO
  BUSINESS
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

model Invoice {
  id              String   @id @default(cuid())
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  
  stripeInvoiceId String   @unique
  amountPaid      Int      // in centesimi
  currency        String   @default("eur")
  status          String
  pdfUrl          String?
  
  createdAt       DateTime @default(now())
}

model UsageEvent {
  id              String   @id @default(cuid())
  organizationId  String
  eventType       UsageEventType
  resourceId      String?  // botId o conversationId
  metadata        Json?
  
  createdAt       DateTime @default(now())
  
  @@index([organizationId, createdAt])
}

enum UsageEventType {
  INTERVIEW_COMPLETED
  BOT_PUBLISHED
  BOT_UNPUBLISHED
  USER_INVITED
}
```

**Modifiche a tabelle esistenti:**

```prisma
model Organization {
  // ... campi esistenti ...
  
  subscription    Subscription?
}

model Bot {
  // ... campi esistenti ...
  
  status          BotStatus @default(DRAFT)
}

enum BotStatus {
  DRAFT
  PUBLISHED
  PAUSED
  ARCHIVED
}
```

### 2.2 Integrazione Stripe

**File da creare:**

- `src/lib/stripe.ts` - Client Stripe configurato
- `src/app/api/stripe/checkout/route.ts` - Crea sessione checkout
- `src/app/api/stripe/portal/route.ts` - Accesso al customer portal
- `src/app/api/stripe/webhook/route.ts` - Gestione webhook
- `src/app/pricing/page.tsx` - Pagina pricing pubblica
- `src/app/dashboard/settings/billing/page.tsx` - Gestione abbonamento

**Webhook da gestire:**

- `checkout.session.completed` - Attiva subscription
- `invoice.paid` - Conferma pagamento, reset contatori mensili
- `invoice.payment_failed` - Notifica, grace period
- `customer.subscription.updated` - Cambio piano
- `customer.subscription.deleted` - Cancellazione

**Logica enforcement limiti:**

```typescript
// src/lib/usage.ts

export async function canCreateBot(organizationId: string): Promise<boolean> {
  const subscription = await getSubscription(organizationId);
  const activeBotsCount = await prisma.bot.count({
    where: { 
      project: { organizationId },
      status: 'PUBLISHED'
    }
  });
  return activeBotsCount < subscription.maxActiveBots;
}

export async function canCompleteInterview(organizationId: string): Promise<boolean> {
  const subscription = await getSubscription(organizationId);
  return subscription.interviewsUsedThisMonth < subscription.maxInterviewsPerMonth;
}

export async function recordInterviewCompleted(organizationId: string, conversationId: string) {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { organizationId },
      data: { interviewsUsedThisMonth: { increment: 1 } }
    }),
    prisma.usageEvent.create({
      data: {
        organizationId,
        eventType: 'INTERVIEW_COMPLETED',
        resourceId: conversationId
      }
    })
  ]);
}
```

**Enforcement nel flusso:**

- Prima di pubblicare un bot: `canCreateBot()`
- Quando una conversazione passa a COMPLETED: `canCompleteInterview()`
- Se limite raggiunto: mostra upgrade prompt invece di bloccare silenziosamente

### 2.3 UI Upgrade e Limiti

**Componenti da creare:**

- `src/components/usage-meter.tsx` - Barra progresso uso (nella sidebar)
- `src/components/upgrade-prompt.tsx` - Modal/banner per upgrade
- `src/components/limit-reached.tsx` - Messaggio quando limite raggiunto
- `src/components/pricing-table.tsx` - Tabella comparativa piani

**Comportamento:**

- Mostra sempre l'uso corrente nella dashboard: "15/30 interviste questo mese"
- Warning a 80%: "Stai per raggiungere il limite"
- Al 100%: le nuove interviste non vengono salvate, mostra messaggio ai partecipanti "L'intervista non è al momento disponibile"
- Upgrade accessibile da: sidebar, settings, ogni prompt di limite

---

## FASE 3: Landing Page Commerciale

### 3.1 Struttura Landing Page

Crea una landing page completa su `/` che sostituisce la pagina attuale.

**Sezioni:**

1. **Hero**
   - Headline: "Ascolta davvero. Decidi meglio."
   - Subheadline: "Lancia interviste qualitative in 5 minuti. L'AI fa le domande giuste, tu ottieni insight actionable."
   - CTA primario: "Inizia gratis"
   - CTA secondario: "Guarda come funziona"
   - Visual: screenshot/video dell'interfaccia o animazione del flusso

2. **Social proof** (se disponibile)
   - Loghi clienti
   - Numero utenti/interviste
   - Testimonial

3. **Come funziona** (3 step)
   - "Descrivi cosa vuoi capire"
   - "L'AI genera l'intervista perfetta"
   - "Condividi il link, ricevi insight"
   - Animazione o GIF per ogni step

4. **Casi d'uso**
   - Tab o carousel con: Product, HR, Sales, Operations
   - Per ognuno: problema, soluzione, esempio concreto

5. **Funzionalità chiave**
   - Generazione AI intelligente
   - Metodologia di ricerca integrata
   - Analytics con insight tracciabili
   - Multi-lingua
   - GDPR compliant
   - Branding personalizzabile

6. **Pricing**
   - Tabella comparativa dei piani
   - Toggle mensile/annuale (sconto 20% annuale)
   - FAQ sui piani

7. **Template gallery preview**
   - Mostra 4-6 template popolari
   - Link a pagina completa

8. **CTA finale**
   - Ripeti value prop
   - Form email per iniziare o bottone "Inizia gratis"

9. **Footer**
   - Link: Pricing, Templates, Blog, Docs, Privacy, Terms
   - Contatti
   - Social

**File da creare:**

- `src/app/(marketing)/page.tsx` - Landing principale
- `src/app/(marketing)/layout.tsx` - Layout marketing (no sidebar)
- `src/app/(marketing)/pricing/page.tsx` - Pagina pricing dedicata
- `src/app/(marketing)/templates/page.tsx` - Galleria template pubblica
- `src/app/(marketing)/use-cases/[slug]/page.tsx` - Pagine per caso d'uso (SEO)
- `src/components/marketing/hero.tsx`
- `src/components/marketing/how-it-works.tsx`
- `src/components/marketing/use-cases.tsx`
- `src/components/marketing/features.tsx`
- `src/components/marketing/pricing-section.tsx`
- `src/components/marketing/testimonials.tsx`
- `src/components/marketing/cta-section.tsx`
- `src/components/marketing/footer.tsx`
- `src/components/marketing/navbar.tsx`

**Routing:**

```
/ → Landing page (marketing)
/pricing → Pricing page
/templates → Template gallery
/use-cases/[slug] → Pagine caso d'uso
/login → Login
/signup → Registrazione
/dashboard → App (richiede auth)
/i/[slug] → Intervista pubblica
```

### 3.2 SEO e Performance

**Ottimizzazioni:**

- Metadata dinamici per ogni pagina
- Open Graph e Twitter cards
- Structured data (JSON-LD) per Organization e Product
- Sitemap.xml automatico
- robots.txt
- Immagini ottimizzate con next/image
- Font ottimizzati

**File da creare:**

- `src/app/sitemap.ts` - Sitemap dinamico
- `src/app/robots.ts` - robots.txt

### 3.3 Analytics e Tracking

**Integrazioni:**

- Vercel Analytics (già incluso)
- Evento tracking per: signup, create_interview, publish_interview, share_interview, complete_interview
- Opzionale: Posthog o Mixpanel per product analytics

**File da creare:**

- `src/lib/analytics.ts` - Wrapper per tracking eventi

---

## FASE 4: Miglioramenti Core

### 4.1 Refactoring Sistema Prompt

Il prompt attuale in `/api/chat/route.ts` è monolitico. Separa in componenti.

**Nuova architettura:**

```
src/lib/prompts/
├── index.ts              # Compositore principale
├── persona.ts            # Chi è l'intervistatore (fisso)
├── methodology.ts        # Regole di probing (semi-fisso)
├── context.ts            # Stato corrente intervista (dinamico)
├── topic.ts              # Topic attuale e successivo (dinamico)
├── closing.ts            # Logica di chiusura e reward
└── templates/            # Prompt per casi speciali
    ├── overtime.ts
    └── quality-check.ts
```

**Logica:**

```typescript
// src/lib/prompts/index.ts

export function buildInterviewPrompt(params: {
  bot: BotWithConfig;
  conversation: ConversationWithMessages;
  currentTopic: TopicBlock | null;
  nextTopic: TopicBlock | null;
  timeContext: TimeContext;
}): string {
  return [
    buildPersonaPrompt(params.bot),
    buildMethodologyPrompt(),
    buildContextPrompt(params.conversation, params.timeContext),
    buildTopicPrompt(params.currentTopic, params.nextTopic),
    buildClosingPrompt(params.bot.rewardConfig, params.conversation.id),
  ].join('\n\n---\n\n');
}
```

### 4.2 Transizione Topic Intelligente

Sostituisci la logica basata su conteggio messaggi con valutazione AI.

**Nuovo approccio:**

Dopo ogni risposta utente, valuta:

```typescript
interface TopicEvaluation {
  subGoalsCovered: string[];    // Quali sub-goal sono stati affrontati
  coverageScore: number;        // 0-100, quanto è coperto il topic
  shouldTransition: boolean;    // Passare al prossimo?
  transitionReason?: string;    // "coverage_complete" | "user_fatigue" | "time_limit"
}
```

Questa valutazione può essere:
- Light: regex/keyword matching sui sub-goals
- Heavy: chiamata AI separata (costosa ma accurata)

Suggerisco approccio ibrido: light di default, heavy ogni 3 messaggi o quando lo score è ambiguo.

### 4.3 Quality Gates

Aggiungi check automatici durante l'intervista.

**Trigger:**

- 3+ risposte consecutive < 15 caratteri → "Capisco che alcune domande possono sembrare complesse. Se preferisci, possiamo approfondire in modo diverso. Cosa ne pensi?"
- Tempo risposta < 5 secondi per testo > 100 caratteri → flag interno (possibile copy-paste)
- Nessun esempio concreto dopo 5 scambi → "Potresti farmi un esempio specifico di quando questo è successo?"
- Sentiment molto negativo rilevato → tono più empatico

**Implementazione:**

```typescript
// src/lib/quality/guards.ts

export function analyzeResponseQuality(
  response: string,
  responseTimeMs: number,
  conversationHistory: Message[]
): QualitySignals {
  return {
    isBrief: response.length < 15,
    isPossiblePaste: responseTimeMs < 5000 && response.length > 100,
    consecutiveBriefCount: countConsecutiveBrief(conversationHistory),
    hasConcreteExample: detectConcreteExample(response),
    sentiment: analyzeSentiment(response),
  };
}

export function getQualityIntervention(signals: QualitySignals): string | null {
  if (signals.consecutiveBriefCount >= 3) {
    return INTERVENTIONS.encourageElaboration;
  }
  // ... altri check
  return null;
}
```

### 4.4 Analytics Incrementali

Sostituisci l'analisi batch con analisi incrementale.

**Nuovo flusso:**

1. Quando una conversazione passa a COMPLETED:
   - Job async: estrai 3-5 key quotes
   - Job async: calcola sentiment
   - Job async: identifica temi (matching con temi esistenti o nuovo)

2. Periodicamente (o on-demand):
   - Aggrega i dati incrementali
   - Genera insight di alto livello
   - Identifica trend

**Implementazione:**

```typescript
// src/lib/analytics/incremental.ts

export async function processCompletedConversation(conversationId: string) {
  const conversation = await getConversationWithMessages(conversationId);
  
  // Estrai in parallelo
  const [quotes, sentiment, themes] = await Promise.all([
    extractKeyQuotes(conversation),
    analyzeSentiment(conversation),
    identifyThemes(conversation),
  ]);
  
  // Salva risultati
  await saveConversationAnalytics(conversationId, {
    quotes,
    sentiment,
    themes,
  });
}
```

**Nuove tabelle:**

```prisma
model ConversationAnalytics {
  id              String   @id @default(cuid())
  conversationId  String   @unique
  conversation    Conversation @relation(fields: [conversationId], references: [id])
  
  sentimentScore  Float?
  engagementScore Float?
  qualityScore    Float?
  
  keyQuotes       Json     // Array di quote estratte
  detectedThemes  Json     // Array di { themeId, confidence }
  
  processedAt     DateTime @default(now())
}
```

### 4.5 Dashboard Insights Migliorata

**Nuova struttura pagina insights:**

1. **Summary cards**
   - Interviste completate (con trend)
   - Sentiment medio (con trend)
   - Temi principali (top 3)
   - Completion rate

2. **3 Takeaway**
   - Generati automaticamente
   - "Il 70% dei partecipanti menziona problemi di comunicazione"
   - "Il sentiment è migliorato del 15% rispetto al mese scorso"
   - Actionable quando possibile

3. **Timeline**
   - Grafico risposte nel tempo
   - Sentiment nel tempo
   - Filtri per periodo

4. **Temi**
   - Lista temi con frequenza
   - Click per espandere: quote correlate, trend, conversazioni

5. **Quote gallery**
   - Le migliori quote estratte
   - Filtrabili per tema o sentiment
   - Copiabili per presentazioni

6. **Export**
   - PDF report (generato)
   - CSV raw data
   - Slide deck (futuro)

---

## FASE 5: Funzionalità Team e Enterprise

### 5.1 Multi-utente

**Ruoli:**

- **Owner**: gestisce billing, può eliminare workspace
- **Admin**: gestisce membri, può modificare tutto
- **Editor**: può creare e modificare interviste
- **Viewer**: può solo vedere risultati

**Modifiche schema:**

```prisma
model Membership {
  // ... campi esistenti ...
  
  role    WorkspaceRole @default(EDITOR)
}

enum WorkspaceRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}
```

**UI:**

- Pagina `/dashboard/settings/team` per gestire membri
- Invito via email
- Pending invites

### 5.2 Segmentazione Partecipanti

Permetti di raccogliere metadata opzionali dai partecipanti.

**Configurazione bot:**

```typescript
interface ParticipantMetadataConfig {
  fields: {
    id: string;
    label: string;
    type: 'select' | 'text';
    options?: string[];  // per select
    required: boolean;
  }[];
}
```

Esempio: Dipartimento (select), Seniority (select), Sede (select)

**Privacy:**

- I dati sono mostrati solo in aggregato sopra soglia minima (default: 5)
- L'admin può vedere i breakdown ma non le singole risposte associate

### 5.3 Automazioni Base

**Trigger supportati:**

- Webhook in ingresso: "Quando ricevi POST a questo URL, crea un invito"
- Scheduling: "Invia reminder ogni lunedì alle 9:00"
- Soglie: "Notifica quando raggiungi 50 risposte"

**Implementazione MVP:**

Inizia solo con webhook in ingresso e notifiche email su soglie.

---

## FASE 6: Infrastruttura e Ops

### 6.1 Background Jobs

Per analytics incrementali e task async, implementa un sistema di job.

**Opzioni:**

- Vercel Cron + Database queue (semplice)
- Trigger.dev (managed, buona DX)
- Inngest (event-driven, buona per questo caso)

**Job da implementare:**

- `process-completed-conversation`: analytics post-intervista
- `aggregate-bot-analytics`: aggregazione periodica
- `send-notification`: email/slack notifications
- `reset-monthly-usage`: reset contatori il primo del mese
- `cleanup-draft-bots`: elimina draft vecchi non pubblicati

### 6.2 Rate Limiting

Proteggi gli endpoint pubblici.

**Endpoint da proteggere:**

- `/api/chat`: rate limit per conversationId (previeni spam)
- `/i/[slug]`: rate limit per IP (previeni abuse)
- `/api/stripe/webhook`: verifica signature Stripe

**Implementazione:**

Usa Upstash Redis per rate limiting serverless-friendly.

### 6.3 Monitoring

**Setup:**

- Sentry per error tracking
- Vercel Analytics per performance
- Alert su: error rate spike, API latency, job failures

### 6.4 Backup e Disaster Recovery

**Policy:**

- Database: backup automatici Vercel Postgres (già incluso)
- File (se aggiunti): backup su S3
- Retention: 30 giorni

---

## Ordine di Implementazione Suggerito

### Sprint 1 (2 settimane): Foundation
- [ ] Nuovo onboarding wizard
- [ ] 3 template iniziali
- [ ] Semplificazione dashboard
- [ ] Rimozione API keys dal flusso utente

### Sprint 2 (2 settimane): Monetization
- [ ] Schema subscription e usage
- [ ] Integrazione Stripe
- [ ] UI limiti e upgrade
- [ ] Pagina pricing

### Sprint 3 (2 settimane): Landing
- [ ] Landing page completa
- [ ] Pagina templates pubblica
- [ ] SEO setup
- [ ] Analytics tracking

### Sprint 4 (2 settimane): Quality
- [ ] Refactoring prompt system
- [ ] Quality gates
- [ ] Simulatore preview
- [ ] Analytics incrementali base

### Sprint 5 (2 settimane): Polish
- [ ] Dashboard insights migliorata
- [ ] Email notifications
- [ ] Documentazione utente
- [ ] Bug fixing e performance

### Sprint 6+ (ongoing): Scale
- [ ] Multi-utente e ruoli
- [ ] Segmentazione partecipanti
- [ ] Automazioni
- [ ] Enterprise features

---

## Note Tecniche

### Variabili d'ambiente da aggiungere

```env
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...

# Email (per notifiche)
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@voler.ai

# Rate limiting
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Analytics (opzionale)
POSTHOG_KEY=phc_...
```

### Dipendenze da aggiungere

```bash
npm install stripe @stripe/stripe-js
npm install resend
npm install @upstash/ratelimit @upstash/redis
npm install @sentry/nextjs
```

### Convenzioni codice

- Usa `server actions` per mutazioni semplici
- Usa `API routes` per integrazioni esterne (Stripe webhook)
- Mantieni la logica di business in `/src/lib/`
- Componenti UI riutilizzabili in `/src/components/`
- Componenti specifici di pagina nella cartella della pagina

---

## Checklist Pre-Launch

- [ ] Privacy policy aggiornata
- [ ] Terms of service
- [ ] Cookie banner (se analytics terze parti)
- [ ] GDPR: DPA template per clienti
- [ ] Test pagamento end-to-end
- [ ] Email transazionali funzionanti
- [ ] Monitoring attivo
- [ ] Backup verificato
- [ ] Performance test (load test base)
- [ ] Mobile responsive verificato
- [ ] Accessibilità base (a11y)
